#!/usr/bin/env bash
set -euo pipefail

COMMIT=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --commit) COMMIT=true; shift ;;
    -h|--help) echo "Usage: $0 [--commit]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

targets=(
  "Adaptive Sales Engine - Lovable_files/"
  "Adaptive Sales Engine - Lovable.html"
  dist
  public
)

echo "Targets to untrack:"
for t in "${targets[@]}"; do
  echo " - $t"
done

for t in "${targets[@]}"; do
  if command -v git >/dev/null 2>&1; then
    git rm --cached -r --ignore-unmatch "$t" || true
  else
    echo "git not found; run manually: git rm --cached -r --ignore-unmatch \"$t\""
  fi
done

if [ "$COMMIT" = true ]; then
  if command -v git >/dev/null 2>&1; then
    git add -A
    git commit -m "chore: remove checked-in build artifacts and update .gitignore"
  else
    echo "git not found; please commit changes manually."
  fi
fi

echo "Done. Inspect 'git status' for remaining changes."
