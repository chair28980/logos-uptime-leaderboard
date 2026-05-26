#!/bin/bash
set -euo pipefail

# Fetch the most recent hourly logs for a node from the devnet index server.
#
# Window is selected by whole days (DAYS, default) or, if HOURS is set, by an
# exact rolling hour window (HOURS takes precedence). Hour matching compares the
# YYYY-MM-DD-HH stamp in the filename against (now - HOURS) in UTC.
#
# Auth: AUTH must be set to "user:password" (HTTP basic). Get credentials from
# whoever runs the index server — they are not checked into the repo.
#
# Usage:
#   AUTH=user:password ./fetch_logs.sh                 # node 0, 7 days
#   AUTH=user:password NODE=2 DAYS=3 ./fetch_logs.sh   # node 2, last 3 days
#   AUTH=user:password NODE=1 HOURS=50 ./fetch_logs.sh # node 1, last 50 hours

if [[ -z "${AUTH:-}" ]]; then
    echo "ERROR: AUTH env var is required (format: user:password)." >&2
    echo "  e.g. AUTH=user:password ./fetch_logs.sh" >&2
    exit 2
fi

NODE="${NODE:-0}"
DAYS="${DAYS:-7}"
HOURS="${HOURS:-}"
PARALLEL="${PARALLEL:-8}"
BASE_URL="https://testnet.blockchain.logos.co/internal/node-data/${NODE}"
DEST_DIR="logs/${NODE}"

mkdir -p "${DEST_DIR}"

echo "Fetching index for ${BASE_URL}/ ..."
INDEX_HTML="$(curl -fsS -u "${AUTH}" "${BASE_URL}/")"

# Extract log filenames of the form: logos-blockchain.log.YYYY-MM-DD-HH
ALL_LOGS=()
while IFS= read -r line; do
    ALL_LOGS+=("${line}")
done < <(
    printf '%s\n' "${INDEX_HTML}" \
        | grep -oE 'logos-blockchain\.log\.[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2}' \
        | sort -u
)

if [[ ${#ALL_LOGS[@]} -eq 0 ]]; then
    echo "No log files found at ${BASE_URL}/" >&2
    exit 1
fi

TO_FETCH=()
if [[ -n "${HOURS}" ]]; then
    # Exact rolling window: keep logs whose YYYY-MM-DD-HH stamp is at or after
    # (now - HOURS) in UTC. Stamps are zero-padded, so string comparison is
    # chronological.
    if date -u -v-1H +%Y >/dev/null 2>&1; then
        CUTOFF="$(date -u -v-"${HOURS}"H +%Y-%m-%d-%H)"        # BSD/macOS
    else
        CUTOFF="$(date -u -d "${HOURS} hours ago" +%Y-%m-%d-%H)"  # GNU
    fi
    echo "Keeping logs at or after ${CUTOFF} (last ${HOURS}h, UTC)"
    for log in "${ALL_LOGS[@]}"; do
        ts="${log##*.}"  # YYYY-MM-DD-HH
        if [[ ! "${ts}" < "${CUTOFF}" ]]; then  # ts >= CUTOFF
            TO_FETCH+=("${log}")
        fi
    done
else
    # Determine the latest N unique dates and keep only logs from those dates.
    KEEP_DATES=()
    while IFS= read -r line; do
        KEEP_DATES+=("${line}")
    done < <(
        printf '%s\n' "${ALL_LOGS[@]}" \
            | sed -E 's/.*\.([0-9]{4}-[0-9]{2}-[0-9]{2})-[0-9]{2}$/\1/' \
            | sort -u \
            | tail -n "${DAYS}"
    )

    echo "Keeping logs from ${#KEEP_DATES[@]} day(s): ${KEEP_DATES[*]}"

    for log in "${ALL_LOGS[@]}"; do
        for d in "${KEEP_DATES[@]}"; do
            if [[ "${log}" == *".${d}-"* ]]; then
                TO_FETCH+=("${log}")
                break
            fi
        done
    done
fi

echo "Downloading ${#TO_FETCH[@]} files into ${DEST_DIR}/ (parallel=${PARALLEL}) ..."

download_one() {
    local log="$1"
    local out="${DEST_DIR}/${log}"
    if [[ -f "${out}" ]]; then
        echo "  resume  ${log}"
    else
        echo "  fetch   ${log}"
    fi
    curl -fS --progress-bar --retry 3 --retry-delay 2 -C - -u "${AUTH}" \
        -o "${out}" "${BASE_URL}/${log}" 2>&1 \
        | tr '\r' '\n' \
        | awk -v f="${log}" 'NF { print "  " f ": " $0; fflush() }'
}
export -f download_one
export DEST_DIR BASE_URL AUTH

printf '%s\n' "${TO_FETCH[@]}" \
    | xargs -P "${PARALLEL}" -I{} bash -c 'download_one "$1"' _ {}

echo "Done. ${#TO_FETCH[@]} file(s) in ${DEST_DIR}/"
