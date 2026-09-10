import json, re, unicodedata, uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from docx import Document
from openpyxl import load_workbook

REPO = Path(r"C:\Users\isena\Documents\GitHub\adaptive-sales-engine")
BASE_PACK = REPO / "public" / "company-packs" / "IngecartDemo" / "ingecart_demo_pack.json"
OUTPUTS = [
    REPO / "public" / "company-packs" / "Ingecart" / "ingecart_pack.json",
    REPO / "public" / "company-packs" / "IngecartDemo" / "ingecart_demo_pack.json",
]
OFFERS_BOOK = Path(r"C:\Users\isena\Documents\INGECART\COMMERCIAL\OFERTAS\ESTADO DE OFERTAS 05 2026 INGECART(AutoRecovered).xlsx")
OPEN_REQUESTS_BOOK = Path(r"C:\Users\isena\Documents\INGECART\COMMERCIAL\OFERTAS\OPEN REQUEST 05 2026(AutoRecovered).xlsx")
INITIAL_CUSTOMERS_BOOK = Path(r"C:\Users\isena\Documents\INGECART\COMMERCIAL\INITIAL INGECART CUSTOMERS.xlsx")
CUSTOMER_CONTEXT_DOC = Path(r"C:\Users\isena\Documents\INGECART\COMMERCIAL\INGECART CUSTOMERS .docx")
PROSPECTION_FOLDER = Path(r"C:\Users\isena\Documents\INGECART\PROSPECCION")
PROSPECTION_SPANISH = next(PROSPECTION_FOLDER.glob("CARTONEROS ESPA* GENERICO.xlsx"), PROSPECTION_FOLDER / "CARTONEROS ESPA?A GENERICO.xlsx")
PROSPECTION_EXPO = PROSPECTION_FOLDER / "Super Corr Expo Orlando 2024_ List.xlsx"
PRODUCT_SOLUTIONS = Path(r"C:\Users\isena\Documents\GitHub\ingesite.github.io\solutions")
PRODUCT_FOLDER = Path(r"C:\Users\isena\Documents\INGECART\PRODUCTO")
PRODUCT_BOOK = PRODUCT_FOLDER / "PRODUCTOS INGECART.xlsx"
AFTERSALES_OFFERS = Path(r"C:\Users\isena\OneDrive\Attachments\smart_plant_annual_offers\html")
POSTVENTA = Path(r"C:\Users\isena\Documents\INGECART\POSTVENTA")
AI_FACTORY = Path(r"C:\Users\isena\Documents\GitHub\AI-FACTORY-v2")
IS_BACKOFFICE = Path(r"C:\Users\isena\Documents\GitHub\IS-BACKOFFICE")
OFFERS_SENT = Path(r"C:\Users\isena\OneDrive\INGECART\OFERTAS INGECART\OFERTAS ENVIADAS 2026")
PROJECTS_ROOT = Path(r"C:\Users\isena\Documents\INGECART\COMMERCIAL\PROYECTOS")
NS = uuid.uuid5(uuid.NAMESPACE_DNS, 'adaptive-sales-engine.ingecart')
NOW = datetime.now()
MAX_EXPO_COMPANIES = 220
MAX_EXPO_CONTACTS_PER_COMPANY = 2

def uid(*parts: Any) -> str:
    return str(uuid.uuid5(NS, '::'.join(str(p) for p in parts)))

def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))

def clean(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, datetime):
        return value.strftime('%Y-%m-%d')
    return str(value).replace('\xa0', ' ').strip()

def strip_accents(value: str) -> str:
    return ''.join(ch for ch in unicodedata.normalize('NFKD', value) if not unicodedata.combining(ch))

def normalize_key(value: Any) -> str:
    return re.sub(r'[^a-z0-9]+', '', strip_accents(clean(value)).lower())

def tokenize(value: Any):
    return {token for token in re.findall(r'[a-z0-9]+', strip_accents(clean(value)).lower()) if len(token) > 2}

def maybe_date(value: Any) -> str:
    return clean(value)

def to_number(value: Any) -> float:
    if value is None or value == '':
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = clean(value).replace('€', '').replace(' ', '').replace(',', '.')
    try:
        return float(text)
    except ValueError:
        return 0.0

def status_from_cell(raw: str) -> str:
    text = strip_accents(raw.lower())
    if 'vendid' in text or 'won' in text or 'closed' in text:
        return 'won'
    if 'perdid' in text or 'lost' in text or 'cancel' in text:
        return 'lost'
    if 'post' in text or 'aplaz' in text:
        return 'postponed'
    return 'follow_up'

def region_from_country(country: str) -> str:
    c = strip_accents(country.upper())
    if 'USA' in c:
        return 'USA'
    if 'SPAIN' in c or 'ESPA' in c:
        return 'Spain'
    if c in {'LATAM', 'BOLIVIA', 'MEXICO', 'GUATEMALA'}:
        return 'LATAM'
    return country or 'International'

def quarter_from_date(date_text: str) -> str:
    try:
        m = datetime.fromisoformat(date_text).month
        return f'Q{((m - 1) // 3) + 1}'
    except Exception:
        return 'TBD'

def title_case_filename(name: str) -> str:
    base = re.sub(r'\.[^.]+$', '', name)
    base = re.sub(r'[_-]+', ' ', base)
    return re.sub(r'\s+', ' ', base).strip().title() or name

def html_title(path: Path) -> str:
    text = path.read_text(encoding='utf-8', errors='ignore')
    match = re.search(r'<title>(.*?)</title>', text, re.I | re.S)
    return re.sub(r'\s+', ' ', match.group(1)).strip() if match else title_case_filename(path.name)

def html_headers(path: Path):
    text = path.read_text(encoding='utf-8', errors='ignore')
    return [re.sub(r'<[^>]+>', '', m).strip() for m in re.findall(r'<h[12][^>]*>(.*?)</h[12]>', text, re.I | re.S)[:4]]

def text_excerpt(path: Path, limit: int = 420) -> str:
    raw = path.read_text(encoding='utf-8', errors='ignore')
    raw = re.sub(r'<[^>]+>', ' ', raw)
    raw = re.sub(r'\s+', ' ', raw).strip()
    return raw[:limit]

def infer_product_value(slug: str) -> int:
    rules = {'heavy-duty-palletizer': 450000, 'palletizer': 420000, 'automatic-truck-loading': 250000, 'amr': 300000, 'digitaltwin': 120000, 'direction-audit': 18000, 'retal': 95000, 'ingetran': 1200000, 'conveyor': 90000, 'easy-pack': 150000, 'rfid': 85000, 'sr1400': 180000}
    for key, value in rules.items():
        if key in slug:
            return value
    return 120000

ACCOUNT_RULES = [
    {'aliases': ['international paper', 'ip'], 'priority': 'critical', 'stage': 'customer', 'focus': 'Strategic Tier 1 group. Best entry point is the plant with an urgent throughput or retrofit need.'},
    {'aliases': ['smurfit westrock', 'smurfit'], 'priority': 'high', 'stage': 'follow_up', 'focus': 'Large corrugated group suited for retrofits, post-M&A optimization, and automation packages.'},
    {'aliases': ['saica'], 'priority': 'critical', 'stage': 'follow_up', 'focus': 'Core Iberian target with continuous demand for agile automation, service, and plant upgrades.'},
    {'aliases': ['ds smith', 'europac'], 'priority': 'critical', 'stage': 'follow_up', 'focus': 'Natural Ingecart market with active offers, service, and automation opportunities across several plants.'},
    {'aliases': ['cartonajes font', 'font'], 'priority': 'critical', 'stage': 'customer', 'focus': 'Validated customer with a combined base of projects, offers, and active commercial continuity.'},
    {'aliases': ['sterner global', 'paige packaging', 'paige'], 'priority': 'critical', 'stage': 'follow_up', 'focus': 'High-value North American opportunity set combining Mastercorr execution and new conversion offers.'},
    {'aliases': ['cascades', 'cascades sonoco'], 'priority': 'critical', 'stage': 'customer', 'focus': 'Strategic North American account with active project execution and follow-up opportunities.'},
]

PRODUCT_SHEET_NAMES = {'INGETRANS': 'Ingetrans', 'MOVIMIENTO DE CARGAS': 'Load Movement Automation', 'Kitchen': 'Kitchen Adhesive System', 'SERVICIO': 'Industrial Services'}

def account_metadata(name: str, note: str = ''):
    combined = f'{name} {note}'
    normalized = normalize_key(combined)
    meta = {'priority': 'medium', 'stage': 'prospecting', 'focus': 'Corrugated packaging account aligned with Ingecart automation, retrofit, and lifecycle service plays.'}
    for rule in ACCOUNT_RULES:
        if any(normalize_key(alias) in normalized for alias in rule['aliases']):
            meta = {'priority': rule['priority'], 'stage': rule['stage'], 'focus': rule['focus']}
            break
    note_key = normalize_key(note)
    if 'pedido' in note_key or 'proyecto' in note_key or 'cliente' in note_key:
        meta['stage'] = 'customer'
    elif 'seguimiento' in note_key or 'oferta' in note_key:
        meta['stage'] = 'follow_up'
    return meta

def build_customer_context_map():
    context_map = {}
    if INITIAL_CUSTOMERS_BOOK.exists():
        wb = load_workbook(INITIAL_CUSTOMERS_BOOK, data_only=True)
        ws = wb[wb.sheetnames[0]]
        for row in ws.iter_rows(min_row=2, values_only=True):
            company = clean(row[0])
            if not company:
                continue
            note = clean(row[1])
            context_map[normalize_key(company)] = {'name': company, 'note': note, **account_metadata(company, note)}
    if CUSTOMER_CONTEXT_DOC.exists():
        paragraphs = [clean(p.text) for p in Document(CUSTOMER_CONTEXT_DOC).paragraphs if clean(p.text)]
        for entry in context_map.values():
            match = next((paragraph for paragraph in paragraphs if normalize_key(entry['name']) and normalize_key(entry['name']) in normalize_key(paragraph)), '')
            if match:
                entry['focus'] = f"{entry['focus']} {match[:220]}".strip()
    return context_map

def build_offer_document_list():
    if not OFFERS_SENT.exists():
        return []
    return sorted(path for path in OFFERS_SENT.rglob('*') if path.is_file() and not path.name.startswith('~$'))

def find_project_folder(customer_name: str):
    if not PROJECTS_ROOT.exists():
        return ''
    customer_tokens = tokenize(customer_name)
    matches = []
    for path in PROJECTS_ROOT.iterdir():
        if not path.is_dir():
            continue
        score = len(customer_tokens & tokenize(path.name))
        if score > 0:
            matches.append((score, path))
    matches.sort(key=lambda item: (-item[0], item[1].name.lower()))
    return str(matches[0][1]) if matches else ''

def find_offer_documents(offer_number: str, customer_name: str, concept: str, files):
    normalized_offer = normalize_key(offer_number)
    customer_tokens = tokenize(customer_name)
    concept_tokens = tokenize(concept)
    matches = []
    for path in files:
        score = 0
        file_key = normalize_key(path.name)
        if normalized_offer and normalized_offer in file_key:
            score += 10
        file_tokens = tokenize(path.name)
        score += len(customer_tokens & file_tokens) * 3
        score += len(concept_tokens & file_tokens)
        if score > 0:
            matches.append((score, path))
    matches.sort(key=lambda item: (-item[0], item[1].name.lower()))
    return [str(path) for _, path in matches[:6]]

def build_project_suite(offer, ordinal):
    project_id = uid('project', offer['id'])
    created = offer.get('updated_at') or NOW.isoformat()
    contract_value = float(offer.get('contract_value') or 0)
    title = offer['title']
    project = {
        'id': project_id, 'offer_id': offer['id'], 'project_number': f'PRJ-2026-{ordinal:03d}', 'title': title,
        'customer_name': offer['customer_name'], 'project_type': 'machine' if contract_value >= 100000 else 'service',
        'complexity': 'high' if contract_value >= 500000 else 'medium', 'risk_level': 'medium' if contract_value >= 100000 else 'low',
        'duration_category': 'long' if contract_value >= 500000 else 'medium', 'status': 'planning', 'health_score': 78 if contract_value >= 200000 else 84,
        'scope_of_supply': offer.get('project_description', title), 'deliverables': 'Commercial handoff, engineering, procurement, FAT, shipping, installation, commissioning',
        'exclusions': 'Civil works and local taxes unless agreed', 'contract_value': contract_value, 'currency': 'EUR',
        'payment_terms': '40% order confirmation, 60% before shipment', 'incoterms': 'DDU', 'warranty_terms': 'Standard Ingecart warranty policy',
        'penalties_lds': 'To be validated in final contract', 'customization_level': 'configured', 'engineering_complexity': 'high' if contract_value >= 500000 else 'medium',
        'delivery_deadline': (NOW + timedelta(days=75)).strftime('%Y-%m-%d'), 'customer_requirements': offer.get('context', ''), 'site_constraints': offer.get('source', ''),
        'dependencies': 'Payment release, engineering approvals, material availability, FAT and site readiness', 'planned_start': NOW.strftime('%Y-%m-%d'),
        'planned_end': (NOW + timedelta(days=75)).strftime('%Y-%m-%d'), 'actual_start': None, 'actual_end': None, 'total_budget': round(contract_value * 0.78, 2) if contract_value else 120000,
        'total_actual_cost': round(contract_value * 0.22, 2) if contract_value else 18000, 'total_invoiced': round(contract_value * 0.4, 2) if contract_value else 0,
        'total_paid': round(contract_value * 0.3, 2) if contract_value else 0, 'margin_target': 22, 'margin_actual': 19,
        'ai_analysis': {'origin': 'local_ingecart_sync', 'priority': 'commercial_to_project_handoff', 'next_control_point': 'Order Kickoff'},
        'notes': 'Generated from visible sold Ingecart offer to ensure project continuity.', 'created_at': created, 'updated_at': created,
    }
    phase_names = [('Order activation', 'PM', 15, 0.06), ('Engineering & design', 'Engineering', 30, 0.16), ('Procurement', 'Procurement', 45, 0.25), ('Manufacturing', 'Workshop', 60, 0.28), ('Shipping & installation', 'Logistics', 72, 0.15), ('FAT and commissioning', 'Commissioning', 80, 0.10)]
    phases = []
    for idx, (name, owner, offset, weight) in enumerate(phase_names, start=1):
        phases.append({'id': uid('project-phase', project_id, idx), 'project_id': project_id, 'phase_number': idx, 'phase_name': name, 'description': f'{name} for {title}', 'status': 'in_progress' if idx == 1 else 'pending', 'responsible': owner, 'planned_start': (NOW + timedelta(days=max(0, offset - 10))).strftime('%Y-%m-%d'), 'planned_end': (NOW + timedelta(days=offset)).strftime('%Y-%m-%d'), 'budget': round(project['total_budget'] * weight, 2), 'actual_cost': round(project['total_actual_cost'] * (0.5 if idx == 1 else 0), 2), 'completion_pct': 35 if idx == 1 else 0, 'key_tasks': ['Validate gate', 'Track pending issues', 'Update customer follow-up'], 'control_points': ['Customer approval', 'Internal PM review'], 'risks': ['Scope deviation', 'Supplier delay'], 'notes': '', 'created_at': created, 'updated_at': created})
    milestone_templates = [('contract', 'Order confirmed', 5, 10, True, True, 'Sales'), ('design', 'Design freeze', 18, 25, False, False, 'Engineering'), ('procurement', 'Materials ready', 32, 35, False, False, 'Procurement'), ('factory', 'FAT complete', 55, 50, False, False, 'QA'), ('installation', 'Installation complete', 68, 70, False, False, 'Field service'), ('final', 'Final handover', 80, 100, False, False, 'PM')]
    milestones = []
    for idx, (kind, label, offset, pct, invoiced, paid, owner) in enumerate(milestone_templates, start=1):
        milestones.append({'id': uid('project-milestone', project_id, idx), 'project_id': project_id, 'milestone_type': kind, 'title': label, 'description': f'{label} milestone for {title}', 'planned_date': (NOW + timedelta(days=offset)).strftime('%Y-%m-%d'), 'actual_date': NOW.strftime('%Y-%m-%d') if kind == 'contract' else None, 'status': 'completed' if kind == 'contract' else 'pending', 'linked_phase_id': phases[min(idx - 1, len(phases) - 1)]['id'], 'payment_amount': round(contract_value * (pct / 100), 2), 'payment_pct': pct, 'is_invoiced': invoiced, 'is_paid': paid, 'dependencies': 'Prior gate passed', 'gate_id': f'G{idx}', 'required_documents': ['Kickoff pack', 'Approved drawings'], 'responsible': owner, 'notes': '', 'created_at': created, 'updated_at': created})
    gates = []
    for idx, (label, offset) in enumerate([('Order Kickoff', 4), ('Engineering release', 18), ('Procurement release', 33), ('FAT approval', 56), ('Site acceptance', 74)], start=1):
        gates.append({'id': uid('project-gate', project_id, idx), 'project_id': project_id, 'gate_number': f'G{idx}', 'gate_name': label, 'description': f'{label} for {title}', 'status': 'passed' if idx == 1 else 'pending', 'required_inputs': ['Commercial dossier', 'Scope confirmation'], 'required_outputs': ['Approved checklist'], 'responsible': 'PM' if idx == 1 else 'Engineering', 'planned_date': (NOW + timedelta(days=offset)).strftime('%Y-%m-%d'), 'actual_date': NOW.strftime('%Y-%m-%d') if idx == 1 else None, 'risks_if_not_passed': 'Schedule slip and payment delay', 'notes': '', 'created_at': created, 'updated_at': created})
    risks = []
    for idx, (name, score) in enumerate([('Supplier lead time', 72), ('Customer scope change', 58), ('Site readiness', 64)], start=1):
        risks.append({'id': uid('project-risk', project_id, idx), 'project_id': project_id, 'risk_title': name, 'description': f'{name} must be monitored in {title}.', 'category': 'operational' if idx == 3 else 'commercial', 'probability': 'medium', 'impact': 'high' if idx != 2 else 'medium', 'risk_score': score, 'mitigation_action': 'Weekly review and mitigation ownership in PM cadence', 'contingency_plan': 'Escalate to project sponsor and adjust delivery sequence', 'owner': 'PM', 'status': 'open', 'created_at': created, 'updated_at': created})
    cost_templates = [('engineering', 'Engineering', 0.16), ('procurement', 'Materials and equipment', 0.27), ('manufacturing', 'Manufacturing', 0.28), ('shipping', 'Shipping and installation', 0.17), ('commissioning', 'FAT & commissioning', 0.12)]
    costs = []
    for idx, (category, label, weight) in enumerate(cost_templates, start=1):
        budget = round(project['total_budget'] * weight, 2); actual = round(budget * (0.4 if idx == 1 else 0.1), 2); variance = actual - budget
        costs.append({'id': uid('project-cost', project_id, idx), 'project_id': project_id, 'category': category, 'line_item': label, 'description': f'{label} budget for {title}', 'budget_amount': budget, 'actual_amount': actual, 'committed_amount': round(budget * 0.6, 2), 'variance': variance, 'variance_pct': round((variance / budget) * 100, 2) if budget else 0, 'supplier': '', 'po_number': '', 'status': 'planned' if idx > 1 else 'in_progress', 'notes': '', 'created_at': created, 'updated_at': created})
    change_orders = []
    if contract_value >= 500000:
        change_orders.append({'id': uid('project-change-order', project_id, 1), 'project_id': project_id, 'change_order_number': f'CO-{ordinal:03d}-1', 'title': 'Pending layout refinement', 'description': 'Customer requested additional review of site layout and handling scope.', 'category': 'scope', 'priority': 'medium', 'status': 'pending', 'requested_by': offer['customer_name'], 'request_date': NOW.strftime('%Y-%m-%d'), 'cost_impact': round(contract_value * 0.015, 2), 'schedule_impact_days': 7, 'margin_impact_pct': -1.2, 'risk_impact': 'medium', 'approved_by': '', 'approved_date': None, 'implementation_notes': 'Validate in next PM review.', 'created_at': created, 'updated_at': created})
    return project, phases, milestones, risks, gates, costs, change_orders

def parse_offers(context_map, offer_documents):
    wb = load_workbook(OFFERS_BOOK, data_only=True); ws = wb[wb.sheetnames[0]]
    offers, orders, opportunities, tasks = [], [], [], []
    for row in ws.iter_rows(min_row=3, values_only=True):
        offer_number, customer, site, concept = clean(row[1]), clean(row[2]), clean(row[3]), clean(row[7]); value = to_number(row[8]); probability = to_number(row[9]); probability = probability * 100 if 0 < probability <= 1 else probability
        raw_state, final_decision, motive = clean(row[10]) or clean(row[11]), maybe_date(row[11]), clean(row[12])
        if not any([offer_number, customer, concept]) or value <= 0 or concept.lower().startswith('total ofertas'):
            continue
        status = status_from_cell(raw_state or final_decision or motive); submitted = maybe_date(row[6]) or NOW.strftime('%Y-%m-%d'); country = clean(row[4]) or 'International'; region = region_from_country(country); customer_name = customer or 'Unnamed customer'; title = f"{customer_name} - {concept}"; offer_id = uid('offer', offer_number or title)
        score = min(98, round((probability or 20) * 0.55 + min(value / 150000, 30) + (18 if status == 'follow_up' else 10 if status == 'won' else 4)))
        meta = context_map.get(normalize_key(customer_name), account_metadata(customer_name))
        context = motive or ('Offer sold and pending project execution handoff.' if status == 'won' else 'Open opportunity that requires commercial follow-up based on workbook evidence.' if status == 'follow_up' else 'Lost opportunity retained for learning and future recovery review.')
        context = f"{context} {meta['focus']}".strip()
        next_action = 'Launch project activation, confirm milestones, and align engineering, procurement, FAT, shipping, and installation.' if status == 'won' else 'Confirm the next customer touchpoint, validate blockers, and keep the offer active until a decision is reached.' if status == 'follow_up' else 'Document the loss reason and decide whether to recover the account with a revised value proposition.'
        documents = find_offer_documents(offer_number, customer_name, concept, offer_documents)
        project_folder = find_project_folder(customer_name)
        offer = {'id': offer_id, 'offer_number': offer_number or f'OFF-{len(offers)+1:03d}', 'title': title, 'customer_name': customer_name, 'company_name': 'Ingecart 2018 SL', 'project_description': concept, 'currency': 'EUR', 'status': status, 'contract_value': value, 'score': score, 'global_score': score, 'probability': probability or 15, 'context': context, 'next_action': next_action, 'source': str(OFFERS_BOOK), 'submitted_at': submitted, 'decision_date': final_decision or None, 'updated_at': submitted + 'T09:00:00', 'site': site, 'country': country, 'region': region, 'kam': clean(row[5]) or 'Ingecart', 'document_paths': documents, 'project_folder': project_folder}
        offers.append(offer)
        if status == 'won':
            orders.append({'poDate': final_decision or submitted, 'firstOfferDate': submitted, 'oppNumber': offer['offer_number'], 'region': region, 'country': country, 'customerName': customer_name, 'scope': concept, 'productFamily': concept, 'segment': 'Industrial automation', 'purchasingYear': (final_decision or submitted)[:4], 'purchasingQuarter': quarter_from_date(final_decision or submitted), 'purchasingMonth': datetime.fromisoformat(final_decision or submitted).strftime('%B') if re.match(r'\d{4}-\d{2}-\d{2}', final_decision or submitted) else '', 'sellingPrice': value, 'margin': 22 if value >= 100000 else 28, 'kam': clean(row[5]) or 'Ingecart'})
        else:
            opportunities.append({'truthSource': 'ingecart_offer_status_workbook', 'oppNumber': offer['offer_number'], 'status': status, 'region': region, 'country': country, 'customerName': customer_name, 'scope': concept, 'productFamily': concept, 'segment': 'Industrial automation', 'estPurchasingYear': (final_decision or submitted)[:4] if (final_decision or submitted) else '2026', 'estPurchasingQuarter': quarter_from_date(final_decision or submitted), 'estRevenue': value, 'contractProb': probability or 15, 'margin': 20 if probability < 30 else 24, 'contact': customer_name, 'kam': clean(row[5]) or 'Ingecart'})
            priority = 'critical' if status == 'follow_up' and probability >= 50 else 'high' if status == 'follow_up' else 'medium'
            tasks.append({'id': uid('task', offer_id), 'title': f'Offer follow-up: {customer_name} - {concept}', 'description': next_action, 'pillar': 'p0', 'status': 'todo', 'priority': priority, 'category': 'follow_up', 'assignee': 'sales', 'dueDate': (NOW + timedelta(days=3 if priority == 'critical' else 7)).isoformat(), 'createdAt': NOW.isoformat(), 'notes': [context, f'Offer file count: {len(documents)}', f"Project folder: {project_folder or 'n/a'}"]})
    return offers, orders, opportunities, tasks
def parse_leads(context_map):
    request_leads, contacts = [], []
    wb = load_workbook(OPEN_REQUESTS_BOOK, data_only=True); ws = wb[wb.sheetnames[0]]
    for row in ws.iter_rows(min_row=2, values_only=True):
        company, request, channel, comments = clean(row[0]), clean(row[1]), clean(row[2]) or 'manual', clean(row[4])
        if not company and not request:
            continue
        email_match = re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', comments); phone_match = re.search(r'(\+?\d[\d\s]{7,}\d)', comments)
        request_leads.append({'leadName': request or company, 'companyName': company or 'Unknown', 'email': email_match.group(0) if email_match else '', 'phone': phone_match.group(0).strip() if phone_match else '', 'region': 'Spain' if any(k in normalize_key(company) for k in ['saica', 'smith', 'font']) else 'International', 'country': 'Spain' if any(k in normalize_key(company) for k in ['saica', 'smith', 'font']) else '', 'sector': 'Corrugated packaging', 'status': 'active', 'source': channel.lower(), 'owner': 'Ingecart', 'estimatedValue': 45000, 'notes': comments[:500]})
        if email_match:
            contacts.append({'name': company or request, 'email': email_match.group(0), 'phone': phone_match.group(0).strip() if phone_match else '', 'role': 'Commercial contact', 'department': 'Operations', 'companyName': company or 'Unknown', 'region': 'Spain', 'country': 'Spain', 'kam': 'Ingecart', 'notes': request})
    leads = []
    for meta in context_map.values():
        leads.append({'leadName': meta['name'], 'companyName': meta['name'], 'email': '', 'phone': '', 'region': 'Spain' if 'font' in normalize_key(meta['name']) else 'International', 'country': 'Spain' if 'font' in normalize_key(meta['name']) else '', 'sector': 'Corrugated packaging', 'status': meta['stage'], 'source': 'initial_customer_map', 'owner': 'Ingecart', 'estimatedValue': 180000 if meta['priority'] == 'critical' else 95000, 'notes': f"{meta.get('note', '')}. {meta.get('focus', '')}".strip('. ')})
    if PROSPECTION_SPANISH.exists():
        wb = load_workbook(PROSPECTION_SPANISH, data_only=True); ws = wb[wb.sheetnames[0]]
        for row in ws.iter_rows(min_row=2, values_only=True):
            company = clean(row[0])
            if not company:
                continue
            meta = context_map.get(normalize_key(company), account_metadata(company))
            leads.append({'leadName': company, 'companyName': company, 'email': '', 'phone': '', 'region': 'Spain', 'country': 'Spain', 'sector': 'Corrugated packaging', 'status': meta['stage'], 'source': 'afco_spain_prospecting', 'owner': 'Ingecart', 'estimatedValue': 85000 if meta['priority'] == 'critical' else 55000, 'notes': meta['focus']})
    if PROSPECTION_EXPO.exists():
        wb = load_workbook(PROSPECTION_EXPO, data_only=True, read_only=True); ws = wb['List']; companies = {}
        for row in ws.iter_rows(min_row=2, values_only=True):
            company, category = clean(row[0]), clean(row[1])
            if not company or ('pack' not in normalize_key(category) and 'corrugat' not in normalize_key(category) and 'box' not in normalize_key(category)):
                continue
            entry = companies.setdefault(company, {'category': category, 'url': clean(row[2]), 'city': clean(row[9]), 'state': clean(row[10]), 'contacts': []})
            title, email = clean(row[6]), clean(row[7])
            if email or clean(row[3]):
                entry['contacts'].append({'name': clean(row[3]), 'title': title, 'email': email, 'address': clean(row[8]), 'score': (10 if 'director' in normalize_key(title) or 'president' in normalize_key(title) else 7 if 'manager' in normalize_key(title) or 'operations' in normalize_key(title) else 4) + (3 if email else 0)})
        ranked = []
        for company, entry in companies.items():
            meta = context_map.get(normalize_key(company), account_metadata(company))
            top_score = max((contact['score'] for contact in entry['contacts']), default=0)
            ranked.append((len(entry['contacts']) * 2 + top_score + (8 if meta['priority'] == 'critical' else 0), company, entry, meta))
        ranked.sort(key=lambda item: (-item[0], item[1].lower()))
        for _, company, entry, meta in ranked[:MAX_EXPO_COMPANIES]:
            ordered_contacts = sorted(entry['contacts'], key=lambda item: (-item['score'], item['name'], item['email']))
            top_roles = ', '.join(filter(None, [contact['title'] for contact in ordered_contacts[:3]]))
            primary = ordered_contacts[0] if ordered_contacts else {}
            leads.append({'leadName': primary.get('name') or company, 'companyName': company, 'email': primary.get('email', ''), 'phone': '', 'region': 'USA', 'country': 'USA', 'sector': entry['category'] or 'Packaging manufacturers', 'status': meta['stage'], 'source': 'super_corr_expo_2024', 'owner': 'Ingecart', 'estimatedValue': 125000 if meta['priority'] == 'critical' else 90000, 'notes': f"{meta['focus']} Super Corr Expo contacts: {len(ordered_contacts)}. Roles: {top_roles or 'commercial and operations contacts'}. Website: {entry['url'] or 'not provided'}. Location: {entry['city']}, {entry['state']}"})
            for contact in ordered_contacts[:MAX_EXPO_CONTACTS_PER_COMPANY]:
                contacts.append({'name': contact['name'] or company, 'email': contact['email'], 'phone': '', 'role': contact['title'] or 'Commercial contact', 'department': 'Operations', 'companyName': company, 'region': 'USA', 'country': 'USA', 'kam': 'Ingecart', 'notes': f"Source: Super Corr Expo 2024. Address: {contact['address']}".strip()})
    def merge_leads(items):
        merged = {}
        for lead in items + request_leads:
            key = normalize_key(lead.get('companyName') or lead.get('leadName'))
            if not key:
                continue
            current = merged.setdefault(key, dict(lead))
            if len(clean(lead.get('notes'))) > len(clean(current.get('notes'))):
                current['notes'] = lead.get('notes', '')
            current['estimatedValue'] = max(float(current.get('estimatedValue') or 0), float(lead.get('estimatedValue') or 0))
            if clean(lead.get('email')) and not clean(current.get('email')):
                current['email'] = lead['email']
            if clean(lead.get('status')) == 'customer':
                current['status'] = 'customer'
            elif clean(lead.get('status')) == 'follow_up' and clean(current.get('status')) != 'customer':
                current['status'] = 'follow_up'
        return sorted(merged.values(), key=lambda item: (-float(item.get('estimatedValue') or 0), clean(item.get('companyName'))))
    def merge_contacts(items):
        merged = {}
        for contact in items:
            key = normalize_key(contact.get('email') or f"{contact.get('companyName', '')}-{contact.get('name', '')}")
            if key and key not in merged:
                merged[key] = contact
        return sorted(merged.values(), key=lambda item: (clean(item.get('companyName')), clean(item.get('name'))))
    return merge_leads(leads), merge_contacts(contacts)

def build_products():
    products = {}
    def upsert(product):
        key = normalize_key(product['name'])
        if not key:
            return
        current = products.get(key)
        if not current:
            products[key] = product
            return
        current['averageValue'] = max(current.get('averageValue', 0), product.get('averageValue', 0))
        current['estimatedCost'] = max(current.get('estimatedCost', 0), product.get('estimatedCost', 0))
        current['repositories'] = sorted(set(current.get('repositories', []) + product.get('repositories', [])))
        current['characteristics'] = sorted(set(current.get('characteristics', []) + product.get('characteristics', [])))[:6]
        if len(clean(product.get('comments'))) > len(clean(current.get('comments'))):
            current['comments'] = product['comments']
    for path in sorted(PRODUCT_SOLUTIONS.glob('*.html')):
        if path.name.endswith('-es.html'):
            continue
        slug = path.stem; title = html_title(path).split('|')[0].strip(); headers = html_headers(path); value = infer_product_value(slug)
        upsert({'name': title, 'averageValue': value, 'type': 'solution', 'comments': f'Imported from solution page {path.name}', 'category': 'product', 'characteristics': headers[1:] or ['Industrial automation solution'], 'estimatedCost': round(value * 0.72, 2), 'repositories': [str(path)], 'validated': True, 'source': 'generated'})
    if PRODUCT_BOOK.exists():
        wb = load_workbook(PRODUCT_BOOK, data_only=True)
        for raw_name, final_name in PRODUCT_SHEET_NAMES.items():
            if raw_name not in wb.sheetnames:
                continue
            ws = wb[raw_name]
            rows = [[clean(cell) for cell in row[:7]] for row in ws.iter_rows(values_only=True)]
            line_items = [row[0] or row[1] for row in rows if (row[0] or row[1]) and 'totalvalores' not in normalize_key(row[0] or row[1])][:4]
            sale_values = [to_number(row[6]) for row in rows if to_number(row[6]) > 0]
            purchase_values = [to_number(row[4]) for row in rows if to_number(row[4]) > 0]
            average_value = max(sale_values) if sale_values else infer_product_value(final_name.lower())
            estimated_cost = max(purchase_values) if purchase_values else round(average_value * 0.7, 2)
            upsert({'name': final_name, 'averageValue': average_value, 'type': 'service' if raw_name == 'SERVICIO' else 'solution', 'comments': f'Imported from PRODUCTOS INGECART.xlsx / {raw_name}', 'category': 'service' if raw_name == 'SERVICIO' else 'product', 'characteristics': line_items or ['Configured from local product workbook'], 'estimatedCost': estimated_cost, 'repositories': [str(PRODUCT_BOOK)], 'validated': True, 'source': 'generated'})
    for path in sorted(PRODUCT_FOLDER.iterdir()):
        if not path.is_dir():
            continue
        title = title_case_filename(path.name); value = infer_product_value(normalize_key(path.name))
        upsert({'name': title, 'averageValue': value, 'type': 'service' if 'service' in normalize_key(path.name) else 'product', 'comments': f'Imported from local product repository folder {path.name}', 'category': 'service' if 'service' in normalize_key(path.name) else 'product', 'characteristics': ['Configured from local INGECART product repository'], 'estimatedCost': round(value * 0.68, 2), 'repositories': [str(path)], 'validated': True, 'source': 'generated'})
    return sorted(products.values(), key=lambda item: (-item['averageValue'], item['name']))

def build_strategy(orders, opportunities):
    aggregated = {}
    for row in orders + opportunities:
        key = row['productFamily']; item = aggregated.setdefault(key, {'revenue': 0, 'kam': row.get('kam') or 'Ingecart', 'region': row.get('region') or 'International'})
        item['revenue'] += row.get('sellingPrice', row.get('estRevenue', 0))
    return [{'productFamily': family, 'numberOfSegment': str(idx), 'region': info['region'], 'estPurchasingQuarter': 'Q4', 'estRevenue': round(info['revenue'], 2), 'margin': 22, 'kam': info['kam']} for idx, (family, info) in enumerate(sorted(aggregated.items(), key=lambda item: item[1]['revenue'], reverse=True)[:8], start=1)]

def build_aftersales_workspace():
    contracts, opportunities, assets, interventions, spare_parts, seen_offers = [], [], [], [], [], set()
    for idx, path in enumerate(sorted(AFTERSALES_OFFERS.glob('*.html')), start=1):
        title = html_title(path); match = re.search(r'OFF-\d{4}-S\d+', path.name); offer_number = match.group(0) if match else f'OFF-2026-S{130+idx}'; customer = title.split('·')[-1].split(' - ')[-1].strip(); value = 22000 + idx * 4000
        contracts.append({'id': uid('service-contract', offer_number), 'asset_id': None, 'contract_type': 'advanced', 'contract_name': title, 'customer_name': customer, 'annual_value': value, 'recurring_revenue_type': 'subscription', 'status': 'proposal', 'sla_response_hours': 24, 'includes_parts': True, 'includes_remote': True, 'includes_predictive': True, 'kpis': {'visits_per_year': 4, 'remote_reviews': 12}, 'notes': f'Imported from Smart Plant annual maintenance offer {path.name}', 'created_at': NOW.isoformat(), 'updated_at': NOW.isoformat()})
        opportunities.append({'id': uid('after-sales-opportunity', offer_number), 'asset_id': None, 'opportunity_type': 'service_contract', 'title': title, 'description': text_excerpt(path, 500), 'customer_name': customer, 'estimated_value': value, 'probability': 75, 'trigger_signal': 'Smart Plant Dashboard annual recommendation', 'recommended_action': 'Convert the annual maintenance recommendation into a signed service contract and align PM and field service ownership.', 'status': 'proposal', 'ai_generated': True, 'created_at': NOW.isoformat(), 'updated_at': NOW.isoformat()})
        seen_offers.add(offer_number)
    for path in sorted(POSTVENTA.rglob('*')):
        if not path.is_file() or path.name.startswith('~$'):
            continue
        name = path.name; offer_match = re.search(r'OFF-\d{4}-[A-Z]?\d+', name)
        if offer_match:
            offer_number = offer_match.group(0)
            if offer_number not in seen_offers:
                seen_offers.add(offer_number); customer = path.parent.name; title = title_case_filename(name); is_parts = 'spare' in name.lower() or 'recambi' in name.lower(); value = 18000 if is_parts else 35000
                opportunities.append({'id': uid('after-sales-opportunity', offer_number), 'asset_id': None, 'opportunity_type': 'spare_parts' if is_parts else 'upgrade', 'title': title, 'description': f'Imported from local post-sales repository: {path}', 'customer_name': customer, 'estimated_value': value, 'probability': 68 if is_parts else 62, 'trigger_signal': 'POSTVENTA repository evidence', 'recommended_action': 'Follow up the proposal, confirm installed-base need, and attach the commercial next step to the customer account.', 'status': 'proposal', 'ai_generated': False, 'created_at': NOW.isoformat(), 'updated_at': NOW.isoformat()})
        if any(token in name.lower() for token in ['spare', 'recambi', 'parts list']):
            spare_parts.append({'id': uid('spare-part', path), 'part_number': offer_match.group(0) if offer_match else f'SP-{len(spare_parts)+1:03d}', 'part_name': title_case_filename(name), 'description': f'Spare parts reference from {path.parent.name}', 'category': 'mechanical', 'asset_type': 'corrugator line', 'unit_cost': 1200 + len(spare_parts) * 250, 'selling_price': 1850 + len(spare_parts) * 400, 'dynamic_price': 1850 + len(spare_parts) * 400, 'margin_pct': 32, 'stock_quantity': 2 + (len(spare_parts) % 4), 'min_stock_level': 2, 'reorder_point': 3, 'reorder_quantity': 5, 'lead_time_days': 14, 'supplier': 'Ingecart / partner network', 'predicted_demand_monthly': 1, 'demand_trend': 'stable', 'criticality': 'high' if 'sr1400' in name.lower() else 'normal', 'is_active': True, 'created_at': NOW.isoformat(), 'updated_at': NOW.isoformat()})
    for idx, (asset_name, customer, location, country) in enumerate([('IP Waterloo SR-1400', 'IP', 'Waterloo', 'USA'), ('IP Waterloo AMR', 'IP', 'Waterloo', 'USA'), ('DS Smith Dicesa Repair Waste Handling', 'DS SMITH', 'Dicesa', 'Spain'), ('Cartonajes Font Transfer Central', 'Font', 'Sant Sadurni', 'Spain'), ('Cascades NJ Robot FFG', 'Cascades', 'New Jersey', 'USA')], start=1):
        assets.append({'id': uid('asset', asset_name), 'serial_number': f'ASE-ING-{idx:03d}', 'asset_name': asset_name, 'asset_type': 'machine', 'customer_name': customer, 'location': location, 'country': country, 'region': region_from_country(country), 'lifecycle_stage': 'active', 'connection_status': 'registered', 'usage_intensity': 'high', 'customer_value_segment': 'premium' if country == 'USA' else 'standard', 'risk_level': 'medium', 'notes': 'Generated from sold offers and after-sales evidence.', 'created_at': NOW.isoformat(), 'updated_at': NOW.isoformat()})
    for idx, asset in enumerate(assets[:3], start=1):
        interventions.append({'id': uid('intervention', asset['id']), 'asset_id': asset['id'], 'intervention_type': 'preventive' if idx == 1 else 'reactive', 'description': f"Service follow-up for {asset['asset_name']}", 'technician': 'Paco' if idx == 1 else 'Field Service Team', 'duration_hours': 8 if idx == 1 else 12, 'parts_used': [], 'cost': 1200 + idx * 350, 'resolution': 'Pending scheduling with customer' if idx > 1 else 'Service plan proposed', 'scheduled_date': (NOW + timedelta(days=idx * 7)).strftime('%Y-%m-%d'), 'completed_date': None, 'was_remote': idx == 1, 'notes': 'Generated from after-sales repository.', 'created_at': NOW.isoformat()})
    return assets, contracts, interventions, opportunities[:14], spare_parts[:12]

def collect_content_files(root: Path, limit: int):
    files = []
    for ext in ('*.md', '*.txt', '*.html'):
        files.extend(root.rglob(ext))
    files = [path for path in files if path.is_file() and '.venv' not in str(path)]
    return sorted(files, key=lambda path: path.stat().st_mtime, reverse=True)[:limit]

def build_reports_and_content(leads, products):
    marketing, reports = [], []
    report_files = collect_content_files(AI_FACTORY, 5) + collect_content_files(IS_BACKOFFICE, 5)
    for idx, path in enumerate(report_files, start=1):
        summary = text_excerpt(path); title = html_title(path).split('|')[0].strip() if path.suffix.lower() == '.html' else title_case_filename(path.name); source = 'AI Factory' if str(path).startswith(str(AI_FACTORY)) else 'IS Backoffice'
        marketing.append({'id': uid('marketing-content', path), 'title': f'{source}: {title}', 'body': f'{summary}\n\nSource file: {path}', 'summary': summary[:180], 'content_type': 'article', 'platform': 'linkedin', 'hashtags': ['#Ingecart', '#IndustrialAutomation', '#AdaptiveSalesEngine'], 'call_to_action': 'Review the insight and convert it into customer-facing commercial content.', 'suggested_image_description': 'Industrial automation scene aligned with the referenced report.', 'alternative_versions': [], 'intelligence_sources': {'file': str(path), 'source_repository': source}, 'status': 'draft', 'scheduled_at': None, 'published_at': None, 'created_at': NOW.isoformat(), 'updated_at': NOW.isoformat()})
        if idx <= 6:
            reports.append({'id': uid('bi-report', path), 'target_company_name': 'Ingecart 2018 SL', 'target_company_website': 'https://www.ingecart.eu/', 'report_type': 'knowledge:full', 'status': 'completed', 'executive_summary': summary[:800], 'company_profile': {'source': source, 'title': title}, 'financial_analysis': {'signal': 'Imported repository evidence'}, 'product_analysis': {'source_file': str(path)}, 'market_analysis': {'summary': summary[:220]}, 'competitive_analysis': {'repository': source}, 'strategic_analysis': {'recommended_focus': 'commercial execution and productized offers'}, 'valuation': {}, 'sale_propensity': {'score': 72}, 'future_scenarios': {'primary': 'Scale productized portfolio and service business'}, 'recommendations': ['Convert the report into content, account actions, and offer support material.'], 'data_sources': [str(path)], 'hypothesis_log': [{'hypothesis': 'Recent repository output contains reusable commercial insights', 'score': 0.82}], 'created_at': NOW.isoformat(), 'updated_at': NOW.isoformat()})
    reports.append({'id': uid('bi-report', 'prospect-universe'), 'target_company_name': 'Ingecart Prospect Universe 2026', 'target_company_website': '', 'report_type': 'market-intelligence:prospects', 'status': 'completed', 'executive_summary': f'Ingecart has a synchronized prospect base of {len(leads)} validated commercial accounts and prospects, combining existing customers, AFCO Spain corrugated companies, and a curated Super Corr Expo universe.', 'company_profile': {'scope': 'corrugated packaging and industrial automation'}, 'financial_analysis': {'focus': 'prioritize high-probability offers and serviceable accounts'}, 'product_analysis': {'top_products': [product['name'] for product in products[:5]]}, 'market_analysis': {'regions': ['Spain', 'Europe', 'USA', 'LATAM'], 'priority': 'plant-level automation, retrofits, service'}, 'competitive_analysis': {'key_logic': 'plant pain points beat corporate-only targeting'}, 'strategic_analysis': {'next_best_move': 'work the highest-score accounts through active offer follow-up and service-led expansion'}, 'valuation': {}, 'sale_propensity': {'probability': 'HIGH', 'score': 88}, 'future_scenarios': {'primary': 'scale offer follow-up into execution and installed-base expansion'}, 'recommendations': ['Prioritize accounts with live offers, linked documents, and known operations contacts.', 'Use plant monitoring and service opportunities as a commercial re-entry path.'], 'data_sources': [str(INITIAL_CUSTOMERS_BOOK), str(PROSPECTION_SPANISH), str(PROSPECTION_EXPO), str(CUSTOMER_CONTEXT_DOC)], 'hypothesis_log': [{'hypothesis': 'A focused, evidence-based prospect universe improves offer conversion', 'score': 0.91}], 'created_at': NOW.isoformat(), 'updated_at': NOW.isoformat()})
    marketing.append({'id': uid('marketing-content', 'prospect-universe'), 'title': 'Ingecart targeting playbook for corrugated automation', 'body': 'Use the synchronized prospect universe to focus on plants with active bottlenecks, retrofit needs, and strong service attachment potential.', 'summary': 'Curated targeting guidance built from customers, prospecting lists, and market knowledge.', 'content_type': 'playbook', 'platform': 'internal', 'hashtags': ['#Targeting', '#Corrugated', '#Ingecart'], 'call_to_action': 'Turn the highest-score accounts into follow-up tasks and tailored offers.', 'suggested_image_description': 'Sales pipeline and industrial automation dashboard.', 'alternative_versions': [], 'intelligence_sources': {'sources': [str(INITIAL_CUSTOMERS_BOOK), str(CUSTOMER_CONTEXT_DOC)]}, 'status': 'draft', 'scheduled_at': None, 'published_at': None, 'created_at': NOW.isoformat(), 'updated_at': NOW.isoformat()})
    return marketing[:10], reports[:8]
def build_pack():
    base = read_json(BASE_PACK)
    customer_context = build_customer_context_map()
    offer_documents = build_offer_document_list()
    offers, orders, opportunities, tasks = parse_offers(customer_context, offer_documents)
    leads, contacts = parse_leads(customer_context)
    products = build_products()
    strategy = build_strategy(orders, opportunities)
    assets, contracts, interventions, aftersales_opps, spare_parts = build_aftersales_workspace()
    marketing_content, reports = build_reports_and_content(leads, products)
    projects, project_phases, project_milestones, project_risks, project_gates, project_costs, change_orders = [], [], [], [], [], [], []
    for idx, offer in enumerate([offer for offer in offers if offer['status'] == 'won'], start=1):
        project, phases, milestones, risks, gates, costs, changes = build_project_suite(offer, idx)
        projects.append(project); project_phases.extend(phases); project_milestones.extend(milestones); project_risks.extend(risks); project_gates.extend(gates); project_costs.extend(costs); change_orders.extend(changes)
    company_profile = {**base['companyProfile'], 'company_name': 'Ingecart 2018 SL', 'record_stage': 'validated company pack', 'validation_status': 'validated', 'demo_origin': 'local_sync_2026_09_10', 'main_customer_segments': 'Corrugated groups, converters, OEM support, post-sales installed base', 'additional_notes': f'Synchronized with {len(leads)} leads/prospects, {len(contacts)} linked contacts, {len(offers)} offer records, and {len(products)} product/service entries.'}
    source_registry = {'roots': [str(OFFERS_BOOK.parent), str(PRODUCT_SOLUTIONS), str(PRODUCT_FOLDER), str(PROSPECTION_FOLDER), str(OFFERS_SENT), str(PROJECTS_ROOT), str(POSTVENTA), str(AI_FACTORY), str(IS_BACKOFFICE)], 'matched_file_count': len(offers) + len(products) + len(aftersales_opps) + len(marketing_content) + len(leads) + len(contacts), 'categories': ['offers', 'orders', 'products', 'after-sales', 'projects', 'marketing', 'prospecting', 'accounts'], 'extensions': ['xlsx', 'html', 'docx', 'pdf', 'md', 'txt'], 'example_files': [str(OFFERS_BOOK), str(INITIAL_CUSTOMERS_BOOK), str(PROSPECTION_EXPO)]}
    base_emails = {c.get('email') for c in base.get('contacts', [])}
    pack = {
        'companyProfile': company_profile,
        'orders': orders,
        'products': products,
        'opportunities': opportunities,
        'strategy': strategy,
        'leads': leads,
        'contacts': base.get('contacts', []) + [contact for contact in contacts if contact.get('email') and contact.get('email') not in base_emails],
        'tasks': tasks,
        'entityRegistries': {'sourceRegistry': source_registry},
        'workspace': {
            'social_media_accounts': [
                {'id': uid('social', 'linkedin'), 'platform': 'linkedin', 'profile_url': 'https://es.linkedin.com/company/ingecart', 'account_name': 'Ingecart', 'is_enabled': True, 'api_credentials': {}, 'posting_preferences': {'auto_post': False, 'content_types': ['article', 'update'], 'frequency': 'weekly'}, 'notes': 'Main corporate channel'},
                {'id': uid('social', 'web'), 'platform': 'website', 'profile_url': 'https://www.ingecart.eu/', 'account_name': 'Ingecart.eu', 'is_enabled': True, 'api_credentials': {}, 'posting_preferences': {'auto_post': False, 'content_types': ['article'], 'frequency': 'manual'}, 'notes': 'Corporate site reference'}
            ],
            'marketing_content': marketing_content,
            'business_intelligence_reports': reports,
            'offers': offers,
            'offer_scores': [{'id': uid('offer-score', offer['id']), 'offer_id': offer['id'], 'global_score': offer['global_score'], 'margin_score': 70, 'risk_score': 65, 'risk_factors': [offer['context']], 'recommendations': [offer['next_action']], 'ai_explanation': offer['context'], 'created_at': offer['updated_at'], 'updated_at': offer['updated_at']} for offer in offers],
            'installed_base_assets': assets,
            'service_contracts': contracts,
            'service_interventions': interventions,
            'after_sales_opportunities': aftersales_opps,
            'spare_parts': spare_parts,
            'projects': projects,
            'project_phases': project_phases,
            'project_milestones': project_milestones,
            'project_risks': project_risks,
            'project_gates': project_gates,
            'project_costs': project_costs,
            'change_orders': change_orders,
        },
        'recommendedActionQueue': [task['title'] for task in tasks[:12]],
        'sourceRegistry': source_registry,
        'evidenceHighlights': [
            'Commercial offer workbook imported from Ingecart local repository with live, sold, and lost offers linked to local evidence files.',
            'Products derived from Ingesite solutions, the Ingecart product workbook, and local product knowledge folders.',
            'Prospects synchronized from initial customer intelligence, AFCO Spain corrugated targets, and a curated Super Corr Expo universe.',
            'After-sales opportunities and annual maintenance offers synchronized from Smart Plant and POSTVENTA sources.',
        ],
    }
    return pack

def main():
    pack = build_pack()
    for output in OUTPUTS:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'Wrote {output}')
    print('offers', len(pack['workspace']['offers']))
    print('orders', len(pack['orders']))
    print('opportunities', len(pack['opportunities']))
    print('products', len(pack['products']))
    print('projects', len(pack['workspace']['projects']))
    print('after_sales_opportunities', len(pack['workspace']['after_sales_opportunities']))
    print('marketing_content', len(pack['workspace']['marketing_content']))
    print('leads', len(pack['leads']))
    print('contacts', len(pack['contacts']))
    print('reports', len(pack['workspace']['business_intelligence_reports']))

if __name__ == '__main__':
    main()
