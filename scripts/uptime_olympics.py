import csv
import json
import os
import socket
import time
import pandas as pd
import requests

DAYS = int(os.environ.get('DAYS', 7))
TOP_N = int(os.environ.get('TOP_N', 50))
GEO_CACHE = 'ip_geo_cache.json'


def is_ipv4(s):
    parts = s.split('.')
    if len(parts) != 4:
        return False
    try:
        return all(0 <= int(p) <= 255 for p in parts)
    except ValueError:
        return False

df = pd.read_csv('peers_recent.csv', parse_dates=['timestamp'])
df['bucket'] = df['timestamp'].dt.floor('1h')

window_end = df['bucket'].max()
data_start = df['bucket'].min()
window_start = window_end - pd.Timedelta(days=DAYS)
df = df[df['bucket'] >= window_start]

# Distinct (peer, hour) pairs — same logic as plot_gantt.py
active = df[['peer_id', 'bucket']].drop_duplicates()
hours_per_peer = active.groupby('peer_id')['bucket'].nunique()

# Total hours in window: actual unique buckets observed (so partial trailing/leading
# hours don't inflate the denominator above 100%).
window_hours = df['bucket'].nunique()

requested_hours = DAYS * 24
if window_hours < requested_hours * 0.9:
    print(
        f'WARNING: requested DAYS={DAYS} ({requested_hours}h) but CSV only '
        f'spans {window_hours}h (data starts {data_start.strftime("%Y-%m-%d %H:%M")}). '
        f'Re-run `make extract DAYS={DAYS}` to widen the source window.'
    )

peer_ip = {}
with open('ip_peers_recent.csv') as f:
    for row in csv.DictReader(f):
        pid = row['peer_id']
        if pid and pid not in peer_ip:
            peer_ip[pid] = row['ip']

# ip -> country code (ISO-2). Cached to disk so re-runs don't hit the API.
ip_country = {}
if os.path.exists(GEO_CACHE):
    with open(GEO_CACHE) as f:
        ip_country = json.load(f)

needed = sorted({peer_ip[p] for p in hours_per_peer.index if peer_ip.get(p)})
missing = [h for h in needed if h not in ip_country]
if missing:
    # ip-api.com batch endpoint rejects hostnames ("invalid query"), so for
    # /dns4/ peers we resolve to an IP via local DNS first, then look up that
    # IP. We still cache by the original host string (IP or hostname).
    print(f'Resolving {len(missing)} hosts via ip-api.com ...')
    host_to_ip = {}
    for h in missing:
        if is_ipv4(h):
            host_to_ip[h] = h
        else:
            try:
                host_to_ip[h] = socket.gethostbyname(h)
            except (socket.gaierror, socket.herror):
                host_to_ip[h] = None
    unresolved_dns = [h for h, ip in host_to_ip.items() if ip is None]
    if unresolved_dns:
        print(f'  DNS resolution failed for {len(unresolved_dns)}: {unresolved_dns[:5]}')

    ip_to_country = {}
    unique_ips = sorted({ip for ip in host_to_ip.values() if ip})
    for i in range(0, len(unique_ips), 100):
        batch = unique_ips[i:i + 100]
        resp = requests.post(
            'http://ip-api.com/batch?fields=status,countryCode,query',
            json=batch,
            timeout=30,
        )
        for entry in resp.json():
            ip_to_country[entry['query']] = (
                entry.get('countryCode', '') if entry.get('status') == 'success' else ''
            )
        if i + 100 < len(unique_ips):
            time.sleep(5)

    for h, ip in host_to_ip.items():
        ip_country[h] = ip_to_country.get(ip, '') if ip else ''
    with open(GEO_CACHE, 'w') as f:
        json.dump(ip_country, f, indent=2, sort_keys=True)
    print(f'Cached {len(ip_country)} hosts to {GEO_CACHE}')


def flag(country_code):
    if not country_code or len(country_code) != 2 or not country_code.isalpha():
        return '  '
    return ''.join(chr(0x1F1E6 + ord(c.upper()) - ord('A')) for c in country_code)


leaderboard = (
    hours_per_peer.reset_index(name='hours')
    .assign(
        ip=lambda d: d['peer_id'].map(lambda p: peer_ip.get(p, '')),
        country=lambda d: d['ip'].map(lambda ip: ip_country.get(ip, '')),
        uptime_pct=lambda d: 100.0 * d['hours'] / window_hours,
        rank=lambda d: d['hours'].rank(method='dense', ascending=False).astype(int),
    )
    .sort_values(['hours', 'peer_id'], ascending=[False, True])
    .reset_index(drop=True)
)

medals = {1: '🥇', 2: '🥈', 3: '🥉'}

header = f'🏆 UPTIME OLYMPICS — Last {DAYS}d ({window_hours}h window)'
sep = '=' * len(header)
window_line = (
    f'Window: {window_start.strftime("%Y-%m-%d %H:%M")} → '
    f'{(window_end + pd.Timedelta(hours=1)).strftime("%Y-%m-%d %H:%M")} UTC'
)
peers_line = f'{len(leaderboard)} peers seen — showing top {min(TOP_N, len(leaderboard))}'

visible = leaderboard.head(TOP_N)
host_w = max(15, visible['ip'].map(len).max() if len(visible) else 15)

lines = [header, sep, window_line, peers_line, '']
lines.append(
    f'{"Flag":<4}  {"Rank":<5}  {"Peer ID":<54}  {"Host":<{host_w}}  '
    f'{"Hours":>6}  {"Uptime":>7}'
)
lines.append('-' * (76 + host_w + 16))

# Medal emojis render as 2 terminal cells but count as 1 Python char, so we
# build the rank column to a fixed *visual* width (5 cells) directly instead
# of relying on `:>5`, which would add an extra leading space on medal rows.
for _, row in visible.iterrows():
    r = int(row['rank'])
    if r in medals:
        rank = f'{medals[r]}{r:>3}'  # 2 cells + 3 cells = 5 cells
    else:
        rank = f'   {r:>2}'           # 3 spaces + 2 cells = 5 cells
    lines.append(
        f'{flag(row["country"]):<4}  {rank}  {row["peer_id"]:<54}  '
        f'{row["ip"]:<{host_w}}  {row["hours"]:>6}  {row["uptime_pct"]:>6.1f}%'
    )

output = '\n'.join(lines)
print(output)

with open('uptime_olympics.txt', 'w') as f:
    f.write(output + '\n')
print('\nSaved uptime_olympics.txt')
