#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

PYTHON_CMD=""
if command -v python >/dev/null 2>&1; then
  PYTHON_CMD="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_CMD="python3"
else
  echo "[ERROR] Python was not found on PATH."
  echo "Please install Python 3.8+ and try again."
  exit 1
fi

"${PYTHON_CMD}" launcher.py "$@"
