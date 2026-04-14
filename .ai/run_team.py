"""
.ai/run_team.py — Autonomous AI Dev Team executor
==================================================
Follows the principles in .ai/agent_system_prompt.md:

  1. Analyse the repository
  2. Identify improvement opportunities
  3. Generate ≥2 hypotheses per area
  4. Compare and select the best option
  5. Apply only low-risk, validated changes
  6. Emit a structured report

Usage
-----
  python .ai/run_team.py [--dry-run] [--report-only]

Flags
-----
  --dry-run       Run all analysis steps but do NOT write any files.
  --report-only   Alias for --dry-run; print the report and exit.

Output
------
  .ai/reports/YYYY-MM-DD_HH-MM-SS.md
"""

from __future__ import annotations

import argparse
import ast
import json
import logging
import os
import subprocess
import sys
import textwrap
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ai-team")

# ─── Repo root ────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).parent.parent.resolve()
REPORTS_DIR = Path(__file__).parent / "reports"

# ─── Data structures ──────────────────────────────────────────────────────────


@dataclass
class Hypothesis:
    """Represents one candidate solution for an improvement area."""
    id: str
    description: str
    pros: list[str]
    cons: list[str]
    risk: str          # "low" | "medium" | "high"
    applicable: bool = False
    apply_fn: Callable[[], str] | None = field(default=None, repr=False)


@dataclass
class Finding:
    """One improvement opportunity with ≥2 hypotheses."""
    area: str                   # e.g. "Code Quality", "Architecture"
    description: str
    hypotheses: list[Hypothesis]
    selected: Hypothesis | None = None
    applied: bool = False
    result: str = ""


@dataclass
class Report:
    """Final structured output."""
    timestamp: str
    findings: list[Finding]
    applied_count: int = 0
    skipped_count: int = 0


# ─── Step 1: Repository analysis ─────────────────────────────────────────────


def analyse_repo() -> dict:
    """Return a snapshot of the repository: file counts, languages, etc."""
    log.info("Step 1 — Analysing repository structure …")

    snapshot: dict = {
        "root": str(REPO_ROOT),
        "files": {},
        "python_syntax_errors": [],
        "large_files": [],
        "missing_tests": False,
    }

    extensions: dict[str, int] = {}
    for path in REPO_ROOT.rglob("*"):
        if path.is_file() and not _is_ignored(path):
            ext = path.suffix.lower() or "(no ext)"
            extensions[ext] = extensions.get(ext, 0) + 1

            # Flag large files (> 500 lines)
            try:
                lines = path.read_text(errors="ignore").count("\n")
                if lines > 500:
                    snapshot["large_files"].append(
                        {"path": str(path.relative_to(REPO_ROOT)), "lines": lines}
                    )
            except OSError:
                pass

    snapshot["files"] = extensions

    # Python syntax check
    for py_file in REPO_ROOT.rglob("*.py"):
        if _is_ignored(py_file):
            continue
        try:
            ast.parse(py_file.read_text(encoding="utf-8", errors="ignore"))
        except SyntaxError as exc:
            snapshot["python_syntax_errors"].append(
                {"file": str(py_file.relative_to(REPO_ROOT)), "error": str(exc)}
            )

    # Check for test directory / files
    test_dirs = list(REPO_ROOT.rglob("__tests__")) + list(REPO_ROOT.rglob("tests"))
    test_files = list(REPO_ROOT.rglob("*.test.*")) + list(REPO_ROOT.rglob("*.spec.*"))
    snapshot["missing_tests"] = not test_dirs and not test_files

    log.info("  Extensions found: %s", ", ".join(extensions.keys()))
    log.info("  Large files: %d", len(snapshot["large_files"]))
    log.info("  Python syntax errors: %d", len(snapshot["python_syntax_errors"]))
    log.info("  Tests detected: %s", not snapshot["missing_tests"])

    return snapshot


# ─── Step 2: Identify improvements ───────────────────────────────────────────


def identify_improvements(snapshot: dict) -> list[Finding]:
    """Map snapshot observations to improvement areas."""
    log.info("Step 2 — Identifying improvement opportunities …")
    findings: list[Finding] = []

    # ── A: Python syntax errors ───────────────────────────────────────────────
    if snapshot["python_syntax_errors"]:
        errors = snapshot["python_syntax_errors"]
        findings.append(Finding(
            area="Code Quality — Python Syntax",
            description=f"{len(errors)} Python file(s) contain syntax errors.",
            hypotheses=_hypotheses_python_syntax(errors),
        ))

    # ── B: Missing test infrastructure ────────────────────────────────────────
    if snapshot["missing_tests"]:
        findings.append(Finding(
            area="Testing — Missing Test Infrastructure",
            description="No test files or test directories found in the repository.",
            hypotheses=_hypotheses_missing_tests(),
        ))

    # ── C: Large files ────────────────────────────────────────────────────────
    very_large = [f for f in snapshot["large_files"] if f["lines"] > 1000]
    if very_large:
        findings.append(Finding(
            area="Architecture — Oversized Files",
            description=(
                f"{len(very_large)} file(s) exceed 1 000 lines and may benefit "
                "from modularisation."
            ),
            hypotheses=_hypotheses_large_files(very_large),
        ))

    # ── D: Missing .ai/reports directory ──────────────────────────────────────
    if not REPORTS_DIR.exists():
        findings.append(Finding(
            area="Tooling — Missing Reports Directory",
            description="The .ai/reports/ directory does not exist yet.",
            hypotheses=_hypotheses_create_reports_dir(),
        ))

    log.info("  Findings: %d", len(findings))
    return findings


# ─── Step 3 & 4: Compare hypotheses and select best ──────────────────────────

RISK_SCORE = {"low": 0, "medium": 1, "high": 2}


def compare_and_select(findings: list[Finding]) -> None:
    """
    For each finding, score its hypotheses and mark the best one as selected.
    Scoring: more pros → better; more cons → worse; higher risk → worse.
    Only hypotheses with applicable=True are eligible for application.
    """
    log.info("Step 3 & 4 — Comparing hypotheses and selecting best options …")
    for finding in findings:
        best: Hypothesis | None = None
        best_score = -9999
        for h in finding.hypotheses:
            score = len(h.pros) - len(h.cons) - RISK_SCORE[h.risk] * 2
            log.info(
                "  [%s] Hypothesis '%s' — score %d (risk=%s, applicable=%s)",
                finding.area, h.id, score, h.risk, h.applicable,
            )
            if score > best_score:
                best_score = score
                best = h
        finding.selected = best


# ─── Step 5: Apply changes ────────────────────────────────────────────────────


def apply_changes(findings: list[Finding], dry_run: bool) -> None:
    """Apply the selected hypothesis for each finding (if low risk and applicable)."""
    log.info("Step 5 — Applying changes (dry_run=%s) …", dry_run)
    for finding in findings:
        h = finding.selected
        if not h:
            log.warning("  No hypothesis selected for '%s' — skipping.", finding.area)
            continue
        if h.risk != "low":
            finding.result = (
                f"[SKIPPED] Risk '{h.risk}' is too high for automatic application. "
                "Recommend manual review."
            )
            log.info("  Skipping '%s' (risk=%s).", finding.area, h.risk)
            continue
        if not h.applicable or not h.apply_fn:
            finding.result = "[SKIPPED] No automatic fix available for this hypothesis."
            log.info("  Skipping '%s' (not auto-applicable).", finding.area)
            continue
        if dry_run:
            finding.result = f"[DRY RUN] Would apply: {h.description}"
            log.info("  DRY RUN — would apply '%s'.", h.id)
            continue
        try:
            finding.result = h.apply_fn()
            finding.applied = True
            log.info("  Applied '%s': %s", h.id, finding.result)
        except Exception as exc:  # noqa: BLE001
            finding.result = f"[ERROR] {exc}"
            log.error("  Failed to apply '%s': %s", h.id, exc)


# ─── Step 6: Generate report ──────────────────────────────────────────────────


def generate_report(findings: list[Finding]) -> Report:
    """Compile all findings into a Report object."""
    applied = sum(1 for f in findings if f.applied)
    skipped = len(findings) - applied
    ts = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    return Report(timestamp=ts, findings=findings, applied_count=applied, skipped_count=skipped)


def render_report(report: Report) -> str:
    """Render the report as Markdown following the mandatory structure."""
    lines: list[str] = [
        f"# AI Dev Team Report — {report.timestamp}",
        "",
        f"**Applied:** {report.applied_count}  |  **Skipped/Recommended:** {report.skipped_count}",
        "",
        "---",
        "",
    ]
    for finding in report.findings:
        lines += [
            f"## {finding.area}",
            "",
            f"> {finding.description}",
            "",
            "### Final Solution",
            "",
        ]
        sel = finding.selected
        if sel:
            lines.append(f"**{sel.id}** — {sel.description}")
        else:
            lines.append("_No hypothesis selected._")
        lines += ["", "### Justification", ""]
        if sel:
            lines.append(f"Selected because it has the best pros/cons/risk balance "
                         f"(risk: {sel.risk}).")
            if sel.pros:
                lines.append("")
                lines.append("Pros:")
                for p in sel.pros:
                    lines.append(f"- {p}")
        lines += ["", "### Alternatives", ""]
        for h in finding.hypotheses:
            if sel and h.id == sel.id:
                continue
            lines.append(f"**{h.id}** — {h.description}")
            if h.cons:
                for c in h.cons:
                    lines.append(f"  - Con: {c}")
        lines += ["", "### Risks", ""]
        if sel:
            for c in (sel.cons or ["None identified."]):
                lines.append(f"- {c}")
        lines += ["", "**Result:** " + (finding.result or "_Not applied._"), "", "---", ""]

    return "\n".join(lines)


def save_report(report: Report, rendered: str, dry_run: bool) -> Path:
    """Write the report to .ai/reports/."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out = REPORTS_DIR / f"{report.timestamp}.md"
    if not dry_run:
        out.write_text(rendered, encoding="utf-8")
        log.info("Report saved → %s", out.relative_to(REPO_ROOT))
    else:
        log.info("DRY RUN — report would be saved to %s", out.relative_to(REPO_ROOT))
    return out


# ─── Hypothesis factories ─────────────────────────────────────────────────────


def _hypotheses_python_syntax(errors: list[dict]) -> list[Hypothesis]:
    return [
        Hypothesis(
            id="PY-SYN-A",
            description="Log each syntax error as a [UNCERTAIN] recommendation for manual fix.",
            pros=["Safe — no automatic edits", "Traceable"],
            cons=["Does not fix the code automatically"],
            risk="low",
            applicable=True,
            apply_fn=lambda: (
                "Syntax errors logged:\n"
                + "\n".join(f"  {e['file']}: {e['error']}" for e in errors)
            ),
        ),
        Hypothesis(
            id="PY-SYN-B",
            description="Attempt autopep8 / black to auto-format and surface errors.",
            pros=["May fix minor formatting issues"],
            cons=["Could modify many files", "autopep8 may not be installed"],
            risk="medium",
            applicable=False,
        ),
    ]


def _hypotheses_missing_tests() -> list[Hypothesis]:
    return [
        Hypothesis(
            id="TEST-A",
            description="Create a placeholder test directory with a README explaining the testing strategy.",
            pros=["Low risk", "Establishes structure", "No code modified"],
            cons=["Does not write actual tests"],
            risk="low",
            applicable=True,
            apply_fn=_apply_create_test_readme,
        ),
        Hypothesis(
            id="TEST-B",
            description="Generate skeleton unit test files for each source module.",
            pros=["Accelerates test writing"],
            cons=["Requires knowledge of each module's API", "Risk of incorrect scaffolding"],
            risk="medium",
            applicable=False,
        ),
    ]


def _hypotheses_large_files(files: list[dict]) -> list[Hypothesis]:
    return [
        Hypothesis(
            id="ARCH-A",
            description="Document oversized files as candidates for modularisation in the report.",
            pros=["Safe", "Provides actionable guidance without touching code"],
            cons=["Does not refactor anything automatically"],
            risk="low",
            applicable=True,
            apply_fn=lambda: (
                "Files flagged for future modularisation:\n"
                + "\n".join(f"  {f['path']} ({f['lines']} lines)" for f in files)
            ),
        ),
        Hypothesis(
            id="ARCH-B",
            description="Automatically split the largest file into smaller modules.",
            pros=["Immediate code organisation improvement"],
            cons=["High risk of breaking imports", "Requires deep semantic analysis"],
            risk="high",
            applicable=False,
        ),
    ]


def _hypotheses_create_reports_dir() -> list[Hypothesis]:
    return [
        Hypothesis(
            id="TOOL-A",
            description="Create .ai/reports/ directory with a .gitkeep placeholder.",
            pros=["Ensures report output dir exists", "Zero risk", "Idempotent"],
            cons=["Trivial change"],
            risk="low",
            applicable=True,
            apply_fn=_apply_create_reports_dir,
        ),
        Hypothesis(
            id="TOOL-B",
            description="Write reports only to stdout, skip directory creation.",
            pros=["No filesystem side effects"],
            cons=["Reports are not persisted for future reference"],
            risk="low",
            applicable=False,
        ),
    ]


# ─── Apply functions ──────────────────────────────────────────────────────────


def _apply_create_reports_dir() -> str:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    gitkeep = REPORTS_DIR / ".gitkeep"
    if not gitkeep.exists():
        gitkeep.touch()
    return f"Created {REPORTS_DIR.relative_to(REPO_ROOT)}/.gitkeep"


def _apply_create_test_readme() -> str:
    test_dir = REPO_ROOT / "src" / "__tests__"
    test_dir.mkdir(parents=True, exist_ok=True)
    readme = test_dir / "README.md"
    if not readme.exists():
        readme.write_text(
            textwrap.dedent("""\
                # Tests

                Place unit and integration tests here.

                ## Recommended stack (already in package.json)
                - **Vitest** for unit tests
                - **@testing-library/react** for component tests

                ## Run
                ```bash
                npm test
                ```
            """),
            encoding="utf-8",
        )
    return f"Created {readme.relative_to(REPO_ROOT)}"


# ─── Utilities ────────────────────────────────────────────────────────────────

_IGNORED_DIRS = {
    ".git", "node_modules", "dist", ".next", "__pycache__",
    ".venv", "venv", ".ai/reports",
}


def _is_ignored(path: Path) -> bool:
    parts = set(path.parts)
    return bool(parts & _IGNORED_DIRS)


# ─── CLI entry point ──────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="AI Dev Team executor")
    parser.add_argument(
        "--dry-run", "--report-only",
        action="store_true",
        dest="dry_run",
        help="Run analysis and generate report without writing any changes.",
    )
    args = parser.parse_args()

    log.info("=== AI Dev Team — starting (dry_run=%s) ===", args.dry_run)
    log.info("Repository: %s", REPO_ROOT)

    # Pipeline
    snapshot = analyse_repo()
    findings = identify_improvements(snapshot)

    if not findings:
        log.info("No improvement opportunities identified. Repository looks healthy.")
    else:
        compare_and_select(findings)
        apply_changes(findings, dry_run=args.dry_run)

    report = generate_report(findings)
    rendered = render_report(report)
    save_report(report, rendered, dry_run=args.dry_run)

    # Always print report to stdout so CI can capture it
    print("\n" + rendered)

    log.info(
        "=== Done — applied: %d, skipped/recommended: %d ===",
        report.applied_count, report.skipped_count,
    )


if __name__ == "__main__":
    main()
