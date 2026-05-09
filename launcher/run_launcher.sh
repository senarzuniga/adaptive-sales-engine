#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] python3 was not found on PATH."
  echo "Please install Python 3.8+ and try again."
  exit 1
fi

python3 launcher.py "$@"
