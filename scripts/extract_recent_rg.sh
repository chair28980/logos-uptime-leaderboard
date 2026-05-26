#!/bin/bash
# Extract peer IDs, stake, and IP/peer mappings for the last ~DAYS days from
# the rotated hourly logs in logs/0/ (fetched by fetch_logs.sh).
#
# Caching model: each input log file's extracted output is cached under
# .cache/extract_recent_rg/<phase>/<basename>.<size>.<mtime>. Past-hour files
# are immutable so they hit cache forever; only the current hour's file
# (still being appended to) misses each run. A top-level manifest of all
# (basename, size, mtime) tuples short-circuits the whole script when no
# input file has changed since the last successful run.
#
# Frozen-cache mode: if LOG_DIR has no matching log files but the four
# aggregated CSVs already exist in cwd, exit 0 and let downstream readers
# use them. Lets you delete or compress an old testnet's raw logs and keep
# `make compare` working against the cached CSVs.
#
# Bash 3.2 compatible (macOS default) — no associative arrays. We carry
# parallel indexed arrays FILES / META / *_CACHE and pass cache paths as
# arguments to xargs workers, so workers never re-stat.
set -euo pipefail

LOG_DIR="${LOG_DIR:-logs/0}"
DAYS="${DAYS:-7}"
CACHE_DIR="${CACHE_DIR:-.cache/extract_recent_rg}"

# Discover hourly log files of the form:
#   logs/0/logos-blockchain.log.YYYY-MM-DD-HH
# Glob is constrained to the exact date suffix so compressed sibling files
# (e.g. .gz from archived testnets) don't match — those should trip the
# frozen-cache fallback below.
shopt -s nullglob
ALL_FILES=("${LOG_DIR}"/logos-blockchain.log.[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-[0-9][0-9])
shopt -u nullglob

if [[ ${#ALL_FILES[@]} -eq 0 ]]; then
    if [[ -s peers_recent.csv && -s stake_recent.csv && -s ip_peers_recent.csv && -s ips_recent.csv ]]; then
        echo "No source logs in ${LOG_DIR}/ — using cached CSVs (frozen-cache mode)." >&2
        exit 0
    fi
    echo "No log files found in ${LOG_DIR}/. Run 'make fetch' first." >&2
    exit 1
fi

# Find the latest date — bash builtins only (no subshell/sed per file).
# Filename shape: logos-blockchain.log.YYYY-MM-DD-HH; ${name##*.} grabs
# YYYY-MM-DD-HH and ${d%-*} drops the hour suffix.
LATEST_DATE=""
for f in "${ALL_FILES[@]}"; do
    base="${f##*/}"; d="${base##*.}"; d="${d%-*}"
    [[ "$d" > "$LATEST_DATE" ]] && LATEST_DATE="$d"
done

START_DATE=$(date -j -v-"${DAYS}"d -f "%Y-%m-%d" "$LATEST_DATE" "+%Y-%m-%d" 2>/dev/null \
    || date -d "$LATEST_DATE - ${DAYS} days" "+%Y-%m-%d")

echo "Latest date: $LATEST_DATE   window start: $START_DATE" >&2

# Filter to in-window FILES first (cheap; uses filename only).
FILES=()
for f in "${ALL_FILES[@]}"; do
    base="${f##*/}"; d="${base##*.}"; d="${d%-*}"
    if [[ "$d" > "$START_DATE" || "$d" == "$START_DATE" ]] && \
       [[ "$d" < "$LATEST_DATE" || "$d" == "$LATEST_DATE" ]]; then
        FILES+=("$f")
    fi
done

if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "No log files in window [$START_DATE, $LATEST_DATE]" >&2
    exit 1
fi

echo "Scanning ${#FILES[@]} log file(s)" >&2

NPROC=$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)

mkdir -p "$CACHE_DIR/peers" "$CACHE_DIR/stake" "$CACHE_DIR/ippeers" "$CACHE_DIR/ips"
MANIFEST_FILE="$CACHE_DIR/manifest"

# Single batched stat for in-window files only (1 fork instead of N).
# META[i] = "<size>.<mtime>" parallel to FILES[i].
META=()
i=0
while IFS=' ' read -r s m; do
    META[$i]="${s}.${m}"
    i=$((i+1))
done < <(stat -f '%z %m' "${FILES[@]}" 2>/dev/null \
         || stat -c '%s %Y' "${FILES[@]}")

# Precompute per-(file, kind) cache paths so cache_path_for is never called
# in tight loops or worker subshells.
PEERS_CACHE=()
STAKE_CACHE=()
IPPEERS_CACHE=()
IPS_CACHE=()
MANIFEST_LINES=()
for i in "${!FILES[@]}"; do
    base="${FILES[$i]##*/}"
    suffix="${base}.${META[$i]}"
    PEERS_CACHE[$i]="$CACHE_DIR/peers/$suffix"
    STAKE_CACHE[$i]="$CACHE_DIR/stake/$suffix"
    IPPEERS_CACHE[$i]="$CACHE_DIR/ippeers/$suffix"
    IPS_CACHE[$i]="$CACHE_DIR/ips/$suffix"
    MANIFEST_LINES+=("$base ${META[$i]}")
done

CURRENT_MANIFEST=$(printf '%s\n' "${MANIFEST_LINES[@]}" | sort)
if [[ -s peers_recent.csv && -s stake_recent.csv && -s ip_peers_recent.csv && -s ips_recent.csv \
      && -f "$MANIFEST_FILE" \
      && "$(cat "$MANIFEST_FILE")" == "$CURRENT_MANIFEST" ]]; then
  echo "Inputs unchanged since last successful run — nothing to do." >&2
  exit 0
fi

# Per-phase wall-clock timing — uses bash $SECONDS, prints elapsed at phase end.
phase_start() { PHASE_NAME="$1"; PHASE_T0=$SECONDS; echo ">>> ${PHASE_NAME}" >&2; }
phase_end()   { echo "<<< ${PHASE_NAME} ($((SECONDS - PHASE_T0))s)" >&2; }

# Each ensure_*_cache function is idempotent: hit → return; miss → extract
# and write atomically (tmp + mv). Workers can run in parallel safely because
# each writes to its own per-source cache file (no shared pipe / file).
# Args: $1 = source log file, $2 = cache file path.

ensure_peers_cache() {
  local f="$1" cache="$2"
  [[ -f "$cache" ]] && return
  # rg exits 1 when nothing matches — suppress so the cache file (possibly
  # empty) still gets written. Empty caches are valid hits next run.
  { rg --no-filename '12D3KooW' "$f" || true; } | awk '
    {
      gsub(/\033\[[0-9;]*m/, "")
      if (!match($0, /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/)) next
      ts = substr($0, RSTART, RLENGTH)
      rest = $0
      while (match(rest, /12D3KooW[1-9A-HJ-NP-Za-km-z]{30,}/)) {
        print ts "," substr(rest, RSTART, RLENGTH)
        rest = substr(rest, RSTART + RLENGTH)
      }
    }' > "$cache.tmp"
  mv "$cache.tmp" "$cache"
}
export -f ensure_peers_cache

ensure_stake_cache() {
  local f="$1" cache="$2"
  [[ -f "$cache" ]] && return
  { rg --no-filename -F 'TSI update' "$f" || true; } | awk '
    {
      gsub(/\033\[[0-9;]*m/, "")
      if (!match($0, /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/)) next
      ts = substr($0, RSTART, RLENGTH)
      idx = index($0, "old_total_stake")
      if (idx == 0) next
      rest = substr($0, idx)
      eq = index(rest, "=")
      rest = substr(rest, eq + 1)
      if (!match(rest, /[0-9][0-9]+/)) next
      print ts "," substr(rest, RSTART, RLENGTH)
    }' > "$cache.tmp"
  mv "$cache.tmp" "$cache"
}
export -f ensure_stake_cache

# Host/peer mapping shapes — host segment is either /ip4/<IPv4>/ or /dns4/<hostname>/:
#   A) `Added address /(ip4|dns4)/<HOST>/udp/<port>/quic-v1 to peer PeerId("<PEER>")`
#      (kademlia k-bucket add — successfully added to routing table)
#   B) `/(ip4|dns4)/<HOST>/udp/<port>/quic-v1/p2p/<PEER>` inside swarm connection errors
#      (dial attempts — includes peers that never completed handshake)
# Single rg pass with one alternation regex; replacement `$1$3,$2$4` works
# because per match only one branch's groups are filled.
#
# Per-file dedup is critical: the same (host, peer) is logged thousands of
# times per file — without local sort -u, caches sum to ~450 MB / 6.5M lines
# and the final merge sort dominates wall time. Filtering private IPs and
# uniquing here shrinks each cache to a few dozen rows.
ensure_ippeers_cache() {
  local f="$1" cache="$2"
  [[ -f "$cache" ]] && return
  { rg --no-filename -e '/ip4/' -e '/dns4/' "$f" || true; } \
    | awk '{ gsub(/\033\[[0-9;]*m/, ""); print }' \
    | { rg -o '(?:Added address /(?:ip4|dns4)/([^/ ]+)/[^ ]+ to peer PeerId\("(12D3KooW[1-9A-HJ-NP-Za-km-z]+)"\)|/(?:ip4|dns4)/([^/ ]+)/[^ /]+/\d+/[^ /]+/p2p/(12D3KooW[1-9A-HJ-NP-Za-km-z]+))' \
          -r '$1$3,$2$4' || true; } \
    | grep -vE '^(0\.|10\.|127\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)' \
    | sort -u \
    > "$cache.tmp"
  mv "$cache.tmp" "$cache"
}
export -f ensure_ippeers_cache

# Per-hour unique-IP timeseries: same /ip4/ prefilter, but extract the IPv4
# octets and pair each with the line's timestamp. Per-file sort -u dedups
# (timestamp, ip) so caches stay small even when a single line spawns many
# repeated mentions. Plotter (plot_hourly_ips.py) buckets to the hour.
ensure_ips_cache() {
  local f="$1" cache="$2"
  [[ -f "$cache" ]] && return
  { rg --no-filename -F '/ip4/' "$f" || true; } | awk '
    {
      gsub(/\033\[[0-9;]*m/, "")
      if (!match($0, /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/)) next
      ts = substr($0, RSTART, RLENGTH)
      rest = $0
      while (match(rest, /\/ip4\/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\//)) {
        print ts "," substr(rest, RSTART + 5, RLENGTH - 6)
        rest = substr(rest, RSTART + RLENGTH)
      }
    }' \
    | grep -vE ',(0\.|10\.|127\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)' \
    | sort -u \
    > "$cache.tmp"
  mv "$cache.tmp" "$cache"
}
export -f ensure_ips_cache

# Dispatch (src, cache) pairs to workers — xargs -n 2 hands each pair to a
# fresh bash that calls ensure_*_cache "$src" "$cache".
# Args: $1 = function name, $2 = name of cache array variable (peers/stake/ippeers).
run_parallel() {
  local fn="$1" cache_arr="$2"
  local n=${#FILES[@]}
  for ((i=0; i<n; i++)); do
    eval "printf '%s\\0%s\\0' \"\${FILES[$i]}\" \"\${${cache_arr}[$i]}\""
  done | xargs -0 -n 2 -P "$NPROC" bash -c "$fn \"\$0\" \"\$1\""
}

phase_start "Extracting recent peers"
run_parallel ensure_peers_cache PEERS_CACHE
{
  echo "timestamp,peer_id"
  for c in "${PEERS_CACHE[@]}"; do cat "$c"; done
} > peers_recent.csv
echo "Wrote peers_recent.csv" >&2
phase_end

# Stake series is fed to plot_stake.py which draws a single line — sort by
# timestamp because rg's output across files is not time-ordered.
phase_start "Extracting stake events"
run_parallel ensure_stake_cache STAKE_CACHE
{
  echo "timestamp,total_stake"
  for c in "${STAKE_CACHE[@]}"; do cat "$c"; done | sort -t, -k1,1
} > stake_recent.csv
echo "Wrote stake_recent.csv" >&2
phase_end

phase_start "Extracting IP/peer mappings"
run_parallel ensure_ippeers_cache IPPEERS_CACHE
# Each per-file cache is already sorted+unique → sort -m -u merges them.
{
  echo "ip,peer_id"
  sort -m -u "${IPPEERS_CACHE[@]}"
} > ip_peers_recent.csv
echo "Wrote ip_peers_recent.csv" >&2
phase_end

phase_start "Extracting IP timeseries"
run_parallel ensure_ips_cache IPS_CACHE
{
  echo "timestamp,ip"
  for c in "${IPS_CACHE[@]}"; do cat "$c"; done
} > ips_recent.csv
echo "Wrote ips_recent.csv" >&2
phase_end

# Manifest is written last so a crash mid-extraction leaves it stale → next
# run will redo work rather than skipping based on a half-built state.
echo "$CURRENT_MANIFEST" > "$MANIFEST_FILE"
