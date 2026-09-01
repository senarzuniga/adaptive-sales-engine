"""
Demo company pack builder and reader.

This module keeps pack generation free from Streamlit so it can be used by
scripts, tests and the UI service layer.
"""
from __future__ import annotations

import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence


PACKS_RELATIVE_DIR = Path("public") / "company-packs"
SKIPPED_DIR_NAMES = {
    ".git",
    ".hg",
    ".idea",
    ".pytest_cache",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "site-packages",
    "venv",
}

SOURCE_ROOTS = (
    Path(r"C:\Users\isena\Documents\GitHub\IS-BACKOFFICE"),
    Path(r"C:\Users\isena\Documents\GitHub\adaptive-sales-engine"),
    Path(r"C:\Users\isena\Documents\INGECART"),
    Path(r"C:\Users\isena\Documents\GitHub\AI-FACTORY-v2"),
    Path(r"C:\Users\isena\Documents\GitHub\ingesite.github.io"),
)

_CTA_PROFILE: Dict[str, Any] = {
    "company_name": "CTA",
    "industry": "Business Transformation, R&D Funding and AI-enabled Consulting",
    "sub_sector": "SME consulting, growth architecture, digital operations, industrial funding",
    "headquarters": "Barcelona, Spain",
    "operating_regions": "Spain, remote delivery for EU clients",
    "employee_count": "Core founder-led operating unit with scalable partner network",
    "annual_revenue": "Pre-commercial / launch stage demo baseline",
    "main_products": (
        "CTA Diagnostic, Transformation Architecture, R&D Funding Engine, "
        "AI Sales Engine deployment, PMO and managed performance follow-up"
    ),
    "main_customer_segments": (
        "Spanish SMEs in industry, operations-heavy businesses, commercial teams "
        "requiring transformation, funding or AI-enabled execution support"
    ),
    "main_competitors": (
        "Generic consultancies, grant boutiques, digital agencies, low-value AI wrappers"
    ),
    "sales_team_size": "Founder-led with assisted outreach and agent-supported delivery",
    "kam_count": "1",
    "sales_channels": "Direct founder-led sales, referrals, content-driven outbound, partner collaborations",
    "current_challenges": (
        "Need repeatable offer packaging, stronger qualification workflow, legal/eligibility rule depth, "
        "and a commercial operating cadence to convert expertise into scalable pipeline"
    ),
    "strategic_goals": (
        "1. Launch a precise CTA offer for SMEs. 2. Prioritize high-fit consulting and funding opportunities. "
        "3. Convert knowledge into explainable actions. 4. Build a reusable operating model with agent supervision."
    ),
    "additional_notes": (
        "CTA is modeled as a demo business unit focused on practical transformation and funding support. "
        "It should not behave like a generic chatbot-led consultancy."
    ),
    "website_url": "",
    "linkedin_url": "",
    "business_description": (
        "CTA (Centro de Transformacion y Aceleracion) is a practical consulting and AI-enabled execution model "
        "for SMEs that need to improve operations, commercial performance, process maturity, funding readiness "
        "and measurable business execution without building large internal structures."
    ),
    "objectives": (
        "Package diagnostics, transformation blueprints, modular implementations, and managed follow-up into "
        "a commercially viable service line connected to evidence, scoring and execution."
    ),
    "strategy_context": (
        "Four-level offer architecture: initial diagnostic, transformation design, modular implementation, "
        "and managed operational support. Agents must support diagnosis, prioritization, proposal, PMO and KPI follow-up."
    ),
    "market_context": (
        "SMEs need practical transformation support with funding awareness, commercial rigor, measurable KPIs "
        "and explainable recommendations rather than generic strategy decks."
    ),
    "enrichment_status": "completed",
}

_INGECART_ACTION_QUEUE = [
    {
        "title": "Top-10 account activation plan",
        "score": 96,
        "priority": "critical",
        "domain": "commercial",
        "data_scope": "company",
        "objective": "Launch structured KAM plays for the highest-value Spanish corrugated groups.",
        "evidence": "Strategic plan targets a Top-10 account program and proactive pipeline discipline.",
        "sequence": [
            "Select 10 target accounts from AFCO ecosystem and historical revenue concentration.",
            "Assign stakeholder owners and define whitespace hypotheses per account.",
            "Create a 90-day cadence with visits, ROI stories and follow-up actions.",
        ],
        "confidence": 0.93,
    },
    {
        "title": "Service revenue engine",
        "score": 92,
        "priority": "high",
        "domain": "after_sales",
        "data_scope": "company",
        "objective": "Convert reactive service work into recurring revenue with install-base coverage.",
        "evidence": "Current challenges mention an unstructured service business limited to a 50km radius.",
        "sequence": [
            "Inventory installed base and current service interventions.",
            "Define service bundles, SLAs and coverage zones.",
            "Create renewal and spare-parts opportunities linked to each asset.",
        ],
        "confidence": 0.91,
    },
    {
        "title": "Offer governance and pricing review",
        "score": 89,
        "priority": "high",
        "domain": "offers",
        "data_scope": "company",
        "objective": "Stabilize the quotation pipeline and reduce margin leakage.",
        "evidence": "Local folders contain multiple live offer workbooks and proposal documents.",
        "sequence": [
            "Normalize open offer sheets into a canonical offer register.",
            "Add margin and transport cost review checkpoints.",
            "Track offer aging, win/loss reasons and approval thresholds.",
        ],
        "confidence": 0.9,
    },
]

_CTA_ACTION_QUEUE = [
    {
        "title": "Package CTA diagnostic offer",
        "score": 94,
        "priority": "critical",
        "domain": "offer_design",
        "data_scope": "company",
        "objective": "Turn CTA from a concept into a clear first commercial offer.",
        "evidence": "The CTA plan defines a four-level model but warns against generic consulting positioning.",
        "sequence": [
            "Define deliverables, inputs, duration and price for the diagnostic package.",
            "Create an explainable scoring matrix for friction, fit and urgency.",
            "Prepare one proposal template and one qualification checklist.",
        ],
        "confidence": 0.94,
    },
    {
        "title": "Build funding prioritization workflow",
        "score": 91,
        "priority": "high",
        "domain": "funding",
        "data_scope": "market",
        "objective": "Operationalize help discovery, eligibility and go/no-go decisions.",
        "evidence": "CTA funding gap notes require reproducible eligibility rules, scoring and dossier readiness.",
        "sequence": [
            "Create the canonical funding catalog schema with source, version and deadlines.",
            "Implement eligibility criteria per company, project and cost type.",
            "Expose a go/watch/no-go ranking with explainable rationale.",
        ],
        "confidence": 0.92,
    },
    {
        "title": "Launch SME outreach cadence",
        "score": 86,
        "priority": "high",
        "domain": "go_to_market",
        "data_scope": "company",
        "objective": "Create a repeatable prospecting rhythm for early CTA pipeline generation.",
        "evidence": "The execution plan explicitly calls for the first CTA campaign and 5-10 opportunities.",
        "sequence": [
            "Define ideal customer profiles and qualification rules.",
            "Build three outreach sequences linked to pain points and transformation outcomes.",
            "Track responses, diagnostics sold and next-best actions weekly.",
        ],
        "confidence": 0.87,
    },
]


def _existing_source_roots() -> List[Path]:
    return [path for path in SOURCE_ROOTS if path.exists()]


def _contains_term(text: str, term: str) -> bool:
    if not term:
        return False
    if re.search(r"[^A-Za-z0-9 ]", term):
        return bool(re.search(term, text, flags=re.IGNORECASE))
    if len(term) <= 3:
        return bool(re.search(rf"(^|[^a-z0-9]){re.escape(term.lower())}([^a-z0-9]|$)", text))
    return term.lower() in text


def _category_for_file(path: Path) -> str:
    full = str(path).lower()
    if any(token in full for token in ("oferta", "offer", "quotation", "proposal", "pricing")):
        return "offers"
    if any(token in full for token in ("customer", "client", "cliente", "crm", "contact")):
        return "customers"
    if any(token in full for token in ("project", "proyecto", "workbench", "funding", "ayuda")):
        return "projects_funding"
    if any(token in full for token in ("report", "informe", "analysis", "audit", "intelligence")):
        return "reports"
    if any(token in full for token in ("cost", "budget", "finance", "payment", "cash")):
        return "finance"
    if any(token in full for token in ("website", "brand", "linkedin", "marketing", "social")):
        return "market_content"
    return "other"


def collect_company_source_inventory(
    search_terms: Sequence[str],
    source_roots: Sequence[Path] | None = None,
    max_examples: int = 20,
) -> Dict[str, Any]:
    roots = list(source_roots or _existing_source_roots())
    matched_files: List[Path] = []
    category_counts: Dict[str, int] = defaultdict(int)
    extension_counts: Counter[str] = Counter()

    for root in roots:
        if not root.exists():
            continue
        for current_root, dirs, files in os.walk(root):
            dirs[:] = [d for d in dirs if d not in SKIPPED_DIR_NAMES]
            for file_name in files:
                path = Path(current_root) / file_name
                haystack = str(path).lower()
                if any(_contains_term(haystack, term.lower()) for term in search_terms):
                    matched_files.append(path)
                    category_counts[_category_for_file(path)] += 1
                    extension_counts[path.suffix.lower() or "[no extension]"] += 1

    matched_files = sorted(matched_files)
    example_files = [str(path) for path in matched_files[:max_examples]]
    return {
        "roots": [str(path) for path in roots],
        "matched_file_count": len(matched_files),
        "categories": dict(sorted(category_counts.items())),
        "extensions": dict(extension_counts.most_common(10)),
        "example_files": example_files,
    }


def _read_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _safe_excerpt(path: Path, max_chars: int = 420) -> str:
    if not path.exists():
        return ""
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""
    compact = " ".join(line.strip() for line in text.splitlines() if line.strip())
    return compact[:max_chars]


def _demo_contacts_for_ingecart() -> List[Dict[str, Any]]:
    return [
        {
            "name": "Diego Garcia",
            "role": "Owner & General Manager",
            "relationship": "Executive sponsor",
            "email": "",
            "country": "Spain",
            "company": "Ingecart",
        },
        {
            "name": "Michael Korchega",
            "role": "USA Partner / Rapid-Bond",
            "relationship": "Channel partner",
            "email": "",
            "country": "USA",
            "company": "Ingecart",
        },
    ]


def _demo_contacts_for_cta() -> List[Dict[str, Any]]:
    return [
        {
            "name": "CTA Founder",
            "role": "Lead consultant",
            "relationship": "Commercial owner",
            "email": "",
            "country": "Spain",
            "company": "CTA",
        }
    ]


def build_ingecart_demo_pack(workspace_root: Path) -> Dict[str, Any]:
    archived_pack = (
        workspace_root
        / "Architecture"
        / "outputs"
        / "archives"
        / "1782712887"
        / "public"
        / "company-packs"
        / "IngecartDemo"
        / "ingecart_demo_pack.json"
    )
    if archived_pack.exists():
        pack = _read_json(archived_pack)
    else:
        backup_txt = workspace_root / "INGECART_COMPANY_INFO_BACKUP.txt"
        raw = backup_txt.read_text(encoding="utf-8")
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1:
            raise ValueError("Could not locate Ingecart JSON profile")
        pack = {
            "companyProfile": json.loads(raw[start : end + 1]),
            "orders": [],
            "products": [],
            "opportunities": [],
            "strategy": [],
            "leads": [],
            "contacts": [],
            "tasks": [],
            "workspace": {},
        }

    source_registry = collect_company_source_inventory(["ingecart"])
    profile = dict(pack.get("companyProfile", {}))
    profile.update(
        {
            "company_key": "ingecart-demo",
            "record_stage": "demo version",
            "validation_status": "ready_for_review",
            "demo_origin": "local_pack",
        }
    )
    pack["companyProfile"] = profile
    pack["contacts"] = pack.get("contacts") or _demo_contacts_for_ingecart()
    pack["recommendedActionQueue"] = _INGECART_ACTION_QUEUE
    pack["sourceRegistry"] = source_registry
    pack["evidenceHighlights"] = [
        {
            "title": "Company profile backup",
            "path": str(workspace_root / "INGECART_COMPANY_INFO_BACKUP.txt"),
            "summary": _safe_excerpt(workspace_root / "INGECART_COMPANY_INFO_BACKUP.txt"),
            "scope": "company",
        },
        {
            "title": "Commercial offer folder",
            "path": r"C:\Users\isena\Documents\INGECART\COMMERCIAL\OFERTAS",
            "summary": "Multiple live offer workbooks and proposal documents are available for canonical ingestion.",
            "scope": "company",
        },
    ]
    entity_registries = dict(pack.get("entityRegistries") or {})
    entity_registries["sourceRegistry"] = source_registry
    pack["entityRegistries"] = entity_registries
    return pack


def build_cta_demo_pack(workspace_root: Path) -> Dict[str, Any]:
    gap_doc = Path(r"C:\Users\isena\Documents\GitHub\IS-BACKOFFICE\CTA_INDUSTRIAL_RND_FUNDING_ENGINE_GAPS.txt")
    execution_doc = Path(r"C:\Users\isena\Documents\GitHub\AI-FACTORY-v2\PLAN_ACCION_INGECART_4_PROYECTOS_AYUDAS_CTA_2026-08-17.txt")
    funding_doc = Path(r"C:\Users\isena\Documents\GitHub\AI-FACTORY-v2\PROYECTOS PARA GESTION AYUDAS Y REC.txt")

    source_registry = collect_company_source_inventory(
        [
            "cta",
            "funding engine",
            "ayudas cta",
            "cta industrial",
        ]
    )
    profile = dict(_CTA_PROFILE)
    profile.update(
        {
            "company_key": "cta-demo",
            "record_stage": "demo version",
            "validation_status": "ready_for_review",
            "demo_origin": "local_pack",
        }
    )

    return {
        "companyProfile": profile,
        "orders": [],
        "products": [
            {"name": "CTA Diagnostic", "average_value": 2500, "type": "Service", "comments": "Entry diagnostic offer"},
            {"name": "Transformation Blueprint", "average_value": 7500, "type": "Service", "comments": "Process and operating model design"},
            {"name": "Funding Engine Support", "average_value": 12000, "type": "Service", "comments": "Eligibility, prioritization and dossier support"},
            {"name": "Managed AI Operating Support", "average_value": 3000, "type": "Retainer", "comments": "Monthly follow-up and agent supervision"},
        ],
        "opportunities": [
            {
                "oppNumber": "CTA-2026-001",
                "status": "qualified",
                "region": "Spain",
                "country": "Spain",
                "customerName": "Industrial SME target cluster",
                "scope": "Diagnostic + funding prioritization for industrial innovation roadmap",
                "productFamily": "CTA Diagnostic",
                "segment": "Industrial SME",
                "estPurchasingYear": "2026",
                "estPurchasingQuarter": "Q4",
                "estRevenue": 2500,
                "contractProb": 0.45,
                "margin": 65,
                "contact": "Founder-led prospecting",
                "kam": "CTA Founder",
            },
            {
                "oppNumber": "CTA-2026-002",
                "status": "proposed",
                "region": "Spain",
                "country": "Spain",
                "customerName": "Growth-stage operations SME",
                "scope": "Commercial process redesign and AI-supported weekly execution rhythm",
                "productFamily": "Transformation Blueprint",
                "segment": "Operations-heavy SME",
                "estPurchasingYear": "2026",
                "estPurchasingQuarter": "Q4",
                "estRevenue": 7500,
                "contractProb": 0.35,
                "margin": 68,
                "contact": "Founder-led prospecting",
                "kam": "CTA Founder",
            },
        ],
        "strategy": [
            {
                "product_family": "CTA Diagnostic",
                "number_of_segment": "1",
                "region": "Spain",
                "est_purchasing_quarter": "Q4 2026",
                "est_revenue": 25000,
                "margin": 65,
                "kam": "CTA Founder",
            },
            {
                "product_family": "Funding Engine Support",
                "number_of_segment": "2",
                "region": "Spain",
                "est_purchasing_quarter": "Q1 2027",
                "est_revenue": 60000,
                "margin": 62,
                "kam": "CTA Founder",
            },
        ],
        "leads": [
            {
                "company": "Spanish industrial SME",
                "contact_name": "Pending discovery",
                "status": "to_qualify",
                "source": "CTA launch campaign",
                "pain_point": "Needs operational and commercial transformation",
            }
        ],
        "contacts": _demo_contacts_for_cta(),
        "tasks": [
            {
                "title": "Package CTA diagnostic",
                "description": "Define scope, pricing, evidence model and qualification checklist.",
                "pillar": "cta_launch",
                "status": "todo",
                "priority": "high",
                "category": "offer_design",
                "assignee": "CTA Founder",
                "due_date": "2026-09-15",
            },
            {
                "title": "Close funding rule inventory",
                "description": "Document eligibility, evidence, scoring and dossier requirements.",
                "pillar": "funding_engine",
                "status": "todo",
                "priority": "high",
                "category": "knowledge",
                "assignee": "CTA Founder",
                "due_date": "2026-09-30",
            },
        ],
        "recommendedActionQueue": _CTA_ACTION_QUEUE,
        "sourceRegistry": source_registry,
        "evidenceHighlights": [
            {
                "title": "CTA capability and gaps",
                "path": str(gap_doc),
                "summary": _safe_excerpt(gap_doc),
                "scope": "market",
            },
            {
                "title": "CTA operating model inside Ingecart",
                "path": str(execution_doc),
                "summary": _safe_excerpt(execution_doc),
                "scope": "company",
            },
            {
                "title": "Funding engine vision",
                "path": str(funding_doc),
                "summary": _safe_excerpt(funding_doc),
                "scope": "market",
            },
        ],
        "entityRegistries": {
            "sourceRegistry": source_registry,
            "knowledgeScopes": ["company", "market"],
        },
        "workspace": {
            "business_intelligence_reports": [
                {
                    "title": "CTA launch board",
                    "summary": "Mission control for projects, opportunities, evidence gaps and go/no-go funding decisions.",
                    "scope": "market",
                }
            ]
        },
    }


def build_demo_packs(workspace_root: Path) -> Dict[str, Dict[str, Any]]:
    return {
        "IngecartDemo": build_ingecart_demo_pack(workspace_root),
        "CTADemo": build_cta_demo_pack(workspace_root),
    }


def write_demo_packs(workspace_root: Path) -> List[Path]:
    pack_dir = workspace_root / PACKS_RELATIVE_DIR
    pack_dir.mkdir(parents=True, exist_ok=True)
    written_files: List[Path] = []
    for folder_name, pack in build_demo_packs(workspace_root).items():
        target_dir = pack_dir / folder_name
        target_dir.mkdir(parents=True, exist_ok=True)
        slug = "ingecart_demo_pack.json" if folder_name == "IngecartDemo" else "cta_demo_pack.json"
        target_file = target_dir / slug
        target_file.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")
        written_files.append(target_file)
    return written_files


def load_pack_files(workspace_root: Path) -> List[Path]:
    pack_root = workspace_root / PACKS_RELATIVE_DIR
    if not pack_root.exists():
        return []
    files = []
    for path in pack_root.glob("*/*_pack.json"):
        if path.is_file():
            files.append(path)
    return sorted(files)


def load_packs_from_disk(workspace_root: Path) -> List[Dict[str, Any]]:
    return [_read_json(path) for path in load_pack_files(workspace_root)]


def build_company_record_from_pack(pack: Dict[str, Any], pack_file: str = "") -> Dict[str, Any]:
    profile = dict(pack.get("companyProfile") or {})
    record = dict(profile)
    record["source_registry"] = pack.get("sourceRegistry") or (pack.get("entityRegistries") or {}).get("sourceRegistry", {})
    record["recommended_action_queue"] = pack.get("recommendedActionQueue") or []
    record["evidence_highlights"] = pack.get("evidenceHighlights") or []
    record["data_inventory"] = {
        "orders": len(pack.get("orders") or []),
        "products": len(pack.get("products") or []),
        "opportunities": len(pack.get("opportunities") or []),
        "strategy": len(pack.get("strategy") or []),
        "leads": len(pack.get("leads") or []),
        "contacts": len(pack.get("contacts") or []),
        "tasks": len(pack.get("tasks") or []),
    }
    record["pack_file"] = pack_file
    record["pack_available"] = True
    return record


def pack_display_label(company: Dict[str, Any]) -> str:
    base_name = company.get("company_name", company.get("name", "Empresa"))
    stage = company.get("record_stage", "").strip()
    return f"{base_name} - {stage}" if stage else base_name


def merge_company_records(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(existing)
    for key, value in incoming.items():
        if value not in (None, "", [], {}):
            merged[key] = value
        elif key not in merged:
            merged[key] = value
    return merged

