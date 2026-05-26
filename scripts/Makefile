PYTHON ?= python3
DAYS ?= 7
LOG_DIR ?= logs/0

.PHONY: fetch extract olympics refresh

fetch:
	DAYS=$(DAYS) bash fetch_logs.sh

extract:
	DAYS=$(DAYS) LOG_DIR=$(LOG_DIR) bash extract_recent_rg.sh

olympics: extract
	DAYS=$(DAYS) $(PYTHON) uptime_olympics.py

refresh: fetch extract olympics
