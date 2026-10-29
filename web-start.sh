#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec gunicorn app:app --bind "0.0.0.0:${PORT:-8501}" --workers 1 --threads 2 --timeout 60
