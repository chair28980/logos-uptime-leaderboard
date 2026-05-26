# Uptime Olympics scripts

These scripts produce the `last-7-days.txt` / `last-30-days.txt` leaderboard
files consumed by the Next.js site under `data/`.

## Pipeline

```
hourly node logs ──► extract_recent_rg.sh ──► peers_recent.csv      ──► uptime_olympics.py ──► uptime_olympics.txt
                                              ip_peers_recent.csv
                                              stake_recent.csv
                                              ips_recent.csv
```

`uptime_olympics.py` reads `peers_recent.csv` + `ip_peers_recent.csv`, counts
distinct (peer, hour) pairs over the trailing window, geo-resolves IPs via
ip-api.com (cached in `ip_geo_cache.json`), and writes a ranked leaderboard to
`uptime_olympics.txt`.

## Inputs

`extract_recent_rg.sh` expects hourly rotated logs of the form

```
logs/0/logos-blockchain.log.YYYY-MM-DD-HH
```

The script that fetches those logs from the testnet index server is **not
included here** because it carries credentials. Drop the log files into
`logs/0/` yourself (or set `LOG_DIR=...`) before running.

## Usage

```bash
pip install -r requirements.txt        # pandas, requests
brew install ripgrep                   # extract_recent_rg.sh uses rg

# from this scripts/ directory, with logs/0/ alongside it:
make olympics DAYS=7
make olympics DAYS=30

# the leaderboard lands in uptime_olympics.txt — copy it into ../data/
cp uptime_olympics.txt ../data/last-7-days.txt
```

## Knobs

| Variable | Default     | Purpose                                       |
|----------|-------------|-----------------------------------------------|
| `DAYS`   | `7`         | Trailing window in days for both stages       |
| `TOP_N`  | `50`        | Rows shown in the leaderboard (env on python) |
| `LOG_DIR`| `logs/0`    | Where `extract_recent_rg.sh` looks for shards |
| `PYTHON` | `python3`   | Python interpreter used by `make olympics`    |

## Caches

- `.cache/extract_recent_rg/` — per-file extraction cache, keyed by size+mtime.
  Past-hour log files are immutable so they hit cache forever; only the
  currently-rotating hour misses each run.
- `ip_geo_cache.json` — persisted host→country map. Delete to force re-lookup.

## Frozen-cache mode

If `LOG_DIR` is empty but the four `*_recent.csv` files already exist in cwd,
`extract_recent_rg.sh` exits 0 and lets `uptime_olympics.py` run against the
cached CSVs. Useful for re-rendering the leaderboard from an archived testnet.
