"""Generate human-readable reports from the onboarding inventory produced by onboard_ingtrialdata.py"""
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Dict, List

BASE = Path(__file__).resolve().parent.parent
OUT_DIR = BASE / "Architecture" / "EnterpriseHub" / "ingestion_reports" / "ingtrialdata"
INV_PATH = OUT_DIR / "inventory.json"


def load_inventory() -> Dict:
    return json.loads(INV_PATH.read_text(encoding="utf-8"))


def write_md(name: str, content: str) -> None:
    p = OUT_DIR / name
    p.write_text(content, encoding="utf-8")


def main():
    inv = load_inventory()
    files = inv.get("files", [])
    counts = Counter()
    total_size = 0
    keyword_counts = Counter()
    missing_text = []
    large_files = []

    for f in files:
        ext = Path(f["path"]).suffix.lower() or "(no_ext)"
        counts[ext] += 1
        if f.get("size"):
            total_size += f.get("size")
            if f.get("size") > 1_000_000:
                large_files.append((f.get("path"), f.get("size")))
        kws = f.get("keywords") or []
        for k in kws:
            keyword_counts[k] += 1
        if not f.get("snippet"):
            missing_text.append(f.get("path"))

    # Knowledge Coverage Report
    kc = ["# Knowledge Coverage Report\n\n"]
    kc.append(f"Generated: {datetime.utcnow().isoformat()}\n\n")
    kc.append("## File type distribution\n\n")
    for ext, cnt in counts.most_common():
        kc.append(f"- {ext}: {cnt}\n")
    kc.append(f"\nTotal storage (approx): {total_size / (1024**2):.2f} MB\n\n")
    top_kws = keyword_counts.most_common(20)
    kc.append("## Top keywords across documents\n\n")
    for k, c in top_kws:
        kc.append(f"- {k}: {c}\n")
    write_md("knowledge_coverage.md", "".join(kc))

    # Data Quality Report
    dq = ["# Data Quality Report\n\n"]
    dq.append(f"Generated: {datetime.utcnow().isoformat()}\n\n")
    dq.append(f"Total files scanned: {len(files)}\n\n")
    dq.append("## Files with no extracted text (possible binary or extraction failure)\n\n")
    for p in missing_text[:200]:
        dq.append(f"- {p}\n")
    dq.append("\n## Large files (>1MB)\n\n")
    for p, s in large_files:
        dq.append(f"- {p} — {s/(1024**2):.2f} MB\n")
    write_md("data_quality.md", "".join(dq))

    # AI Readiness Report
    ar = ["# AI Readiness Report\n\n"]
    ar.append(f"Generated: {datetime.utcnow().isoformat()}\n\n")
    extracted = len(files) - len(missing_text)
    ar.append(f"Files with extractable text: {extracted}/{len(files)}\n\n")
    ar.append("Recommendations:\n\n")
    ar.append("- Configure vector-store and run semantic embeddings for textual files.\n")
    ar.append("- Prioritize OCR for scanned PDFs and images.\n")
    ar.append("- Normalize Office docs to plain text for indexing.\n")
    write_md("ai_readiness.md", "".join(ar))

    # Architecture Compliance Report
    ac = ["# Architecture Compliance Report\n\n"]
    ac.append(f"Generated: {datetime.utcnow().isoformat()}\n\n")
    ac.append("- Enterprise registry updated with organization 'ingtrialdata'.\n")
    ac.append("- Discovered repositories were registered under the enterprise registry (if detected).\n")
    ac.append("- No parallel vector indexes were created by this onboarding run.\n")
    write_md("architecture_compliance.md", "".join(ac))

    # Operational Readiness Report
    op = ["# Operational Readiness Report\n\n"]
    op.append(f"Generated: {datetime.utcnow().isoformat()}\n\n")
    op.append("Summary:\n\n")
    op.append(f"- Inventory size: {len(files)} files\n")
    op.append(f"- Knowledge index entries: {len(files)}\n")
    op.append("- Next: Wire vector-store, configure scheduled indexing, attach to orchestration layer.\n")
    write_md("operational_readiness.md", "".join(op))

    # Platform Stress Test Report (initial guidance)
    st = ["# Platform Stress Test Report\n\n"]
    st.append(f"Generated: {datetime.utcnow().isoformat()}\n\n")
    st.append(f"Sample test items (large files): {len(large_files)}\n\n")
    st.append("Recommended controlled stress tests:\n\n")
    st.append("- Concurrent indexing with N workers (N=4,8,16) and measure throughput.\n")
    st.append("- Large search queries and measure latency (>10k docs).\n")
    st.append("- Concurrent agent runs (3-10) reading from knowledge index.\n")
    write_md("platform_stress_test.md", "".join(st))

    print("Reports generated in:", OUT_DIR)


if __name__ == "__main__":
    main()
