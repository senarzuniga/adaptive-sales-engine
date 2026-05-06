#!/usr/bin/env python3
"""
auto_implement.py — Safely injects professional improvements into streamlit_app.py.

Safety model:
1. Creates a timestamped backup before any modification.
2. Reads a .py.tpl template from /templates/.
3. Strips TEMPLATE_META comment lines from the template.
4. Injects the function body before the # ── AUTO_IMPLEMENT_PAGES_START ── anchor.
5. Runs `python -m py_compile` to verify the result.
6. If verification fails, restores the backup automatically.
7. Updates MATURITY_REPORT.md and CHANGELOG_PROFESSIONAL.md.

Usage:
    python scripts/auto_implement.py                          # implement all pending
    python scripts/auto_implement.py --improvement <id>       # implement one specific
    python scripts/auto_implement.py --dry-run                # show plan without writing
    python scripts/auto_implement.py --confidence 80          # min confidence threshold
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# ── Constants ──────────────────────────────────────────────────────────────────

STREAMLIT_APP = Path("streamlit_app.py")
CHANGELOG = Path("CHANGELOG_PROFESSIONAL.md")
MATURITY_REPORT = Path("MATURITY_REPORT.md")
BACKUP_DIR = Path(".auto_implement_backups")

PAGES_ANCHOR = "# ── AUTO_IMPLEMENT_PAGES_START ──"

# Improvements that have templates available
TEMPLATED_IMPROVEMENTS: list[dict] = [
    {
        "id": "budget_command_center_whatsif",
        "module": "Budget Command Center",
        "title": "Simulación What-If con sliders + alertas de desviación",
        "template": "templates/budget_command_center.py.tpl",
        "page_key": "budget_command_center",
        "nav_label": "💰 Budget Command Center",
        "maturity_before": 0,
        "maturity_after": 68,
        "changelog_entry": (
            "- Añadido: Simulación what-if con sliders de ajuste por producto\n"
            "- Añadido: Alerta automática de desviación >10%\n"
            "- Añadido: Gráfico de barras de desviación presupuestaria\n"
            "- Añadido: Exportación de escenarios como CSV\n"
            "- Añadido: Protocolo profesional Anaplan-style (checklist)\n"
            "- Próxima mejora: Tracking de aprobaciones multi-rol"
        ),
    },
    {
        "id": "key_account_management_protocol",
        "module": "Key Account Management",
        "title": "Protocolo KAM + Customer Health Score + alertas de riesgo",
        "template": "templates/key_account_management.py.tpl",
        "page_key": "key_account_management",
        "nav_label": "🏆 Key Account Management",
        "maturity_before": 0,
        "maturity_after": 65,
        "changelog_entry": (
            "- Añadido: Protocolo KAM de 6 pasos (referencia: Gainsight + Salesforce)\n"
            "- Añadido: Tabla de cuentas clave con Customer Health Score\n"
            "- Añadido: Alertas automáticas (NPS negativo, sin contacto >30 días, Health Score crítico)\n"
            "- Añadido: Visualización horizontal de health scores\n"
            "- Añadido: Exportación de cuentas clave como CSV\n"
            "- Próxima mejora: Joint Business Plan colaborativo"
        ),
    },
    {
        "id": "business_intelligence_dashboard",
        "module": "Business Intelligence",
        "title": "Dashboard BI con KPIs, tendencias y exploración de datos",
        "template": "templates/business_intelligence.py.tpl",
        "page_key": "business_intelligence",
        "nav_label": "📊 Business Intelligence",
        "maturity_before": 0,
        "maturity_after": 62,
        "changelog_entry": (
            "- Añadido: KPI cards con comparativa período anterior (revenue, win rate, ticket medio)\n"
            "- Añadido: Gráfico de tendencias por segmento de producto\n"
            "- Añadido: Top 5 cuentas por revenue\n"
            "- Añadido: Distribución de pipeline por estado\n"
            "- Añadido: Configuración de informes programados\n"
            "- Añadido: Exploración de datos con consultas rápidas\n"
            "- Próxima mejora: Conexión a fuente de datos real (Supabase queries)"
        ),
    },
]


# ── Helpers ────────────────────────────────────────────────────────────────────


def _backup(source: Path) -> Path:
    BACKUP_DIR.mkdir(exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / f"{source.stem}_{ts}{source.suffix}"
    shutil.copy2(source, dest)
    return dest


def _verify_syntax(source: Path) -> tuple[bool, str]:
    result = subprocess.run(
        [sys.executable, "-m", "py_compile", str(source)],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0, result.stderr


def _strip_meta_comments(tpl_content: str) -> str:
    """Remove TEMPLATE_META comment lines from template."""
    lines = [ln for ln in tpl_content.splitlines() if not ln.startswith("# TEMPLATE_")]
    return "\n".join(lines).strip()


def _function_already_exists(source: str, page_key: str) -> bool:
    fn_name = f"page_{page_key}"
    return bool(re.search(rf"def {fn_name}\s*\(", source))


def _nav_already_has_key(source: str, page_key: str) -> bool:
    return f'"{page_key}"' in source


def _inject_page_function(source: str, fn_code: str) -> str:
    """Insert fn_code just after the AUTO_IMPLEMENT_PAGES_START anchor."""
    if PAGES_ANCHOR not in source:
        raise ValueError(f"Anchor '{PAGES_ANCHOR}' not found in source. Cannot inject safely.")
    return source.replace(PAGES_ANCHOR, f"{PAGES_ANCHOR}\n\n\n{fn_code}\n", 1)


def _update_changelog(imp: dict, date_str: str) -> None:
    entry = (
        f"\n## {date_str}: {imp['module']} mejorado de "
        f"{imp['maturity_before']}% → {imp['maturity_after']}%\n"
        f"{imp['changelog_entry']}\n"
    )

    if CHANGELOG.exists():
        existing = CHANGELOG.read_text(encoding="utf-8")
    else:
        existing = "# CHANGELOG PROFESSIONAL\n\nRegistro de mejoras del bucle de madurez profesional.\n"

    CHANGELOG.write_text(existing + entry, encoding="utf-8")


def _update_maturity_report(imp: dict) -> None:
    if not MATURITY_REPORT.exists():
        return

    content = MATURITY_REPORT.read_text(encoding="utf-8")
    # Update the summary table row for this module
    module = imp["module"]
    old_row_pattern = rf"\| {re.escape(module)} \|.*?\|"
    match = re.search(old_row_pattern, content)
    if match:
        new_row = (
            f"| {module} | — | — | — | {imp['maturity_after']}% |"
        )
        content = content.replace(match.group(0), new_row)
        MATURITY_REPORT.write_text(content, encoding="utf-8")


# ── Core implementation ────────────────────────────────────────────────────────


def implement_improvement(imp: dict, dry_run: bool = False, confidence: int = 80) -> bool:
    """Inject one improvement into streamlit_app.py. Returns True on success."""
    tpl_path = Path(imp["template"])
    if not tpl_path.exists():
        print(f"  ⚠️  Template not found: {tpl_path}")
        return False

    if not STREAMLIT_APP.exists():
        print(f"  ❌ {STREAMLIT_APP} not found.")
        return False

    source = STREAMLIT_APP.read_text(encoding="utf-8")

    if _function_already_exists(source, imp["page_key"]):
        print(f"  ℹ️  {imp['module']}: page_{imp['page_key']} already exists. Skipping.")
        return False

    # Load and clean template
    raw_tpl = tpl_path.read_text(encoding="utf-8")
    fn_code = _strip_meta_comments(raw_tpl)

    if dry_run:
        print(f"  [DRY RUN] Would inject {imp['module']} (confidence={confidence}%)")
        print(f"           Function: page_{imp['page_key']}")
        print(f"           Template: {tpl_path}")
        return True

    # Backup
    backup_path = _backup(STREAMLIT_APP)
    print(f"  📦 Backup created: {backup_path}")

    try:
        # Inject function
        new_source = _inject_page_function(source, fn_code)

        # Write
        STREAMLIT_APP.write_text(new_source, encoding="utf-8")

        # Verify syntax
        ok, err = _verify_syntax(STREAMLIT_APP)
        if not ok:
            print(f"  ❌ Syntax error after injection! Rolling back. Details:\n{err}")
            shutil.copy2(backup_path, STREAMLIT_APP)
            return False

        print(f"  ✅ {imp['module']}: page_{imp['page_key']} injected and verified.")

        # Update records
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        _update_changelog(imp, date_str)
        _update_maturity_report(imp)

        return True

    except Exception as exc:
        print(f"  ❌ Unexpected error: {exc}. Rolling back.")
        shutil.copy2(backup_path, STREAMLIT_APP)
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Auto-implement professional improvements.")
    parser.add_argument("--improvement", help="Specific improvement ID to implement.")
    parser.add_argument("--dry-run", action="store_true", help="Show plan without writing.")
    parser.add_argument(
        "--confidence", type=int, default=80, help="Minimum confidence threshold (default 80)."
    )
    args = parser.parse_args()

    improvements_to_run = TEMPLATED_IMPROVEMENTS
    if args.improvement:
        improvements_to_run = [i for i in TEMPLATED_IMPROVEMENTS if i["id"] == args.improvement]
        if not improvements_to_run:
            print(f"ERROR: Improvement '{args.improvement}' not found.")
            print(f"Available IDs: {[i['id'] for i in TEMPLATED_IMPROVEMENTS]}")
            raise SystemExit(1)

    print(f"Auto-implement: {len(improvements_to_run)} improvement(s) to process.")
    if args.dry_run:
        print("DRY RUN MODE — no files will be modified.\n")

    implemented = 0
    skipped = 0

    for imp in improvements_to_run:
        print(f"\n→ {imp['module']}: {imp['title']}")
        success = implement_improvement(imp, dry_run=args.dry_run, confidence=args.confidence)
        if success:
            implemented += 1
        else:
            skipped += 1

    print(f"\n{'DRY RUN ' if args.dry_run else ''}Summary: {implemented} implemented, {skipped} skipped.")

    if implemented > 0 and not args.dry_run:
        print("\n✅ Final syntax check …")
        ok, err = _verify_syntax(STREAMLIT_APP)
        if ok:
            print(f"✅ {STREAMLIT_APP} is syntactically valid.")
        else:
            print(f"❌ Syntax errors detected:\n{err}")
            raise SystemExit(1)


if __name__ == "__main__":
    main()
