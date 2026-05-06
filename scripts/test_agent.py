#!/usr/bin/env python3
"""
Test script: loads data from AGENT_INPUT_FILE (or data/test_upload.csv) and
writes a summary to outputs/test.txt.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    import pandas as pd

    input_file = os.getenv("AGENT_INPUT_FILE", str(ROOT / "data" / "test_upload.csv"))
    df = pd.read_csv(input_file)

    summary_lines = [
        "=== Test Agent Summary ===",
        f"Rows: {len(df)}",
        f"Columns: {', '.join(df.columns.tolist())}",
        "",
        "First 3 rows:",
        df.head(3).to_string(),
    ]
    summary = "\n".join(summary_lines)

    output_path = ROOT / "outputs" / "test.txt"
    output_path.parent.mkdir(exist_ok=True)
    output_path.write_text(summary, encoding="utf-8")

    print(summary)
    print(f"\n✅ Output saved to {output_path}")
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
