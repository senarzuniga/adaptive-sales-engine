import emailOpportunities from '../../data/from_email_context/ece_opportunities_from_email_context.json';

type Row = Record<string, unknown>;

export type OfferKind = 'standard' | 'service';

export type ServiceOpportunityType =
  | 'maintenance'
  | 'digital'
  | 'reliability'
  | 'spares'
  | 'retrofit'
  | 'contract-expansion';

export interface ServiceOpportunityCandidate {
  id: string;
  title: string;
  customerName: string;
  description: string;
  recommendedAction: string;
  recommendedScope: string;
  triggerSignal: string;
  opportunityType: ServiceOpportunityType;
  sourceType: string;
  sourceLabel: string;
  estimatedValue: number;
  probability: number;
  urgency: 'high' | 'medium' | 'low';
  score: number;
  aiGenerated: boolean;
  status: string;
  knownOfferNumber?: string;
  referenceDocuments: string[];
}

export interface ServiceOfferDraftSeed {
  offerKind: OfferKind;
  title: string;
  customerName: string;
  projectDescription: string;
  currency: string;
  targetMargin: number;
  documentLanguage: 'en' | 'es';
  linkedOpportunityId: string;
  linkedOpportunityTitle: string;
  serviceContent: ServiceOfferContent;
  items: Array<{
    id: string;
    name: string;
    type: 'service';
    quantity: number;
    description: string;
    costLines: Array<{
      id: string;
      category: string;
      lineItem: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
      surchargePct: number;
      structurePct: number;
      hours: number;
      hourlyRate: number;
      days: number;
      resources: number;
      notes: string;
    }>;
  }>;
}

export interface BuildServiceOpportunityInput {
  opportunities: Row[];
  assets: Row[];
  contracts: Row[];
  interventions: Row[];
  spareParts: Row[];
}

type EmailContextOpportunity = {
  opportunity_id: string;
  name: string;
  status: string;
  probability: number;
  value: number;
  owner: string;
  customer: string;
  critical_items_count: number;
  risk_level: string | null;
  description: string;
  metadata?: {
    project_type?: string | null;
    location?: string | null;
  };
};

export const SMART_PLANT_ANNUAL_OFFER_REFERENCES = [
  {
    offerNumber: 'OFF-2026-S133',
    customerName: 'Cartonajes Font',
    title: 'Smart Plant Annual Maintenance Programme + INGEPRO',
    htmlPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\html\\OFF-2026-S133.html',
    wordPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\word\\OFF-2026-S133.docx',
  },
  {
    offerNumber: 'OFF-2026-S134',
    customerName: 'Cascades Sonoco-Calgary',
    title: 'Smart Plant Annual Maintenance Programme + INGEPRO',
    htmlPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\html\\OFF-2026-S134.html',
    wordPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\word\\OFF-2026-S134.docx',
  },
  {
    offerNumber: 'OFF-2026-S135',
    customerName: 'Cascades Sonoco-Waterloo',
    title: 'Smart Plant Annual Maintenance Programme + INGEPRO',
    htmlPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\html\\OFF-2026-S135.html',
    wordPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\word\\OFF-2026-S135.docx',
  },
  {
    offerNumber: 'OFF-2026-S136',
    customerName: 'IP Piscataway',
    title: 'Smart Plant Annual Maintenance Programme + INGEPRO',
    htmlPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\html\\OFF-2026-S136.html',
    wordPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\word\\OFF-2026-S136.docx',
  },
  {
    offerNumber: 'OFF-2026-S137',
    customerName: 'Sterner Global-Mastercorr',
    title: 'Smart Plant Annual Maintenance Programme + INGEPRO',
    htmlPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\html\\OFF-2026-S137.html',
    wordPath: 'C:\\Users\\isena\\OneDrive\\Attachments\\smart_plant_annual_offers\\word\\OFF-2026-S137.docx',
  },
] as const;

const SERVICE_DRAFT_KEY_PREFIX = 'acs_service_offer_draft_';
const emailContextRows = emailOpportunities as EmailContextOpportunity[];

const text = (value: unknown) => String(value || '').trim();
const num = (value: unknown) => Number(value || 0);
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(value)));
const slug = (value: string) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';

const opportunityTypeLabel: Record<ServiceOpportunityType, string> = {
  maintenance: 'Annual maintenance',
  digital: 'Smart plant enablement',
  reliability: 'Reliability recovery',
  spares: 'Critical spare parts',
  retrofit: 'Retrofit & modernization',
  'contract-expansion': 'Contract expansion',
};

export type ServiceOfferSection = 'scope' | 'tpm-preventive' | 'service-deliverables' | 'why-ingecart' | 'covered-machines' | 'commercial' | 'response-sla';

export type ServiceOfferContent = {
  sections: ServiceOfferSection[];
  scopeSummary: string;
  serviceDescription: string;
  valueProposition: string;
  deliverables: string[];
  exclusions: string[];
  assumptions: string[];
  tpmProgramme: {
    title: string;
    daily: string[];
    weekly: string[];
    monthly: string[];
    quarterly: string[];
  };
  whyIngecart: string[];
  coveredMachines: string[];
  responseSla: {
    label: string;
    value: string;
  }[];
};

const serviceOfferContentByType: Record<ServiceOpportunityType, ServiceOfferContent> = {
  maintenance: {
    sections: ['scope', 'tpm-preventive', 'service-deliverables', 'why-ingecart', 'covered-machines', 'commercial', 'response-sla'],
    scopeSummary: 'Annual preventive maintenance programme for corrugated cardboard production and converting equipment, covering mechanical, electrical, automation and control layers.',
    serviceDescription: 'The programme combines scheduled Total Productive Maintenance (TPM) routines, condition monitoring, remote support via INGEPRO and a spare-parts policy to maximize equipment availability and reduce unplanned downtime.',
    valueProposition: 'Move from reactive repair to predictable asset performance: longer component life, stable output, fewer emergency interventions and a clear annual service budget.',
    deliverables: [
      'Annual maintenance calendar aligned to production stops.',
      'Operator, maintenance and technician-level TPM checklists.',
      'Condition reports with wear trending and corrective recommendations.',
      'Remote monitoring via INGEPRO dashboard and alarm follow-up.',
      'Spare-parts advisory and critical-stock recommendations.',
      'Service report and KPI review after each visit.',
    ],
    exclusions: [
      'Major repairs or rebuilds outside the agreed TPM scope.',
      'Consumables, blades, belts and wear parts not listed in the agreement.',
      'Civil works, foundations, customer utilities and third-party interfaces.',
      'Production losses due to customer-side delays or unavailable access.',
    ],
    assumptions: [
      'Customer provides safe, prepared access during scheduled windows.',
      'Equipment is reachable with standard lifting means.',
      'Technical documentation and latest software backups are available.',
      'Customer notifies critical alarms within the agreed escalation window.',
    ],
    tpmProgramme: {
      title: 'INGETRANS & corrugated line TPM preventive maintenance',
      daily: [
        'Verify pneumatic pressures (6-8 bar).',
        'Check hydraulic oil level.',
        'Visual inspection of rollers and belts.',
        'General cleaning of work area.',
      ],
      weekly: [
        'Lubrication of critical points (bearings, guides).',
        'Belt tension check.',
        'Roller alignment verification.',
        'Compressed air filter cleaning.',
      ],
      monthly: [
        'Calibration of measuring systems.',
        'Blade and counter-blade condition check.',
        'Safety system verification.',
        'Main motor vibration analysis.',
      ],
      quarterly: [
        'Hydraulic oil change.',
        'Complete electrical system revision.',
        'Critical parts wear verification.',
        'Control software update when applicable.',
      ],
    },
    whyIngecart: [
      'Over 30 years of experience in the corrugated cardboard sector.',
      'Own 1,200 m² workshop with specialized machinery.',
      'Permanent stock of critical spare parts.',
      'Multidisciplinary technical team (mechanical, electrical, automation).',
      '24-48 h response time in the peninsula.',
      'Deep equipment knowledge from own manufacturing and assembly.',
      'Complete plans, technical documentation and original spare parts.',
      'Continuous training for client operators and remote support included.',
    ],
    coveredMachines: [
      'Corrugating line: single facer, double facer, preheaters, glue machine bridge, humidifier group.',
      'Converting line: slitter-scorer, rotary and counter-rotary knives, flexographic printer, rotary die-cutter, flatbed die-cutter.',
      'Handling and finishing: automatic stacker, sheet counter, palletizing system, strapping machine, conveyor belts.',
      'Auxiliary equipment: correcting groups, paper feeding systems, air compressors, hydraulic power units, glue drying / curing ovens.',
      'Control systems: PLCs, automatic systems, sensors, encoders, frequency drives, operator panels / HMI.',
    ],
    responseSla: [
      { label: 'Remote response', value: 'Within 4 business hours' },
      { label: 'On-site urgent dispatch', value: '24-48 h in peninsula' },
      { label: 'Scheduled preventive visit', value: 'Agreed annual calendar' },
      { label: 'Service report delivery', value: 'Within 5 business days' },
    ],
  },
  digital: {
    sections: ['scope', 'service-deliverables', 'why-ingecart', 'commercial', 'response-sla'],
    scopeSummary: 'Smart Plant / INGEPRO digital enablement: machine connectivity, signal validation, dashboard deployment and remote-service governance.',
    serviceDescription: 'Connects installed equipment to the INGEPRO digital layer so the customer can monitor status, alarms and KPIs, while INGECART provides remote support and predictive intervention triggers.',
    valueProposition: 'Turn operational silence into actionable intelligence: faster troubleshooting, data-driven maintenance decisions and a single pane for plant performance.',
    deliverables: [
      'Connectivity assessment and signal mapping.',
      'Edge gateway / MES interface configuration within agreed data scope.',
      'Dashboard deployment with availability, alarms and production KPIs.',
      'Alarm governance and escalation protocol.',
      'Quarterly KPI review and improvement recommendations.',
    ],
    exclusions: [
      'Customer network infrastructure beyond the agreed edge gateway.',
      'Third-party MES / ERP integration outside the defined data contract.',
      'Cybersecurity audits or corporate IT certification.',
      'Production data ownership and storage beyond the contracted retention.',
    ],
    assumptions: [
      'Customer provides network access, IP addresses and firewall rules.',
      'Machine controllers support the agreed communication protocol.',
      'Customer nominates a technical counterpart for alarm validation.',
      'Backups and change-control windows are coordinated in advance.',
    ],
    tpmProgramme: {
      title: 'Digital layer operating routines',
      daily: ['Dashboard health check and active alarm review.'],
      weekly: ['Connectivity stability report and missed-signal triage.'],
      monthly: ['KPI trend review and false-alarm tuning.'],
      quarterly: ['Dashboard evolution, new signal onboarding and security patch review.'],
    },
    whyIngecart: [
      'Proven INGEPRO platform built from field experience.',
      'Combined mechanical, electrical and automation expertise.',
      'Remote diagnostics linked to the original equipment know-how.',
      'Clear data-scope governance and customer-owned dashboards.',
    ],
    coveredMachines: [
      'Any INGECART or Ingetrans equipment with controller-level connectivity.',
      'Supported PLCs, HMIs, sensors, encoders and frequency drives.',
    ],
    responseSla: [
      { label: 'Remote response', value: 'Within 4 business hours' },
      { label: 'Connectivity incident', value: 'Next business day' },
      { label: 'Dashboard update', value: '5 business days' },
      { label: 'Quarterly review', value: 'Scheduled' },
    ],
  },
  reliability: {
    sections: ['scope', 'service-deliverables', 'why-ingecart', 'commercial', 'response-sla'],
    scopeSummary: 'Reliability recovery programme that converts recent reactive interventions into a structured root-cause and corrective-roadmap service.',
    serviceDescription: 'A time-bound technical engagement to stabilise asset performance: incident review, root-cause workshop, corrective backlog, planned visits and closure evidence.',
    valueProposition: 'Stop recurring breakdowns, reduce emergency spend and lock in a stable operating baseline before moving to a preventive contract.',
    deliverables: [
      'Incident history review and failure-mode classification.',
      'Root-cause workshop with customer maintenance team.',
      'Prioritised corrective-action backlog with parts and labour estimates.',
      'Planned service visits to execute agreed corrections.',
      'Remote check-ins and formal closure evidence per issue.',
    ],
    exclusions: [
      'Major redesigns or capacity changes outside the recovery scope.',
      'Parts not explicitly listed in the corrective backlog.',
      'Production scheduling or customer-side coordination delays.',
      'Third-party equipment not covered by the agreed scope.',
    ],
    assumptions: [
      'Customer shares complete incident history and access to equipment.',
      'Decision makers attend the root-cause workshop.',
      'Corrective actions are approved before execution.',
      'Service windows are confirmed at least one week in advance.',
    ],
    tpmProgramme: {
      title: 'Reliability recovery cadence',
      daily: ['Monitor active alarms and escalation log.'],
      weekly: ['Progress review of corrective-action backlog.'],
      monthly: ['Visit execution and closure evidence sign-off.'],
      quarterly: ['Reliability KPI review and transition to preventive contract.'],
    },
    whyIngecart: [
      'Direct knowledge of Ingetrans and INGECART equipment behaviour.',
      'Multidisciplinary team to address mechanical, electrical and software causes.',
      'Structured methodology that turns incidents into prevention.',
      'Remote support included between visits.',
    ],
    coveredMachines: [
      'Equipment affected by recent reactive interventions.',
      'Related upstream / downstream interfaces included in the agreed scope.',
    ],
    responseSla: [
      { label: 'Remote response', value: 'Within 4 business hours' },
      { label: 'On-site urgent dispatch', value: '24-48 h in peninsula' },
      { label: 'Corrective action plan', value: '10 business days' },
      { label: 'Closure report', value: '5 business days after visit' },
    ],
  },
  spares: {
    sections: ['scope', 'service-deliverables', 'why-ingecart', 'commercial', 'response-sla'],
    scopeSummary: 'Critical spare parts frame agreement to secure availability, reduce downtime risk and lock price hold for the contract period.',
    serviceDescription: 'A parts advisory and provisioning service based on the installed base and stock status: recommended quantities, lead times, price validity and expedite option.',
    valueProposition: 'Avoid production stops caused by missing parts, standardise critical stock levels and budget spare-part spend with a known annual frame.',
    deliverables: [
      'Critical spare parts list by machine and risk level.',
      'Recommended stock quantities and reorder points.',
      'Confirmed lead times and price hold for the frame period.',
      'Expedite option for emergency requirements.',
      'Annual review and list update.',
    ],
    exclusions: [
      'Consumables not listed in the agreed frame.',
      'Parts for equipment outside the scope.',
      'Custom-manufactured parts with supplier lead times beyond standard.',
      'Storage, insurance or customs costs not included in the price.',
    ],
    assumptions: [
      'Customer confirms the installed-base configuration.',
      'Stock locations and handling means are provided by the customer.',
      'Orders are placed through the agreed channel.',
      'Forecasts are shared for long-lead critical parts.',
    ],
    tpmProgramme: {
      title: 'Spare parts governance',
      daily: ['Monitor emergency part requests.'],
      weekly: ['Stock status review and replenishment alerts.'],
      monthly: ['Usage analysis and recommendation updates.'],
      quarterly: ['Frame agreement review and critical-part refresh.'],
    },
    whyIngecart: [
      'Permanent stock of critical parts in our 1,200 m² workshop.',
      'Original spare parts and manufacturer drawings.',
      'Direct link between parts knowledge and field service team.',
      'Fast dispatch and 24-48 h response capability.',
    ],
    coveredMachines: [
      'Ingetrans and INGECART equipment listed in the frame agreement.',
      'Corrugators, slitters, stackers, transport and correction groups as agreed.',
    ],
    responseSla: [
      { label: 'Stock part dispatch', value: '24-48 h' },
      { label: 'Non-stock quotation', value: '3 business days' },
      { label: 'Long-lead forecast review', value: 'Monthly' },
      { label: 'Frame price validity', value: 'As per agreement' },
    ],
  },
  retrofit: {
    sections: ['scope', 'service-deliverables', 'why-ingecart', 'commercial', 'response-sla'],
    scopeSummary: 'Retrofit and modernization service to extend equipment life, close performance gaps and integrate new control or safety functionality.',
    serviceDescription: 'A structured upgrade scope covering assessment, engineering proposal, component replacement, commissioning and acceptance for the agreed systems.',
    valueProposition: 'Delay capital expenditure, improve safety and output, and align ageing equipment with current production and digital requirements.',
    deliverables: [
      'Technical assessment and upgrade proposal.',
      'Mechanical / electrical / software modernization plan.',
      'Component supply and installation support.',
      'Commissioning, SAT and operator training.',
      'As-built documentation update.',
    ],
    exclusions: [
      'Full line replacement or capacity expansion beyond agreed scope.',
      'Customer utilities, civil works and third-party certifications.',
      'Raw material or process guarantees outside the retrofit subject.',
      'Extended production support not listed in the acceptance plan.',
    ],
    assumptions: [
      'Customer provides historical performance data and access windows.',
      'Upgrade proposal is approved before procurement.',
      'Customer confirms interfaces and production constraints.',
      'Acceptance criteria are agreed before commissioning.',
    ],
    tpmProgramme: {
      title: 'Modernization operating routines after retrofit',
      daily: ['Operator visual checks on upgraded systems.'],
      weekly: ['Control alarm review and parameter drift check.'],
      monthly: ['Performance vs. baseline KPI review.'],
      quarterly: ['Preventive maintenance calendar update and spare-part refresh.'],
    },
    whyIngecart: [
      'Own design and assembly knowledge of Ingetrans equipment.',
      'Capability to modernise mechanical, electrical and control systems.',
      'Field-proven integration methodology.',
      'Original documentation and post-upgrade support.',
    ],
    coveredMachines: [
      'Ingetrans corrugators, slitters, stackers and transport systems.',
      'Control upgrades for PLCs, HMIs, drives and safety systems.',
    ],
    responseSla: [
      { label: 'Technical assessment', value: '10 business days' },
      { label: 'Proposal delivery', value: '15 business days' },
      { label: 'On-site commissioning', value: 'Agreed window' },
      { label: 'SAT closure', value: 'Within 5 business days' },
    ],
  },
  'contract-expansion': {
    sections: ['scope', 'service-deliverables', 'why-ingecart', 'commercial', 'response-sla'],
    scopeSummary: 'Expansion of an existing after-sales contract to cover additional equipment, locations or service levels.',
    serviceDescription: 'Extends an active maintenance, digital or reliability agreement with add-on scope, updated calendars, KPIs and commercial conditions.',
    valueProposition: 'Leverage an existing service relationship to cover more assets under the same governance, reporting and escalation model.',
    deliverables: [
      'Add-on scope definition and asset registration.',
      'Updated maintenance calendar and SLA.',
      'Consolidated reporting across all covered assets.',
      'Single point of contact and unified escalation protocol.',
    ],
    exclusions: [
      'Assets not listed in the expansion amendment.',
      'New equipment under manufacturer warranty without transfer agreement.',
      'Services outside the expanded contract family.',
    ],
    assumptions: [
      'Current contract status and performance are reviewed.',
      'Customer confirms asset list and access windows.',
      'Commercial amendment is signed before expanded work begins.',
    ],
    tpmProgramme: {
      title: 'Expanded contract operating routines',
      daily: ['Monitor active alarms across all covered sites.'],
      weekly: ['Consolidated service ticket review.'],
      monthly: ['Cross-site KPI report.'],
      quarterly: ['Contract review and continuous-improvement roadmap.'],
    },
    whyIngecart: [
      'Unified service governance across multiple assets and sites.',
      'Single reporting model and consistent SLA.',
      'Scalable from one machine to a full plant.',
    ],
    coveredMachines: [
      'All assets listed in the expansion amendment.',
    ],
    responseSla: [
      { label: 'Remote response', value: 'Within 4 business hours' },
      { label: 'On-site urgent dispatch', value: '24-48 h in peninsula' },
      { label: 'Monthly report', value: '5 business days' },
      { label: 'Quarterly business review', value: 'Scheduled' },
    ],
  },
};

export function buildServiceOfferContent(opportunityType: ServiceOpportunityType): ServiceOfferContent {
  return serviceOfferContentByType[opportunityType] || serviceOfferContentByType.maintenance;
}

const targetMarginByType: Record<ServiceOpportunityType, number> = {
  maintenance: 35,
  digital: 38,
  reliability: 34,
  spares: 28,
  retrofit: 30,
  'contract-expansion': 33,
};

const estimateValueByType: Record<ServiceOpportunityType, number> = {
  maintenance: 85000,
  digital: 42000,
  reliability: 36000,
  spares: 22000,
  retrofit: 68000,
  'contract-expansion': 55000,
};

function buildServiceCostLine(id: string, category: string, lineItem: string, notes: string) {
  return {
    id,
    category,
    lineItem,
    quantity: 1,
    unitCost: 0,
    totalCost: 0,
    surchargePct: 0,
    structurePct: 0,
    hours: 0,
    hourlyRate: 0,
    days: 0,
    resources: 0,
    notes,
  };
}

function computeScore(estimatedValue: number, probability: number, urgency: 'high' | 'medium' | 'low', aiGenerated: boolean, sourceType: string) {
  let score = Math.min(32, estimatedValue / 4000);
  score += probability * 0.38;
  score += urgency === 'high' ? 20 : urgency === 'medium' ? 10 : 4;
  if (aiGenerated) score += 6;
  if (sourceType === 'smart-plant-reference') score += 14;
  if (sourceType === 'email-context') score += 10;
  return clamp(score);
}

function normalizeWorkspaceOpportunity(row: Row): ServiceOpportunityCandidate {
  const estimatedValue = num(row.estimated_value);
  const probability = num(row.probability || 50);
  const title = text(row.title) || 'After-sales opportunity';
  const customerName = text(row.customer_name) || 'Ingecart account';
  const opportunityType = (text(row.opportunity_type).toLowerCase().includes('spare') ? 'spares'
    : text(row.opportunity_type).toLowerCase().includes('retro') ? 'retrofit'
      : text(row.opportunity_type).toLowerCase().includes('digital') ? 'digital'
        : text(row.opportunity_type).toLowerCase().includes('contract') ? 'contract-expansion'
          : 'maintenance') as ServiceOpportunityType;
  const urgency = text(row.urgency).toLowerCase() === 'high' ? 'high' : probability >= 70 ? 'high' : probability >= 45 ? 'medium' : 'low';
  return {
    id: text(row.id) || `workspace-${slug(customerName)}-${slug(title)}`,
    title,
    customerName,
    description: text(row.description),
    recommendedAction: text(row.recommended_action) || `Build a clear ${opportunityTypeLabel[opportunityType].toLowerCase()} offer with scope, assumptions and commercial milestones.`,
    recommendedScope: text(row.recommended_scope) || text(row.description) || 'Define the exact deliverables, service calendar, exclusions and customer inputs.',
    triggerSignal: text(row.trigger_signal) || 'Existing after-sales opportunity already identified in ASE.',
    opportunityType,
    sourceType: 'workspace',
    sourceLabel: 'ASE workspace',
    estimatedValue: estimatedValue || estimateValueByType[opportunityType],
    probability,
    urgency,
    score: computeScore(estimatedValue || estimateValueByType[opportunityType], probability, urgency, text(row.ai_generated) === 'true' || Boolean(row.ai_generated), 'workspace'),
    aiGenerated: Boolean(row.ai_generated),
    status: text(row.status) || 'identified',
    knownOfferNumber: text(row.offer_number),
    referenceDocuments: Array.isArray(row.document_paths) ? row.document_paths.map((value) => text(value)).filter(Boolean) : [],
  };
}

function buildGroupedCustomerSignal<T extends Row>(rows: T[], key: keyof T) {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => {
    const name = text(row[key]);
    if (!name) return;
    grouped.set(name, [...(grouped.get(name) || []), row]);
  });
  return grouped;
}

function pushCandidate(target: ServiceOpportunityCandidate[], candidate: ServiceOpportunityCandidate) {
  const dedupeKey = `${candidate.customerName.toLowerCase()}::${candidate.title.toLowerCase()}`;
  const existingIndex = target.findIndex((item) => `${item.customerName.toLowerCase()}::${item.title.toLowerCase()}` === dedupeKey);
  if (existingIndex === -1) {
    target.push(candidate);
    return;
  }
  if (candidate.score > target[existingIndex].score) target[existingIndex] = candidate;
}

export function buildServiceTopOpportunities(input: BuildServiceOpportunityInput): ServiceOpportunityCandidate[] {
  const candidates: ServiceOpportunityCandidate[] = [];

  input.opportunities.forEach((row) => pushCandidate(candidates, normalizeWorkspaceOpportunity(row)));

  SMART_PLANT_ANNUAL_OFFER_REFERENCES.forEach((reference) => {
    pushCandidate(candidates, {
      id: `smart-plant-${reference.offerNumber.toLowerCase()}`,
      title: `${reference.title} - ${reference.customerName}`,
      customerName: reference.customerName,
      description: 'Validated Smart Plant + INGEPRO service structure already available as a commercial reference for annual after-sales coverage.',
      recommendedAction: 'Activate a service-offer draft, adapt the annual maintenance scope to the current plant reality and refresh the commercial value proposition before printing.',
      recommendedScope: 'Annual preventive maintenance programme, digital monitoring / INGEPRO layer, performance follow-up cadence, exclusions, parts policy and optional modernization roadmap.',
      triggerSignal: `Existing annual service offer reference ${reference.offerNumber} available in Smart Plant attachments.`,
      opportunityType: 'maintenance',
      sourceType: 'smart-plant-reference',
      sourceLabel: 'Smart Plant annual offers',
      estimatedValue: estimateValueByType.maintenance,
      probability: 82,
      urgency: 'high',
      score: computeScore(estimateValueByType.maintenance, 82, 'high', true, 'smart-plant-reference'),
      aiGenerated: true,
      status: 'reference_ready',
      knownOfferNumber: reference.offerNumber,
      referenceDocuments: [reference.wordPath, reference.htmlPath],
    });
  });

  emailContextRows.forEach((row) => {
    const customerName = text(row.name || row.customer) || 'Email context account';
    const estimatedValue = num(row.value) > 0 ? num(row.value) * 0.18 : estimateValueByType.reliability;
    const probability = clamp(num(row.probability) * 100, 15, 95);
    const critical = num(row.critical_items_count);
    const opportunityType = /infrastructure|equipment|maintenance|acceptance/i.test(`${row.description} ${row.metadata?.project_type || ''}`) ? 'reliability' : 'retrofit';
    pushCandidate(candidates, {
      id: `email-${slug(row.opportunity_id)}`,
      title: `${opportunityTypeLabel[opportunityType]} recovery plan - ${customerName}`,
      customerName,
      description: `Email context detects ${critical} critical items and open coordination points around ${text(row.metadata?.project_type) || 'plant execution'}.`,
      recommendedAction: 'Prepare a focused post-sales recovery / support offer that closes the critical items, defines onsite support cadence and secures the next technical decision with the customer.',
      recommendedScope: 'Kickoff review, plant or equipment technical assessment, punch-list closure support, escalation protocol, service visits and formal decision log governance.',
      triggerSignal: `${text(row.description)}${text(row.metadata?.location) ? ` | ${text(row.metadata?.location)}` : ''}`,
      opportunityType,
      sourceType: 'email-context',
      sourceLabel: 'Email context',
      estimatedValue,
      probability,
      urgency: critical >= 4 ? 'high' : probability >= 55 ? 'medium' : 'low',
      score: computeScore(estimatedValue, probability, critical >= 4 ? 'high' : probability >= 55 ? 'medium' : 'low', true, 'email-context'),
      aiGenerated: true,
      status: text(row.status) || 'identified',
      referenceDocuments: [],
    });
  });

  const assetsByCustomer = buildGroupedCustomerSignal(input.assets, 'customer_name');
  assetsByCustomer.forEach((customerAssets, customerName) => {
    const highRisk = customerAssets.filter((asset) => text(asset.risk_level).toLowerCase() === 'high').length;
    const endOfLife = customerAssets.filter((asset) => text(asset.lifecycle_stage).toLowerCase() === 'end-of-life').length;
    const disconnected = customerAssets.filter((asset) => text(asset.connection_status).toLowerCase() !== 'connected').length;
    if (highRisk > 0 || endOfLife > 0) {
      const estimatedValue = estimateValueByType.maintenance + highRisk * 6000 + endOfLife * 5000;
      pushCandidate(candidates, {
        id: `asset-maint-${slug(customerName)}`,
        title: `Annual maintenance stabilization plan - ${customerName}`,
        customerName,
        description: `${highRisk} high-risk assets and ${endOfLife} end-of-life assets suggest immediate preventive coverage and service governance.`,
        recommendedAction: 'Launch a preventive annual maintenance proposal with visit calendar, critical checkpoints, response SLA and optional parts coverage.',
        recommendedScope: 'Asset baseline review, preventive maintenance routines, operator coaching, remote follow-up, SLA model and optional spare-parts frame agreement.',
        triggerSignal: `${highRisk} high-risk assets | ${endOfLife} end-of-life assets`,
        opportunityType: 'maintenance',
        sourceType: 'installed-base',
        sourceLabel: 'Installed base',
        estimatedValue,
        probability: 78,
        urgency: 'high',
        score: computeScore(estimatedValue, 78, 'high', true, 'installed-base'),
        aiGenerated: true,
        status: 'identified',
        referenceDocuments: [],
      });
    }
    if (disconnected > 0) {
      const estimatedValue = estimateValueByType.digital + disconnected * 4500;
      pushCandidate(candidates, {
        id: `asset-digital-${slug(customerName)}`,
        title: `Digital Smart Plant enablement - ${customerName}`,
        customerName,
        description: `${disconnected} assets are not connected, limiting plant intelligence and remote support coverage.`,
        recommendedAction: 'Prepare a Smart Plant / INGEPRO activation offer with connectivity scope, dashboard outputs and remote service governance.',
        recommendedScope: 'Machine connectivity, signal validation, dashboard deployment, alarm governance, remote assistance protocol and quarterly KPI review.',
        triggerSignal: `${disconnected} disconnected or only registered assets in the ASE installed base.`,
        opportunityType: 'digital',
        sourceType: 'digital-ecosystem',
        sourceLabel: 'Digital ecosystem / plant data',
        estimatedValue,
        probability: 72,
        urgency: disconnected >= 2 ? 'high' : 'medium',
        score: computeScore(estimatedValue, 72, disconnected >= 2 ? 'high' : 'medium', true, 'digital-ecosystem'),
        aiGenerated: true,
        status: 'identified',
        referenceDocuments: [],
      });
    }
  });

  const interventionsByCustomer = buildGroupedCustomerSignal(input.interventions, 'customer_name');
  interventionsByCustomer.forEach((customerInterventions, customerName) => {
    const reactive = customerInterventions.filter((intervention) => text(intervention.intervention_type).toLowerCase() === 'reactive');
    if (reactive.length < 2) return;
    const estimatedValue = estimateValueByType.reliability + reactive.length * 4500;
    pushCandidate(candidates, {
      id: `interventions-${slug(customerName)}`,
      title: `Reliability recovery programme - ${customerName}`,
      customerName,
      description: `${reactive.length} reactive interventions indicate an opportunity to convert emergency support into structured recurring service.`,
      recommendedAction: 'Convert the recurrent incidents into a reliability improvement service offer with root-cause analysis, corrective roadmap and follow-up visits.',
      recommendedScope: 'Incident review, root-cause workshop, corrective action backlog, planned service visits, remote check-ins and closure evidence per issue.',
      triggerSignal: `${reactive.length} reactive interventions already recorded in ASE.`,
      opportunityType: 'reliability',
      sourceType: 'service-history',
      sourceLabel: 'Service history',
      estimatedValue,
      probability: 76,
      urgency: reactive.length >= 3 ? 'high' : 'medium',
      score: computeScore(estimatedValue, 76, reactive.length >= 3 ? 'high' : 'medium', true, 'service-history'),
      aiGenerated: true,
      status: 'identified',
      referenceDocuments: [],
    });
  });

  const sparePartsByCustomer = buildGroupedCustomerSignal(input.spareParts, 'customer_name');
  sparePartsByCustomer.forEach((customerParts, customerName) => {
    const criticalLowStock = customerParts.filter((part) => text(part.stock_status).toLowerCase() === 'critical' || (num(part.quantity_on_hand) <= num(part.reorder_point) && num(part.reorder_point) > 0));
    if (criticalLowStock.length === 0) return;
    const estimatedValue = criticalLowStock.reduce((sum, part) => sum + (num(part.unit_price) * num(part.quantity_recommended || 1)), estimateValueByType.spares);
    pushCandidate(candidates, {
      id: `spares-${slug(customerName)}`,
      title: `Critical spare parts frame agreement - ${customerName}`,
      customerName,
      description: `${criticalLowStock.length} spare parts are at critical stock or below reorder point; a frame agreement secures availability and reduces downtime risk.`,
      recommendedAction: 'Prepare a spare-parts proposal with recommended quantities, lead times, price hold and availability commitment.',
      recommendedScope: 'Critical parts list, recommended stock levels, lead times, price validity, expedite option and annual review cadence.',
      triggerSignal: `${criticalLowStock.length} critical or low-stock spare parts detected.`,
      opportunityType: 'spares',
      sourceType: 'spare-parts',
      sourceLabel: 'Spare parts intelligence',
      estimatedValue,
      probability: 74,
      urgency: criticalLowStock.length >= 5 ? 'high' : 'medium',
      score: computeScore(estimatedValue, 74, criticalLowStock.length >= 5 ? 'high' : 'medium', true, 'spare-parts'),
      aiGenerated: true,
      status: 'identified',
      referenceDocuments: [],
    });
  });

  return candidates.sort((a, b) => b.score - a.score);
}

export function isServiceOfferNumber(offerNumber?: string) {
  return /^OFF-\d{4}-S\d+$/i.test(text(offerNumber));
}

export function getServiceOfferDraftStorageKey(companyId?: string | null) {
  return `${SERVICE_DRAFT_KEY_PREFIX}${companyId || 'default'}`;
}

export function buildServiceOfferDraftSeed(candidate: ServiceOpportunityCandidate): ServiceOfferDraftSeed {
  return {
    offerKind: 'service',
    title: candidate.title,
    customerName: candidate.customerName,
    projectDescription: `${candidate.recommendedAction} Scope: ${candidate.recommendedScope}`,
    currency: 'EUR',
    targetMargin: targetMarginByType[candidate.opportunityType] || 32,
    documentLanguage: 'en',
    linkedOpportunityId: candidate.id,
    linkedOpportunityTitle: candidate.title,
    items: [{
      id: `svc-${slug(candidate.title)}-${Date.now()}`,
      name: candidate.title,
      type: 'service',
      quantity: 1,
      description: candidate.recommendedScope,
      costLines: [
        buildServiceCostLine(`cl-${Date.now()}-eng`, 'engineering', 'Engineering / project management', 'Project management, scope definition and service governance.'),
        buildServiceCostLine(`cl-${Date.now()}-field`, 'field_service', 'Field service visits', 'On-site service visits according to the agreed calendar.'),
        buildServiceCostLine(`cl-${Date.now()}-remote`, 'remote_service', 'Remote support / INGEPRO monitoring', 'Remote assistance, dashboard monitoring and alarm follow-up.'),
        buildServiceCostLine(`cl-${Date.now()}-parts`, 'parts', 'Spare parts / consumables provision', 'Recommended spare parts and consumables within the service scope.'),
      ],
    }],
    serviceContent: buildServiceOfferContent(candidate.opportunityType),
  };
}
