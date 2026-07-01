"""Onboarding script for INGTrialData demo organization.

Performs phases: discovery, inventory, basic ingestion (text extraction), duplicate detection,
registry registration and report generation. Outputs saved under Architecture/EnterpriseHub/ingestion_reports/ingtrialdata.

Designed to be idempotent and safe: it will not modify source files, only write reports and update the enterprise registry.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

try:
    import yaml
except Exception:
    yaml = None

try:
    import pandas as pd
except Exception:
    pd = None

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

try:
    import docx
except Exception:
    docx = None

try:
    import pytesseract
    from PIL import Image
except Exception:
    pytesseract = None
    Image = None

BASE = Path(__file__).resolve().parent.parent
REG_PATH = BASE / "Architecture" / "EnterpriseHub" / "enterprise_registry.yaml"
OUT_DIR = BASE / "Architecture" / "EnterpriseHub" / "ingestion_reports" / "ingtrialdata"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def read_demo_pack_list(path: Path) -> List[str]:
    txt = path.read_text(encoding="utf-8", errors="ignore")
    lines = [ln.strip() for ln in txt.splitlines() if ln.strip()]
    return lines


def normalize_path(p: str) -> Path:
    # Expand env vars and user
    p = os.path.expandvars(p)
    p = os.path.expanduser(p)
    return Path(p)


def collect_assets(entry: str) -> List[Path]:
    p = normalize_path(entry)
    if p.exists():
        if p.is_dir():
            # gather files, but avoid very large scans: limit depth and count
            files = list(p.rglob("*"))
            files = [f for f in files if f.is_file()][:5000]
            return files
        else:
            return [p]
    # Try to interpret as a path under BASE
    candidate = BASE / entry
    if candidate.exists():
        if candidate.is_dir():
            files = list(candidate.rglob("*"))
            files = [f for f in files if f.is_file()][:5000]
            return files
        return [candidate]
    return []


def sha256_of_file(p: Path) -> str:
    h = hashlib.sha256()
    try:
        with p.open("rb") as fh:
            for chunk in iter(lambda: fh.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return ""


STOPWORDS = set(
    "the a an and or of in on for to with by from at as is are be this that it its".split()
)


def extract_text_basic(p: Path, max_chars: int = 2000) -> str:
    ext = p.suffix.lower()
    try:
        if ext in (".txt", ".md", ".json", ".csv", ".py", ".yaml", ".yml", ".html"):
            return p.read_text(encoding="utf-8", errors="ignore")[:max_chars]
        if ext in (".pdf",) and PdfReader:
            try:
                r = PdfReader(str(p))
                texts = []
                for page in r.pages[:10]:
                    texts.append(page.extract_text() or "")
                return "\n".join(texts)[:max_chars]
            except Exception:
                return ""
        if ext in (".docx",) and docx:
            try:
                doc = docx.Document(str(p))
                return "\n".join([p.text for p in doc.paragraphs])[:max_chars]
            except Exception:
                return ""
        if ext in (".png", ".jpg", ".jpeg",) and pytesseract and Image:
            try:
                img = Image.open(p)
                return pytesseract.image_to_string(img)[:max_chars]
            except Exception:
                return ""
    except Exception:
        return ""
    return ""


def top_keywords(text: str, top_n: int = 10) -> List[str]:
    if not text:
        return []
    toks = re.findall(r"\w+", text.lower())
    toks = [t for t in toks if t not in STOPWORDS and len(t) > 2]
    freq: Dict[str, int] = {}
    for t in toks:
        freq[t] = freq.get(t, 0) + 1
    items = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:top_n]
    return [k for k, _ in items]


def detect_repo_root(p: Path) -> Optional[Path]:
    cur = p.resolve()
    for _ in range(10):
        if (cur / ".git").exists() or (cur / "package.json").exists() or (cur / "requirements.txt").exists():
            return cur
        if cur == cur.parent:
            break
        cur = cur.parent
    return None


def load_registry() -> Dict:
    if not REG_PATH.exists():
        return {}
    if yaml:
        return yaml.safe_load(REG_PATH.read_text(encoding="utf-8")) or {}
    try:
        return json.loads(REG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_registry(reg: Dict) -> bool:
    try:
        if yaml:
            REG_PATH.write_text(yaml.safe_dump(reg, sort_keys=False), encoding="utf-8")
        else:
            REG_PATH.write_text(json.dumps(reg, indent=2), encoding="utf-8")
        return True
    except Exception:
        return False


def register_org(reg: Dict) -> None:
    orgs = reg.setdefault("organizations", [])
    oid = "ingtrialdata"
    if any(o.get("id") == oid for o in orgs):
        return
    org = {
        "id": oid,
        "name": "ING Trial Data Demo",
        "status": "active",
        "type": "DEMO",
        "owner": "CTA",
        "environment": "Sandbox",
        "purpose": "Enterprise Platform Validation",
        "registered_at": datetime.utcnow().isoformat(),
    }
    orgs.append(org)
    reg["default_organization"] = reg.get("default_organization") or "cta"


def main():
    print("=== INGTrialData onboarding start ===")
    demo_list_file = BASE / "DEMO PACK INFO PATH 30 06 2026.txt"
    if not demo_list_file.exists():
        print("Demo pack descriptor not found:", demo_list_file)
        return

    entries = read_demo_pack_list(demo_list_file)
    print(f"Found {len(entries)} entries in demo descriptor")

    all_assets: List[Path] = []
    missing: List[str] = []
    for e in entries:
        assets = collect_assets(e)
        if assets:
            all_assets.extend(assets)
        else:
            missing.append(e)

    # Deduplicate by path
    unique_assets = []
    seen = set()
    for p in all_assets:
        try:
            rp = str(p.resolve())
        except Exception:
            rp = str(p)
        if rp in seen:
            continue
        seen.add(rp)
        unique_assets.append(p)

    print(f"Discovered {len(unique_assets)} unique asset files; {len(missing)} missing entries")

    inventory = []
    hash_map: Dict[str, List[str]] = {}
    repo_set = set()
    for p in unique_assets:
        meta = {"path": str(p), "exists": p.exists(), "size": None, "sha256": None, "snippet": None, "keywords": []}
        try:
            if p.exists():
                meta["size"] = p.stat().st_size
                meta["sha256"] = sha256_of_file(p)
                text = extract_text_basic(p)
                meta["snippet"] = (text[:1000] + "…") if text else ""
                meta["keywords"] = top_keywords(text, top_n=8)
                if meta["sha256"]:
                    hash_map.setdefault(meta["sha256"], []).append(str(p))
                repo_root = detect_repo_root(p)
                if repo_root:
                    try:
                        repo_set.add(str(repo_root.relative_to(BASE)))
                    except Exception:
                        repo_set.add(str(repo_root))
        except Exception as exc:
            meta["error"] = str(exc)
        inventory.append(meta)

    duplicates = {h: ps for h, ps in hash_map.items() if len(ps) > 1}

    # Save inventory
    inv_path = OUT_DIR / "inventory.json"
    inv_path.write_text(json.dumps({"generated_at": datetime.utcnow().isoformat(), "files": inventory, "missing": missing}, indent=2), encoding="utf-8")

    # Save simple knowledge index (metadata + keywords)
    ki = {str(item["path"]): {"keywords": item.get("keywords", []), "sha256": item.get("sha256"), "size": item.get("size")} for item in inventory}
    (OUT_DIR / "knowledge_index.json").write_text(json.dumps(ki, indent=2), encoding="utf-8")

    # Save duplicates report
    (OUT_DIR / "duplicates.json").write_text(json.dumps(duplicates, indent=2), encoding="utf-8")

    # Update registry
    reg = load_registry()
    register_org(reg)
    # Add repositories discovered
    repos = reg.setdefault("repositories", [])
    for r in sorted(repo_set):
        if not any(rr.get("id") == Path(r).name for rr in repos):
            repos.append({"id": Path(r).name, "path": r, "manifests": []})
    save_registry(reg)

    # Generate simple reports
    summary = {
        "organization": "ING Trial Data Demo",
        "discovered_files": len(inventory),
        "missing_entries": missing,
        "duplicate_groups": len(duplicates),
        "repositories_registered": sorted(list(repo_set)),
    }
    (OUT_DIR / "onboarding_report.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    # Human readable executive summary
    exec_path = OUT_DIR / "executive_summary.md"
    with exec_path.open("w", encoding="utf-8") as fh:
        fh.write(f"# Executive Summary — ING Trial Data Demo\n\n")
        fh.write(f"Generated: {datetime.utcnow().isoformat()}\n\n")
        fh.write(f"Discovered files: {len(inventory)}\n\n")
        fh.write("## Top findings\n\n")
        fh.write(f"- Missing entries: {len(missing)}\n")
        fh.write(f"- Duplicate groups: {len(duplicates)}\n")
        fh.write(f"- Repositories auto-registered: {', '.join(sorted(list(repo_set))) or '(none)'}\n\n")
        fh.write("## Next recommended steps\n\n")
        fh.write("1. Review missing entries and provide access to external folders (OneDrive paths).\n")
        fh.write("2. Run a deeper content extraction for PDFs and Office documents (requires optional tools).\n")
        fh.write("3. Configure vector-store provider and run semantic indexing.\n")

    print("=== Onboarding completed. Reports saved to:", OUT_DIR)


if __name__ == "__main__":
    main()
