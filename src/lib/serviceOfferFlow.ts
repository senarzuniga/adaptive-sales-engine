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
  documentLanguage?: 'en' | 'es';
  linkedOpportunityId?: string;
  installedBase?: string[];
  optionalServices?: string[];
};

type Localized<T> = Record<'en' | 'es', T>;

export type ServiceCatalogModule = {
  id: string;
  core: boolean;
  // Annual EUR price validated in OFF-2026-S137; 0 = quoted on request.
  referencePrice: number;
  name: Localized<string>;
  frequency: Localized<string>;
  coverage: Localized<string>;
  description: Localized<string>;
  activities: Localized<string[]>;
  aliases?: string[];
};

export const SERVICE_COST_CATEGORY = 'service';
export const SERVICE_REFERENCE_MARGIN = 0.35;

export const SERVICE_OFFER_CATALOG: ServiceCatalogModule[] = [
  {
    id: 'preventive',
    core: true,
    referencePrice: 33984,
    name: { en: 'Annual Preventive Maintenance Programme', es: 'Programa Anual de Mantenimiento Preventivo' },
    frequency: { en: '4 on-site visits + monthly remote follow-up', es: '4 visitas presenciales + seguimiento mensual remoto' },
    coverage: { en: 'All {customer} equipment', es: 'Todos los equipos de {customer}' },
    description: {
      en: 'Maintenance programme per installed base, based on the INGECART TPM templates for Ingetrans lines: weekly condition inspection, monthly backlog review, planned quarterly stops and annual reliability audit.',
      es: 'Programa de mantenimiento por parque instalado, basado en las plantillas TPM de INGECART para líneas Ingetrans: inspección semanal de condición, revisión mensual de backlog, paradas trimestrales planificadas y auditoría anual de confiabilidad.',
    },
    activities: {
      en: [
        '4 on-site preventive visits planned in the annual calendar and aligned with production stops.',
        'Daily operator checks: pneumatic pressures (6-8 bar), hydraulic oil level, visual inspection of rollers and belts, work-area cleaning.',
        'Weekly maintenance checks: lubrication of critical points, belt tension, roller alignment, compressed-air filter cleaning.',
        'Monthly technician checks: calibration of measuring systems, blade and counter-blade condition, safety systems, main motor vibration analysis.',
        'Quarterly checks: hydraulic oil change, complete electrical revision, critical-part wear verification, control software update.',
        'Monthly remote follow-up of the maintenance backlog and annual reliability audit.',
        'Visit report with condition status, wear trend and prioritised corrective actions.',
      ],
      es: [
        '4 visitas preventivas presenciales planificadas en el calendario anual y alineadas con las paradas de producción.',
        'Verificación diaria (operario): presiones neumáticas (6-8 bar), nivel de aceite hidráulico, inspección visual de rodillos y correas, limpieza de la zona de trabajo.',
        'Verificación semanal (mantenimiento): lubricación de puntos críticos, tensión de correas, alineación de rodillos, limpieza de filtros de aire comprimido.',
        'Verificación mensual (técnico): calibración de sistemas de medida, estado de cuchillas y contracuchillas, sistemas de seguridad, análisis de vibraciones del motor principal.',
        'Verificación trimestral: cambio de aceite hidráulico, revisión eléctrica completa, desgaste de piezas críticas, actualización del software de control.',
        'Seguimiento mensual remoto del backlog de mantenimiento y auditoría anual de confiabilidad.',
        'Informe de visita con estado de condición, tendencia de desgaste y acciones correctivas priorizadas.',
      ],
    },
    aliases: ['preventivo', 'preventive', 'field service visits', 'field_service', 'engineering / project management'],
  },
  {
    id: 'ingepro',
    core: true,
    referencePrice: 18000,
    name: { en: 'INGEPRO Monitoring + Predictive AI', es: 'INGEPRO Monitoring + Predictibilidad AI' },
    frequency: { en: '24/7 continuous', es: '24/7 continuo' },
    coverage: { en: 'Alerting, predictive analytics, recommendations and OEE/LPI follow-up', es: 'Alerting, analítica predictiva, recomendaciones y seguimiento de OEE/LPI' },
    description: {
      en: 'INGEPRO enables 24/7 monitoring, criticality-based alerts and predictive recommendations for Operators, Maintenance and Management, with actionable playbooks per role.',
      es: 'INGEPRO habilita monitorización 24/7, alertas por criticidad y recomendaciones predictivas para Operarios, Mantenimiento y Management con playbooks accionables por rol.',
    },
    activities: {
      en: [
        '24/7 monitoring of status, alarms and KPIs of the critical assets defined in the Smart Plant Dashboard.',
        'Alerts classified by criticality with agreed escalation protocol.',
        'Predictive analytics and early failure detection.',
        'Actionable playbooks per role: Operators, Maintenance and Management.',
        'Follow-up of OEE/LPI, availability, risk and PM compliance.',
        'Remote technical support included.',
      ],
      es: [
        'Monitorización 24/7 de estado, alarmas y KPIs de los activos críticos definidos en Smart Plant Dashboard.',
        'Alertas clasificadas por criticidad con protocolo de escalado acordado.',
        'Analítica predictiva y detección anticipada de fallos.',
        'Playbooks accionables por rol: Operarios, Mantenimiento y Management.',
        'Seguimiento de OEE/LPI, disponibilidad, riesgo y cumplimiento PM.',
        'Soporte técnico remoto incluido.',
      ],
    },
    aliases: ['ingepro', 'monitoring', 'monitorizacion', 'monitorización', 'remote support', 'remote_service'],
  },
  {
    id: 'training',
    core: true,
    referencePrice: 11150,
    name: { en: 'Operational + Maintenance + Management Training', es: 'Training Operativo + Mantenimiento + Management' },
    frequency: { en: '12 sessions/year (onsite and remote)', es: '12 sesiones/año (onsite y remoto)' },
    coverage: { en: 'Operators, maintenance technicians and plant managers', es: 'Operarios, técnicos de mantenimiento y responsables de planta' },
    description: {
      en: 'Continuous training programme including AI applied to the plant, early failure detection and data governance for intervention and improvement decisions.',
      es: 'Programa de formación continua que incluye entrenamiento en AI aplicada a planta, detección anticipada de fallos y gobierno de datos para decisiones de intervención y mejora.',
    },
    activities: {
      en: [
        'Operator training: normal cycle, alarms, recovery and daily TPM checks.',
        'Maintenance training: TPM routines, diagnosis and component replacement.',
        'Management sessions: KPIs, OEE, risk and improvement prioritisation.',
        'AI applied to the plant, early failure detection and data governance.',
      ],
      es: [
        'Formación de operarios: ciclo normal, alarmas, recuperación y verificaciones TPM diarias.',
        'Formación de mantenimiento: rutinas TPM, diagnóstico y sustitución de componentes.',
        'Sesiones de management: KPIs, OEE, riesgo y priorización de mejoras.',
        'AI aplicada a planta, detección anticipada de fallos y gobierno de datos.',
      ],
    },
    aliases: ['training', 'formacion', 'formación'],
  },
  {
    id: 'parts-channel',
    core: true,
    referencePrice: 4818,
    name: { en: 'INGEPRO Wholesale Industrial Purchasing Channel', es: 'Canal INGEPRO de Compras Industriales al por Mayor' },
    frequency: { en: 'Continuous supply service', es: 'Servicio continuo de aprovisionamiento' },
    coverage: { en: 'Multi-OEM spare parts with Tetrace-type cost/lead-time benchmark', es: 'Recambios multi-OEM con benchmark de coste/plazo tipo Tetrace' },
    description: {
      en: 'The INGEPRO channel includes direct requests for spare parts for any equipment, with volume negotiation and supply traceability to improve lead time and price. Equivalent functional service reference: https://www.tetrace.com/en/spare-parts.',
      es: 'El canal INGEPRO incorpora solicitud directa de recambios y piezas de cualquier equipo, con negociación de volumen y trazabilidad de suministro para mejorar plazo y precio. Referencia funcional de servicio equivalente: https://www.tetrace.com/en/spare-parts.',
    },
    activities: {
      en: [
        'Direct multi-OEM spare parts requests through INGEPRO.',
        'Volume negotiation and cost/lead-time benchmark.',
        'End-to-end supply traceability.',
        'Access to the INGECART permanent stock of critical parts and original Ingetrans spare parts.',
      ],
      es: [
        'Solicitud directa de recambios multi-OEM a través de INGEPRO.',
        'Negociación de volumen y benchmark de coste/plazo.',
        'Trazabilidad completa del suministro.',
        'Acceso al stock permanente de recambios críticos de INGECART y a recambios originales Ingetrans.',
      ],
    },
    aliases: ['parts', 'recambios', 'spare parts', 'compras', 'purchasing'],
  },
  {
    id: 'emergency',
    core: false,
    referencePrice: 0,
    name: { en: 'Urgent on-site technical assistance', es: 'Asistencia técnica urgente in situ' },
    frequency: { en: 'On demand, 24-48 h in peninsula', es: 'Bajo demanda, 24-48 h en península' },
    coverage: { en: 'Critical breakdowns on covered equipment', es: 'Averías críticas en los equipos cubiertos' },
    description: {
      en: 'Dispatch of the multidisciplinary INGECART team (mechanical, electrical, automation) to recover production after critical breakdowns.',
      es: 'Desplazamiento del equipo técnico multidisciplinar de INGECART (mecánica, electricidad, automatización) para recuperar la producción ante averías críticas.',
    },
    activities: { en: ['Remote pre-diagnosis before dispatch.', 'On-site repair and restart.', 'Intervention report with root cause and preventive recommendation.'], es: ['Prediagnóstico remoto previo al desplazamiento.', 'Reparación y rearranque en planta.', 'Informe de intervención con causa raíz y recomendación preventiva.'] },
  },
  {
    id: 'workshop',
    core: false,
    referencePrice: 0,
    name: { en: 'Repair and reconditioning in own workshop', es: 'Reparación y reacondicionamiento en taller propio' },
    frequency: { en: 'On demand', es: 'Bajo demanda' },
    coverage: { en: 'Rollers, knives, correcting groups, gearboxes and mechanical assemblies', es: 'Rodillos, cuchillas, grupos correctores, reductoras y conjuntos mecánicos' },
    description: {
      en: 'Own 1,200 m² workshop with specialized machinery, complete plans and original technical documentation of Ingetrans equipment.',
      es: 'Taller propio de 1.200 m² con maquinaria especializada, planos completos y documentación técnica original de los equipos Ingetrans.',
    },
    activities: { en: ['Inspection and repair quotation.', 'Reconditioning to original specifications.', 'Functional test before return.'], es: ['Inspección y presupuesto de reparación.', 'Reacondicionamiento según especificación original.', 'Prueba funcional antes de la devolución.'] },
  },
  {
    id: 'critical-spares-kit',
    core: false,
    referencePrice: 0,
    name: { en: 'Critical spare parts kit on site', es: 'Kit de recambios críticos en planta' },
    frequency: { en: 'Annual review', es: 'Revisión anual' },
    coverage: { en: 'Critical parts per machine and risk level', es: 'Recambios críticos por máquina y nivel de riesgo' },
    description: {
      en: 'Recommended on-site stock of critical parts to minimise downtime, defined from the installed base and failure history.',
      es: 'Stock recomendado de recambios críticos en planta para minimizar paradas, definido a partir del parque instalado y el histórico de averías.',
    },
    activities: { en: ['Critical parts list by machine and risk.', 'Recommended quantities and reorder points.', 'Annual list update.'], es: ['Lista de recambios críticos por máquina y riesgo.', 'Cantidades recomendadas y puntos de pedido.', 'Actualización anual de la lista.'] },
  },
  {
    id: 'software',
    core: false,
    referencePrice: 0,
    name: { en: 'Control software update and backups', es: 'Actualización de software de control y copias de seguridad' },
    frequency: { en: 'Quarterly / per release', es: 'Trimestral / según release' },
    coverage: { en: 'PLCs, HMI, frequency drives and control systems', es: 'PLCs, HMI, variadores de frecuencia y sistemas de control' },
    description: {
      en: 'Controlled update of control software with previous backup, change log and functional validation.',
      es: 'Actualización controlada del software de control con copia de seguridad previa, registro de cambios y validación funcional.',
    },
    activities: { en: ['Backup of PLC/HMI programs.', 'Update and change log.', 'Functional validation with the customer.'], es: ['Copia de seguridad de programas PLC/HMI.', 'Actualización y registro de cambios.', 'Validación funcional con el cliente.'] },
  },
  {
    id: 'retrofit',
    core: false,
    referencePrice: 0,
    name: { en: 'Retrofit and modernization study', es: 'Estudio de retrofit y modernización' },
    frequency: { en: 'On request', es: 'Bajo pedido' },
    coverage: { en: 'End-of-life equipment or equipment with performance gaps', es: 'Equipos al final de su ciclo de vida o con gaps de rendimiento' },
    description: {
      en: 'Technical and economic study to extend equipment life, close performance gaps and integrate new control or safety functionality.',
      es: 'Estudio técnico-económico para extender la vida del equipo, cerrar gaps de rendimiento e integrar nueva funcionalidad de control o seguridad.',
    },
    activities: { en: ['Current-state audit.', 'Modernization roadmap with priorities.', 'Budget and execution plan.'], es: ['Auditoría del estado actual.', 'Hoja de ruta de modernización priorizada.', 'Presupuesto y plan de ejecución.'] },
  },
];

const normalizeKey = (value: string) => text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function findServiceCatalogModule(lineItem: unknown, category?: unknown): ServiceCatalogModule | undefined {
  const key = normalizeKey(String(lineItem || ''));
  const cat = normalizeKey(String(category || ''));
  const exact = SERVICE_OFFER_CATALOG.find((module) => [module.id, module.name.en, module.name.es].some((value) => normalizeKey(value) === key));
  if (exact) return exact;
  return SERVICE_OFFER_CATALOG.find((module) => (module.aliases || []).some((alias) => {
    const normalized = normalizeKey(alias);
    return (key && key.includes(normalized)) || cat === normalized;
  }));
}

export const DEFAULT_OPTIONAL_SERVICE_IDS = SERVICE_OFFER_CATALOG.filter((module) => !module.core).map((module) => module.id);

const serviceOfferContentByType: Record<ServiceOpportunityType, ServiceOfferContent> = {
  maintenance: {
    sections: ['scope', 'tpm-preventive', 'service-deliverables', 'why-ingecart', 'covered-machines', 'commercial', 'response-sla'],
    scopeSummary: 'This annual proposal consolidates preventive maintenance, INGEPRO monitoring and the adoption of predictive AI to secure availability and operational continuity of the critical assets defined in the Smart Plant Dashboard.',
    serviceDescription: 'The programme combines scheduled Total Productive Maintenance (TPM) routines based on the INGECART templates for Ingetrans lines, 24/7 INGEPRO monitoring with predictive AI, continuous training by role and an industrial spare-parts purchasing channel.',
    valueProposition: 'Move from reactive repair to predictable asset performance: longer component life, stable output, fewer emergency interventions and a clear annual service budget.',
    deliverables: [
      'Operational dashboard per role with availability, OEE, risk and PM compliance KPIs.',
      'Monthly technical report + quarterly executive review.',
      'Prioritised list of improvements, spare parts and downtime-reduction actions.',
      'Annual maintenance calendar aligned to production stops.',
      'Operator, maintenance and technician-level TPM checklists.',
      'Visit report with condition status and corrective recommendations after each visit.',
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

const serviceOfferContentEsByType: Partial<Record<ServiceOpportunityType, ServiceOfferContent>> = {
  maintenance: {
    sections: serviceOfferContentByType.maintenance.sections,
    scopeSummary: 'Esta propuesta anual consolida mantenimiento preventivo, monitorización INGEPRO y adopción de AI predictiva para asegurar disponibilidad y continuidad operativa de los activos críticos definidos en Smart Plant Dashboard.',
    serviceDescription: 'El programa combina rutinas programadas de Mantenimiento Productivo Total (TPM) basadas en las plantillas INGECART para líneas Ingetrans, monitorización INGEPRO 24/7 con AI predictiva, formación continua por rol y un canal industrial de compras de recambios.',
    valueProposition: 'Pasar de la reparación reactiva a un rendimiento predecible de los activos: mayor vida de componentes, producción estable, menos intervenciones de urgencia y un presupuesto anual de servicio claro.',
    deliverables: [
      'Panel operativo por rol con KPIs de disponibilidad, OEE, riesgo y cumplimiento PM.',
      'Informe técnico mensual + revisión ejecutiva trimestral.',
      'Lista priorizada de mejoras, repuestos y acciones de reducción de parada.',
      'Calendario anual de mantenimiento alineado con las paradas de producción.',
      'Checklists TPM por nivel: operario, mantenimiento y técnico.',
      'Informe de visita con estado de condición y recomendaciones correctivas tras cada visita.',
    ],
    exclusions: [
      'Reparaciones mayores o reconstrucciones fuera del alcance TPM acordado.',
      'Consumibles, cuchillas, correas y piezas de desgaste no incluidos en el acuerdo.',
      'Obra civil, cimentaciones, utilidades del cliente e interfaces de terceros.',
      'Pérdidas de producción por retrasos del cliente o falta de acceso a los equipos.',
    ],
    assumptions: [
      'El cliente facilita acceso seguro y preparado en las ventanas programadas.',
      'Los equipos son accesibles con medios de elevación estándar.',
      'La documentación técnica y las copias de seguridad de software están disponibles.',
      'El cliente notifica las alarmas críticas dentro de la ventana de escalado acordada.',
    ],
    tpmProgramme: {
      title: 'Plantilla TPM específica INGETRANS',
      daily: [
        'Verificar presiones neumáticas (6-8 bar).',
        'Comprobar nivel de aceite hidráulico.',
        'Inspección visual de rodillos y correas.',
        'Limpieza general de la zona de trabajo.',
      ],
      weekly: [
        'Lubricación de puntos críticos (rodamientos, guías).',
        'Comprobación de tensión de correas.',
        'Verificación de alineación de rodillos.',
        'Limpieza de filtros de aire comprimido.',
      ],
      monthly: [
        'Calibración de sistemas de medida.',
        'Revisión del estado de cuchillas y contracuchillas.',
        'Verificación de sistemas de seguridad.',
        'Análisis de vibraciones del motor principal.',
      ],
      quarterly: [
        'Cambio de aceite hidráulico.',
        'Revisión completa del sistema eléctrico.',
        'Verificación de desgaste de piezas críticas.',
        'Actualización del software de control.',
      ],
    },
    whyIngecart: [
      'Más de 30 años de experiencia en el sector del cartón ondulado.',
      'Taller propio de 1.200 m² con maquinaria especializada.',
      'Stock permanente de recambios críticos.',
      'Equipo técnico multidisciplinar (mecánica, electricidad, automatización).',
      'Tiempo de respuesta de 24-48 h en península.',
      'Conocimiento profundo de los equipos Ingetrans (fabricación y montaje propios).',
      'Planos completos, documentación técnica y recambios originales disponibles.',
      'Formación continua a operarios del cliente y soporte remoto incluido.',
    ],
    coveredMachines: [
      'Línea de ondulado: single facer, double facer, precalentadores, puente de encolado, grupo humectador.',
      'Línea de transformación: cortadora-hendedora (rotary shear), rotativa contrarrotativa, impresora flexográfica, troqueladora rotativa, troqueladora plana.',
      'Manipulación y acabado: apilador automático, contador de planchas, paletizado automático, flejadora automática, cintas transportadoras.',
      'Equipos auxiliares: grupos correctores, sistemas de alimentación de papel, compresores de aire, centrales hidráulicas, hornos de secado / curado de cola.',
      'Sistemas de control: PLCs y automatismos, sensores y encoders, variadores de frecuencia, paneles de operador / HMI.',
    ],
    responseSla: [
      { label: 'Respuesta remota', value: 'En 4 horas laborables' },
      { label: 'Desplazamiento urgente a planta', value: '24-48 h en península' },
      { label: 'Visita preventiva programada', value: 'Según calendario anual acordado' },
      { label: 'Entrega de informe de servicio', value: 'En 5 días laborables' },
    ],
  },
};

export function buildServiceOfferContent(opportunityType: ServiceOpportunityType): ServiceOfferContent {
  return serviceOfferContentByType[opportunityType] || serviceOfferContentByType.maintenance;
}

export function inferServiceOpportunityType(value: string): ServiceOpportunityType {
  const source = text(value).toLowerCase();
  if (/(spare|recambio|repuesto|parts)/.test(source)) return 'spares';
  if (/(retrofit|moderniz)/.test(source)) return 'retrofit';
  if (/(reliability|fiabilidad|recovery|root.?cause)/.test(source)) return 'reliability';
  if (/(expansion|amendment|ampliacion)/.test(source)) return 'contract-expansion';
  if (/(maintenance|mantenimiento|tpm|preventiv)/.test(source)) return 'maintenance';
  if (/(ingepro|digital|dashboard|connectivity|monitori)/.test(source)) return 'digital';
  return 'maintenance';
}

// Only unedited base content is swapped, so user edits are never overwritten.
export function localizeServiceOfferContent(content: ServiceOfferContent, language: 'en' | 'es'): ServiceOfferContent {
  if (language !== 'es') return content;
  const type = (Object.keys(serviceOfferContentByType) as ServiceOpportunityType[])
    .find((key) => serviceOfferContentByType[key].scopeSummary === content.scopeSummary);
  const localized = type ? serviceOfferContentEsByType[type] : undefined;
  return localized ? { ...localized, documentLanguage: 'es', linkedOpportunityId: content.linkedOpportunityId, installedBase: content.installedBase, optionalServices: content.optionalServices } : content;
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
    status: 'identified',
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

export function buildServiceOfferDraftSeed(candidate: ServiceOpportunityCandidate, assets: Row[] = []): ServiceOfferDraftSeed {
  const baseContent = buildServiceOfferContent(candidate.opportunityType);
  const opportunityId = candidate.id;
  const language: 'en' | 'es' = 'en';
  const customerKey = normalizeKey(candidate.customerName);
  const installedBase = assets
    .filter((asset) => customerKey && normalizeKey(String(asset.customer_name || '')) === customerKey)
    .map((asset) => [text(asset.asset_name), text(asset.serial_number)].filter(Boolean))
    .filter((parts) => parts.length > 0)
    .map(([name, serial]) => (serial ? `${name} (${serial})` : name));
  const serviceContent: ServiceOfferContent = {
    ...baseContent,
    documentLanguage: language,
    linkedOpportunityId: opportunityId,
    installedBase,
    optionalServices: [...DEFAULT_OPTIONAL_SERVICE_IDS],
  };
  const stamp = Date.now();
  const coreModules = SERVICE_OFFER_CATALOG.filter((module) => module.core);
  return {
    offerKind: 'service',
    title: candidate.title,
    customerName: candidate.customerName,
    projectDescription: candidate.recommendedScope,
    currency: 'EUR',
    targetMargin: targetMarginByType[candidate.opportunityType] || 32,
    documentLanguage: language,
    linkedOpportunityId: opportunityId,
    linkedOpportunityTitle: candidate.title,
    items: [{
      id: `svc-${slug(candidate.title)}-${stamp}`,
      name: candidate.title,
      type: 'service',
      quantity: 1,
      description: candidate.recommendedScope,
      costLines: coreModules.map((module) => {
        const unitCost = Math.round(module.referencePrice * (1 - SERVICE_REFERENCE_MARGIN));
        return {
          ...buildServiceCostLine(`cl-${stamp}-${module.id}`, SERVICE_COST_CATEGORY, module.name.en, `${module.frequency.en}. Reference OFF-2026-S137.`),
          unitCost,
          totalCost: unitCost,
        };
      }),
    }],
    serviceContent,
  };
}
