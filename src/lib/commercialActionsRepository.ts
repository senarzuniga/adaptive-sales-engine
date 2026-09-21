import type { MonitoringTask, TaskCategory, TaskPillar, TaskPriority } from '@/store/DataStore';

export interface ActionTrigger {
  event: string;
  logic: string;
  depends_on?: string[];
}

export interface ActionKpi {
  name: string;
  target: number;
  unit?: string;
}

export interface CommercialAction {
  id: string;
  name: string;
  description: string;
  role: string;
  importance_score: number;
  strategy_alignment: number;
  estimated_hours: number;
  inputs: string[];
  outputs: string[];
  triggers: ActionTrigger[];
  kpis: ActionKpi[];
  ai_tags: string[];
  goal?: string;
  supportive_content?: {
    call_script?: string;
    email_template?: string;
    presentation_notes?: string;
  };
}

export interface LifecycleStage {
  stage: string;
  processes: string[];
  actions: CommercialAction[];
}

export interface ActionsRepository {
  version: string;
  created_by: string;
  modified_by: string;
  timestamp: string;
  source_model?: string;
  lifecycle_stages: LifecycleStage[];
}

export interface RepositoryValidationResult {
  valid: boolean;
  issues: string[];
}

export interface TriggerContext {
  event: string;
  health_score?: number;
  health_threshold?: number;
  usage_growth?: number;
  churn_risk?: number;
  nps_score?: number;
  [key: string]: unknown;
}

export const STORAGE_KEY = 'acs_commercial_actions_repository';


type PlanPostventaRow = {
  machine: string;
  customer: string;
  number: string;
  action: string;
  billable: string;
  priority: string;
  status: string;
  owner: string;
  start: string;
  end: string;
  days: string;
  comments: string;
};

const PLAN_POSTVENTA_IMPORT_ROWS: PlanPostventaRow[] = [
  { machine: "Sistema carga camiones", customer: "Font", number: "1", action: "Poner deslidur en la l\u00ednea de carga cami\u00f3n para evitar problemas con los palets", billable: "S\u00ed", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Sistema carga camiones", customer: "Font", number: "2", action: "Realizar listado m\u00ednimo de recambios", billable: "No", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Sistema carga camiones", customer: "Font", number: "3", action: "Pintar el centrador de palets de la tijera hidr\u00e1ulica", billable: "S\u00ed", priority: "Media", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Sistema carga camiones", customer: "Font", number: "4", action: "Realizar presupuesto de poner puerta autom\u00e1tica al cami\u00f3n", billable: "S\u00ed", priority: "Baja", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Sistema carga camiones", customer: "Font", number: "5", action: "Realizar presupuesto de conexi\u00f3n el\u00e9ctrica r\u00e1pida del cami\u00f3n", billable: "S\u00ed", priority: "Media", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Paletizador Macarbox", customer: "Font", number: "1", action: "Finalizar normativa CE", billable: "No", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Paletizador Macarbox", customer: "Font", number: "2", action: "Modificar software a doble nivel piso", billable: "No", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Paletizador Macarbox", customer: "Font", number: "3", action: "Revisar velocidad de la mesa de reenv\u00edo a 90\u00ba, doble motor", billable: "No", priority: "Media", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Paletizador Macarbox", customer: "Font", number: "4", action: "Revisar el m\u00ednimo de pinza cerrada: debe dar 400 mm en mec\u00e1nica y digital", billable: "No", priority: "Media", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Paletizador Macarbox", customer: "Font", number: "5", action: "Aumento de velocidad", billable: "No", priority: "Media", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Paletizador Macarbox", customer: "Font", number: "6", action: "Manuales de recambio e informaci\u00f3n final completa: esquemas, manual de operaci\u00f3n, etc.", billable: "No", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Paletizador Macarbox", customer: "Font", number: "7", action: "Listado de recambios imprescindibles", billable: "No", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Paletizador Macarbox", customer: "Font", number: "8", action: "Estudio contrato de mantenimiento anual", billable: "S\u00ed", priority: "Media", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 280", customer: "Mastercorr", number: "1", action: "Finalizar CE y manuales", billable: "No", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 280", customer: "Mastercorr", number: "2", action: "Listado de recambios imprescindibles", billable: "No", priority: "Media", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 280", customer: "Mastercorr", number: "3", action: "Seguimiento de si los m\u00e1stiles se aflojan de nuevo", billable: "No", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 280", customer: "Mastercorr", number: "4", action: "Cambio de pantalla Siemens", billable: "S\u00ed", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 280", customer: "Mastercorr", number: "5", action: "Env\u00edo de etiquetas adhesivas el\u00e9ctricas para cuadro de Home", billable: "S\u00ed", priority: "Baja", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 280", customer: "Mastercorr", number: "6", action: "Decisi\u00f3n final de metacrilato transfer roto", billable: "No", priority: "Media", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 250", customer: "PCM", number: "1", action: "Env\u00edo oferta de recambios solicitada", billable: "S\u00ed", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 250", customer: "PCM", number: "2", action: "Env\u00edo de informaci\u00f3n de recambios del sistema conveyors", billable: "S\u00ed", priority: "Media", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 250", customer: "PCM", number: "3", action: "Preparar con Mast Ebre la disposici\u00f3n para conectarse remotamente y realizar diagn\u00f3stico", billable: "No", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 250", customer: "Trupal", number: "1.0", action: "Negociar con Mast Ebre la soluci\u00f3n y su colaboraci\u00f3n", billable: "No", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 250", customer: "Trupal", number: "2.0", action: "Responder al cliente con la soluci\u00f3n", billable: "No", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "Ingetrans 250", customer: "Trupal", number: "3.0", action: "Ejecuci\u00f3n de la soluci\u00f3n", billable: "No", priority: "Alta", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "SR 1400", customer: "Line Text (Kelly Box)", number: "1", action: "Preparar ofertas de recambios o plan de mantenimiento", billable: "S\u00ed", priority: "Media", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
  { machine: "SR 1400", customer: "Line Text (Kelly Box)", number: "2.0", action: "Preparar ofertas de recambios o plan de mantenimiento", billable: "S\u00ed", priority: "Media", status: "Pendiente", owner: "", start: "", end: "", days: "", comments: "" },
];

export const PLAN_POSTVENTA_ACTION_COUNT = PLAN_POSTVENTA_IMPORT_ROWS.length;

const PLAN_POSTVENTA_PRIORITY_SCORE: Record<string, number> = {
  alta: 88,
  media: 74,
  baja: 60,
};

const PLAN_POSTVENTA_PRIORITY_ALIGNMENT: Record<string, number> = {
  alta: 92,
  media: 80,
  baja: 68,
};

function normalizePlanKey(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function estimatePlanPostventaHours(row: PlanPostventaRow): number {
  const action = row.action.toLowerCase();
  if (/(ejecucion|execution|diagnostico|diagnosis|finalizar|modify|modificar|revisar|study|estudio)/.test(action)) {
    return row.priority.toLowerCase() === 'alta' ? 4 : 3;
  }
  if (/(presupuesto|oferta|offer|envio|send|manual|listado|recambios|mantenimiento)/.test(action)) {
    return row.priority.toLowerCase() === 'alta' ? 2.5 : 2;
  }
  return row.priority.toLowerCase() === 'alta' ? 3 : row.priority.toLowerCase() === 'media' ? 2 : 1.5;
}

function buildPlanPostventaAction(row: PlanPostventaRow): CommercialAction & { stage: string } {
  const priorityKey = row.priority.toLowerCase();
  const billable = row.billable.toLowerCase().startsWith('s');
  const pending = row.status.toLowerCase().includes('pend');
  const importanceBase = PLAN_POSTVENTA_PRIORITY_SCORE[priorityKey] ?? 65;
  const alignmentBase = PLAN_POSTVENTA_PRIORITY_ALIGNMENT[priorityKey] ?? 72;
  const importance_score = Math.min(99, importanceBase + (billable ? 6 : 0) + (pending ? 3 : -4));
  const strategy_alignment = Math.min(99, alignmentBase + (billable ? 4 : 2) + (/recambios|mantenimiento|ce|manuales/i.test(row.action) ? 3 : 0));
  const id = `PLAN_POSTVENTA_${normalizePlanKey(row.customer)}_${normalizePlanKey(row.machine)}_${normalizePlanKey(row.number)}`;
  const machineCustomer = `${row.customer} / ${row.machine}`;
  const scopeNote = row.comments || `Plan Postventa imported from Excel for ${machineCustomer}.`;
  const revenueFocus = billable ? 'Open a billable post-sales commercial motion.' : 'Protect installed-base performance and customer satisfaction.';
  return {
    stage: 'CUSTOMER_SUCCESS',
    id,
    name: `Plan Postventa - ${row.customer} - ${row.machine} #${row.number}`,
    description: `${row.action} Context: ${machineCustomer}. Facturable: ${row.billable}. Prioridad: ${row.priority}. Estado: ${row.status}.`,
    role: 'Customer Success Agent',
    importance_score,
    strategy_alignment,
    estimated_hours: estimatePlanPostventaHours(row),
    inputs: ['crm_data', 'historical_data'],
    outputs: [`${id}_COMPLETED`],
    triggers: [{ event: 'plan_postventa_review', logic: 'always' }],
    kpis: [
      billable
        ? { name: 'Post-sales revenue activation', target: 1, unit: 'action' }
        : { name: 'Installed base issue containment', target: 1, unit: 'action' },
    ],
    ai_tags: [
      'customer_success',
      'postventa',
      'installed_base',
      billable ? 'service_sales' : 'service_reliability',
      priorityKey || 'media',
    ],
    goal: `${revenueFocus} Resolve: ${row.action}`,
    supportive_content: {
      call_script: `Review the open post-sales point with ${row.customer} for ${row.machine}, confirm impact, agree owner, and lock the next execution step for '${row.action}'.`,
      email_template: `Subject: Post-sales plan update - ${row.customer} / ${row.machine}

We are progressing the following action from the service plan: ${row.action}. Proposed next step: confirm scope, owner and target date so the action can be closed with full traceability.`,
      presentation_notes: `Installed base review for ${machineCustomer}. Priority: ${row.priority}. Billable: ${row.billable}. Source: Plan Postventa sheet in 0. Listado Proyectos.xlsm. Notes: ${scopeNote}`,
    },
  };
}

export function buildPlanPostventaImportedActions(): Array<CommercialAction & { stage: string }> {
  return PLAN_POSTVENTA_IMPORT_ROWS.map(buildPlanPostventaAction);
}

export function ensureSeededPlanPostventaActions(repository: ActionsRepository): ActionsRepository {
  const existingIds = new Set(flattenActions(repository).map((action) => action.id));
  const missing = buildPlanPostventaImportedActions().filter((action) => !existingIds.has(action.id));
  return missing.length > 0 ? mergeRepository(repository, missing, 'system-plan-postventa-import') : repository;
}

export const DEFAULT_REPOSITORY: ActionsRepository = {
  version: 'v1.1',
  created_by: 'system',
  modified_by: 'system',
  timestamp: '2026-04-17T00:00:00Z',
  source_model: 'Customer_Revenue_Engine_v1',
  lifecycle_stages: [
    {
      stage: 'LEAD_ACQUISITION',
      processes: ['Prospecting', 'Lead qualification', 'Outbound', 'Inbound'],
      actions: [
        {
          id: 'IDENTIFICAR_NUEVO_LEAD',
          name: 'Identify high-fit lead',
          description: 'Detect new lead candidates from ICP and intent signals.',
          role: 'Sales Agent',
          importance_score: 75,
          strategy_alignment: 82,
          estimated_hours: 2,
          inputs: ['market_signals', 'crm_lead_history', 'segment_priority'],
          outputs: ['qualified_lead', 'lead_score'],
          triggers: [{ event: 'new_signal', logic: 'intent_score >= 70' }],
          kpis: [{ name: 'Lead-to-opportunity conversion', target: 20, unit: '%' }],
          ai_tags: ['lead_scoring', 'prospecting', 'event-driven'],
          goal: 'Create qualified opportunities in strategic segments.',
          supportive_content: {
            call_script: 'Opening + qualification script focused on business pain and urgency.',
            email_template: "Subject: Strategic fit conversation {{company}}",
            presentation_notes: 'ICP criteria, intent evidence, next-step CTA.',
          },
        },
        {
          id: 'CALIFICAR_LEAD_IA',
          name: 'AI lead qualification',
          description: 'Enrich lead and score win probability using CRM + external signals.',
          role: 'RevOps Agent',
          importance_score: 78,
          strategy_alignment: 80,
          estimated_hours: 1.5,
          inputs: ['lead_profile', 'historical_conversion', 'firmographics'],
          outputs: ['lead_tier', 'next_step_recommendation'],
          triggers: [{ event: 'lead_created', logic: 'lead_profile != null' }],
          kpis: [{ name: 'Qualification accuracy', target: 85, unit: '%' }],
          ai_tags: ['ml_predictions', 'stateful', 'context-aware'],
        },
      ],
    },
    {
      stage: 'PIPELINE_EXECUTION',
      processes: ['Opportunity management', 'Negotiation', 'Proposal'],
      actions: [
        {
          id: 'SEGUIMIENTO_OFERTA_CRITICA',
          name: 'Critical offer follow-up',
          description: 'Prioritized follow-up for high-value and high-probability offers.',
          role: 'Sales Agent',
          importance_score: 96,
          strategy_alignment: 91,
          estimated_hours: 2.5,
          inputs: ['open_offer', 'contract_probability', 'deal_value'],
          outputs: ['meeting_scheduled', 'objection_map'],
          triggers: [{ event: 'offer_pending', logic: 'contract_probability >= 70 AND deal_value > 50000' }],
          kpis: [{ name: 'Offer acceptance', target: 35, unit: '%' }],
          ai_tags: ['deal_closure', 'proactive', 'iterative'],
        },
        {
          id: 'PLAN_MEJORA',
          name: 'Health score improvement plan',
          description: 'Launch recovery plan for low account health with root-cause actions.',
          role: 'Customer Success Agent',
          importance_score: 92,
          strategy_alignment: 94,
          estimated_hours: 4,
          inputs: ['health_score', 'nps', 'support_tickets'],
          outputs: ['recovery_plan', 'owner_commitments'],
          triggers: [{ event: 'health_score_updated', logic: 'health_score < 60' }],
          kpis: [{ name: 'Retention rate', target: 95, unit: '%' }],
          ai_tags: ['retention', 'churn_prevention', 'feedback-loop'],
        },
        {
          id: 'IDENTIFICAR_UPSELL',
          name: 'Detect upsell expansion',
          description: 'Identify growth opportunities from usage, adoption, and account plans.',
          role: 'Growth Agent',
          importance_score: 88,
          strategy_alignment: 90,
          estimated_hours: 3,
          inputs: ['usage_data', 'account_plan', 'product_adoption'],
          outputs: ['upsell_hypothesis', 'target_offer'],
          triggers: [{ event: 'usage_updated', logic: 'usage_growth >= 20' }],
          kpis: [{ name: 'Expansion MRR', target: 12, unit: '%' }],
          ai_tags: ['upsell', 'cross-sell', 'growth'],
        },
        {
          id: 'PRIORIZAR_POR_SCORE',
          name: 'Prioritize by goal impact score',
          description: 'Rank all executable actions by importance and strategy alignment score.',
          role: 'Orchestrator Agent',
          importance_score: 89,
          strategy_alignment: 96,
          estimated_hours: 1,
          inputs: ['action_pool', 'goal_weights', 'resource_capacity'],
          outputs: ['ranked_action_list'],
          triggers: [{ event: 'planning_cycle', logic: 'resource_capacity >= 0' }],
          kpis: [{ name: 'Plan-to-goal alignment', target: 90, unit: '%' }],
          ai_tags: ['orchestration', 'next-best-action', 'resource-aware'],
        },
      ],
    },
    {
      stage: 'CUSTOMER_SUCCESS',
      processes: ['Onboarding', 'Adoption', 'Retention', 'Renewals'],
      actions: [
        {
          id: 'FIDELIZACION_NPS_RECOVERY',
          name: 'NPS recovery action',
          description: 'Create and execute plan to recover low NPS accounts.',
          role: 'Customer Success Agent',
          importance_score: 90,
          strategy_alignment: 93,
          estimated_hours: 3.5,
          inputs: ['nps_score', 'feedback_items', 'service_history'],
          outputs: ['nps_recovery_plan', 'follow_up_commitments'],
          triggers: [{ event: 'nps_updated', logic: 'nps_score < 30' }],
          kpis: [{ name: 'NPS improvement', target: 20, unit: 'points' }],
          ai_tags: ['loyalty', 'customer_success', 'iterative'],
        },
        {
          id: 'RENOVACION_CONTRATO',
          name: 'Proactive renewal motion',
          description: 'Drive renewal sequence before contract expiry.',
          role: 'Customer Success Agent',
          importance_score: 94,
          strategy_alignment: 92,
          estimated_hours: 2,
          inputs: ['contract_end_date', 'usage_data', 'value_realization'],
          outputs: ['renewal_offer', 'renewal_forecast'],
          triggers: [{ event: 'contract_expiring', logic: 'days_to_expiry <= 120' }],
          kpis: [{ name: 'Gross renewal rate', target: 92, unit: '%' }],
          ai_tags: ['renewal', 'retention', 'event-driven'],
        },
      ],
    },
    {
      stage: 'ACCOUNT_GROWTH',
      processes: ['Cross-sell', 'Upsell', 'Strategic expansion'],
      actions: [
        {
          id: 'EXPANSION_PLAYBOOK',
          name: 'Expansion playbook',
          description: 'Coordinate multi-thread upsell and cross-sell within strategic accounts.',
          role: 'Growth Agent',
          importance_score: 87,
          strategy_alignment: 90,
          estimated_hours: 4,
          inputs: ['stakeholder_map', 'usage_data', 'product_gaps'],
          outputs: ['expansion_plan', 'exec_sponsor_plan'],
          triggers: [{ event: 'upsell_opportunity_detected', logic: 'opportunity_score >= 70' }],
          kpis: [{ name: 'Expansion revenue', target: 15, unit: '%' }],
          ai_tags: ['growth', 'multi-thread', 'proactive'],
        },
        {
          id: 'CASO_EXITO_REFERENCIABLE',
          name: 'Build referenceable success case',
          description: 'Create customer success case to accelerate trust in expansion deals.',
          role: 'Marketing Agent',
          importance_score: 70,
          strategy_alignment: 78,
          estimated_hours: 2,
          inputs: ['customer_outcomes', 'roi_metrics'],
          outputs: ['case_study', 'sales_enablement_asset'],
          triggers: [{ event: 'milestone_reached', logic: 'roi_metrics != null' }],
          kpis: [{ name: 'Win rate uplift', target: 8, unit: '%' }],
          ai_tags: ['brand', 'enablement', 'social_proof'],
        },
      ],
    },
    {
      stage: 'REVOPS_INTELLIGENCE',
      processes: ['Data quality', 'Forecasting', 'Optimization', 'Feedback loop'],
      actions: [
        {
          id: 'REVOPS_CASCADE_RECALC',
          name: 'Cascade recalculation',
          description: 'Recalculate priorities and forecasts after any event/input update.',
          role: 'RevOps Agent',
          importance_score: 93,
          strategy_alignment: 98,
          estimated_hours: 1,
          inputs: ['event_payload', 'historical_data', 'crm_data', 'external_signals'],
          outputs: ['updated_scores', 'updated_forecast', 'nba_queue'],
          triggers: [{ event: 'any_input_changed', logic: 'true' }],
          kpis: [{ name: 'Forecast error', target: 10, unit: '%' }],
          ai_tags: ['stateful', 'context-aware', 'continuous_optimization'],
        },
        {
          id: 'CHURN_RISK_ALERT',
          name: 'Churn risk alert',
          description: 'Predict and escalate churn risk cases with mitigation recommendation.',
          role: 'RevOps Agent',
          importance_score: 95,
          strategy_alignment: 95,
          estimated_hours: 1.5,
          inputs: ['churn_model_score', 'usage_data', 'nps'],
          outputs: ['risk_alert', 'recommended_success_action'],
          triggers: [{ event: 'health_score_updated', logic: 'churn_model_score >= 0.7' }],
          kpis: [{ name: 'Churn rate', target: 5, unit: '%' }],
          ai_tags: ['ml_predictions', 'risk_detection', 'customer_success'],
        },
      ],
    },
  ],
};

const REQUIRED_FIELDS: ReadonlyArray<keyof CommercialAction> = ['id', 'description', 'role', 'inputs', 'outputs', 'triggers', 'kpis', 'ai_tags'];

export function cloneRepository(repository: ActionsRepository): ActionsRepository {
  return JSON.parse(JSON.stringify(repository));
}

export function flattenActions(repository: ActionsRepository): Array<CommercialAction & { stage: string }> {
  return repository.lifecycle_stages.flatMap((stageNode) =>
    stageNode.actions.map((action) => ({ ...action, stage: stageNode.stage })),
  );
}

export function validateRepository(repository: ActionsRepository): RepositoryValidationResult {
  const issues: string[] = [];
  const ids = new Set<string>();
  const outputs = new Set<string>();

  for (const stageNode of repository.lifecycle_stages || []) {
    if (!stageNode.stage?.trim()) issues.push('Lifecycle stage requires stage name');
    for (const action of stageNode.actions || []) {
      for (const field of REQUIRED_FIELDS) {
        if (action[field] === undefined) {
          issues.push(`Action ${action.id || '<unknown>'} missing ${field}`);
        }
      }

      if (!action.id?.trim()) issues.push('Action id cannot be empty');
      if (ids.has(action.id)) issues.push(`Duplicate action id: ${action.id}`);
      ids.add(action.id);

      if (!action.role?.trim()) issues.push(`Action ${action.id} role cannot be empty`);
      if (!Array.isArray(action.triggers) || action.triggers.length === 0) {
        issues.push(`Action ${action.id} requires at least one trigger`);
      }

      for (const trigger of action.triggers || []) {
        if (!trigger.event?.trim() || !trigger.logic?.trim()) {
          issues.push(`Action ${action.id} has invalid trigger logic`);
        }
      }

      for (const output of action.outputs || []) outputs.add(output);
    }
  }

  for (const action of flattenActions(repository)) {
    for (const input of action.inputs || []) {
      if (['market_signals', 'crm_data', 'historical_data', 'external_signals'].includes(input)) continue;
      if (!outputs.has(input)) {
        issues.push(`Action ${action.id} input '${input}' is not produced by previous actions`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

export function detectCircularTriggers(repository: ActionsRepository): string[] {
  const graph = new Map<string, string[]>();
  for (const action of flattenActions(repository)) {
    graph.set(action.id, (action.triggers || []).flatMap((t) => t.depends_on || []));
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[] = [];

  const dfs = (node: string) => {
    if (visiting.has(node)) {
      cycles.push(node);
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    for (const next of graph.get(node) || []) dfs(next);
    visiting.delete(node);
    visited.add(node);
  };

  for (const node of graph.keys()) dfs(node);
  return [...new Set(cycles)];
}

export function mergeRepository(
  base: ActionsRepository,
  incomingActions: Array<CommercialAction & { stage?: string }>,
  modifiedBy = 'user',
): ActionsRepository {
  const merged = cloneRepository(base);
  const index = new Map<string, { stageIndex: number; actionIndex: number }>();

  merged.lifecycle_stages.forEach((stageNode, stageIndex) => {
    stageNode.actions.forEach((action, actionIndex) => index.set(action.id, { stageIndex, actionIndex }));
  });

  for (const incoming of incomingActions) {
    const existing = index.get(incoming.id);
    if (existing) {
      merged.lifecycle_stages[existing.stageIndex].actions[existing.actionIndex] = {
        ...merged.lifecycle_stages[existing.stageIndex].actions[existing.actionIndex],
        ...incoming,
      };
      continue;
    }

    const stageKey = incoming.stage || 'PIPELINE_EXECUTION';
    const stageNode = merged.lifecycle_stages.find((s) => s.stage === stageKey);
    if (stageNode) {
      stageNode.actions.push({ ...incoming });
    } else {
      merged.lifecycle_stages.push({
        stage: stageKey,
        processes: ['Custom process'],
        actions: [{ ...incoming }],
      });
    }
  }

  const versionNumber = Number(merged.version.replace('v1.', '')) || 0;
  merged.version = `v1.${versionNumber + 1}`;
  merged.modified_by = modifiedBy;
  merged.timestamp = new Date().toISOString();
  return merged;
}

export function upsertAction(repository: ActionsRepository, action: CommercialAction, stage: string, modifiedBy = 'user') {
  return mergeRepository(repository, [{ ...action, stage }], modifiedBy);
}

export function getActionsByStage(repository: ActionsRepository, stage: string): CommercialAction[] {
  return repository.lifecycle_stages.find((s) => s.stage === stage)?.actions || [];
}

function triggerSatisfied(logic: string, context: TriggerContext): boolean {
  const normalized = logic.toLowerCase().trim();
  if (normalized === 'true' || normalized === 'always') return true;

  if (normalized.includes('health_score < 60')) return (context.health_score ?? 100) < 60;
  if (normalized.includes('usage_growth >= 20')) return (context.usage_growth ?? 0) >= 20;
  if (normalized.includes('churn_model_score >= 0.7')) return Number(context.churn_risk ?? 0) >= 0.7;
  if (normalized.includes('nps_score < 30')) return Number(context.nps_score ?? 100) < 30;
  return false;
}

export function triggerActions(repository: ActionsRepository, context: TriggerContext): Array<CommercialAction & { stage: string }> {
  const matched = flattenActions(repository).filter(
    (action) => action.triggers.some((trigger) => trigger.event === context.event && triggerSatisfied(trigger.logic, context)),
  );

  const ids = new Set(matched.map((a) => a.id));
  if ((context.health_score ?? 100) < (context.health_threshold ?? 60)) {
    const planMejora = flattenActions(repository).find((a) => a.id === 'PLAN_MEJORA');
    if (planMejora && !ids.has(planMejora.id)) matched.push(planMejora);
  }

  if ((context.usage_growth ?? 0) >= 20) {
    const upsell = flattenActions(repository).find((a) => a.id === 'IDENTIFICAR_UPSELL');
    if (upsell && !ids.has(upsell.id)) matched.push(upsell);
  }

  return matched;
}

export function evaluateKpis(action: CommercialAction) {
  return action.kpis.map((kpi) => {
    const current = Math.max(0, Math.round(kpi.target * (0.5 + Math.random() * 0.8) * 100) / 100);
    const achievement = kpi.target ? (current / kpi.target) * 100 : 0;
    return {
      ...kpi,
      current,
      achievement: Math.round(achievement * 100) / 100,
      status: achievement >= 100 ? 'on_track' : 'below_target',
    };
  });
}

export function scoreAction(action: CommercialAction, context: Partial<TriggerContext> = {}): number {
  let score = action.importance_score * 0.6 + action.strategy_alignment * 0.4;
  if ((context.health_score ?? 100) < 60 && action.id === 'PLAN_MEJORA') score += 15;
  if ((context.usage_growth ?? 0) >= 20 && action.id === 'IDENTIFICAR_UPSELL') score += 12;
  if ((context.churn_risk ?? 0) >= 0.7 && action.ai_tags.includes('customer_success')) score += 12;
  if ((context.nps_score ?? 100) < 30 && action.id === 'FIDELIZACION_NPS_RECOVERY') score += 10;
  return Math.round(score * 100) / 100;
}

export function getNextBestAction(repository: ActionsRepository, context: Partial<TriggerContext> = {}) {
  const actions = flattenActions(repository);
  const ranked = actions
    .map((action) => ({ ...action, computed_score: scoreAction(action, context) }))
    .sort((a, b) => b.computed_score - a.computed_score);
  return ranked[0] || null;
}

export function filterByWorkingHours(actions: Array<CommercialAction & { stage?: string; computed_score?: number }>, availableHours: number) {
  const normalized = actions
    .map((action) => ({
      ...action,
      computed_score: action.computed_score ?? scoreAction(action),
      score_per_hour: (action.computed_score ?? scoreAction(action)) / Math.max(action.estimated_hours || 1, 0.5),
    }))
    .sort((a, b) => b.score_per_hour - a.score_per_hour);

  const selected: typeof normalized = [];
  let usedHours = 0;

  for (const action of normalized) {
    if (usedHours + (action.estimated_hours || 0) <= availableHours) {
      selected.push(action);
      usedHours += action.estimated_hours || 0;
    }
  }

  return {
    selected,
    usedHours: Math.round(usedHours * 100) / 100,
    remainingHours: Math.max(0, Math.round((availableHours - usedHours) * 100) / 100),
  };
}

const ROLE_TO_CATEGORY: Record<string, TaskCategory> = {
  'Sales Agent': 'follow_up',
  'Customer Success Agent': 'loyalty',
  'Growth Agent': 'cross_sell',
  'RevOps Agent': 'analysis',
  'Orchestrator Agent': 'strategy',
  'Marketing Agent': 'report',
};

const STAGE_TO_PILLAR: Record<string, TaskPillar> = {
  LEAD_ACQUISITION: 'p1',
  PIPELINE_EXECUTION: 'p4',
  CUSTOMER_SUCCESS: 'p3',
  ACCOUNT_GROWTH: 'p2',
  REVOPS_INTELLIGENCE: 'p0',
};

function scoreToPriority(score: number): TaskPriority {
  if (score >= 90) return 'critical';
  if (score >= 75) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

export function toMonitoringTask(action: CommercialAction, stage: string): MonitoringTask {
  const computed = scoreAction(action);
  const due = new Date();
  due.setDate(due.getDate() + (computed >= 90 ? 3 : computed >= 75 ? 7 : 14));

  return {
    id: crypto.randomUUID(),
    title: action.name,
    description: `${action.description}\n\nAction ID: ${action.id}\nStage: ${stage}\nImportance score: ${action.importance_score}\nStrategy alignment: ${action.strategy_alignment}`,
    pillar: STAGE_TO_PILLAR[stage] || 'general',
    status: 'todo',
    priority: scoreToPriority(computed),
    category: ROLE_TO_CATEGORY[action.role] || 'strategy',
    assignee: action.role,
    dueDate: due.toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    notes: [
      `AI tags: ${(action.ai_tags || []).join(', ')}`,
      `Inputs: ${(action.inputs || []).join(', ')}`,
      `Outputs: ${(action.outputs || []).join(', ')}`,
    ],
    actionContent: {
      goal: action.goal || '',
      callScript: action.supportive_content?.call_script || '',
      emailTemplate: action.supportive_content?.email_template || '',
      presentationNotes: action.supportive_content?.presentation_notes || '',
    },
  };
}

export function loadRepositoryFromStorage(): ActionsRepository {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return ensureSeededPlanPostventaActions(cloneRepository(DEFAULT_REPOSITORY));

  try {
    const parsed = JSON.parse(raw) as ActionsRepository;
    const report = validateRepository(parsed);
    if (!report.valid || detectCircularTriggers(parsed).length > 0) {
      return ensureSeededPlanPostventaActions(cloneRepository(DEFAULT_REPOSITORY));
    }
    return ensureSeededPlanPostventaActions(parsed);
  } catch {
    return ensureSeededPlanPostventaActions(cloneRepository(DEFAULT_REPOSITORY));
  }
}

export function saveRepositoryToStorage(repository: ActionsRepository): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(repository));
}

export function generateActionByRule(context: Partial<TriggerContext>): { stage: string; action: CommercialAction }[] {
  const generated: { stage: string; action: CommercialAction }[] = [];

  if ((context.churn_risk ?? 0) >= 0.7) {
    generated.push({
      stage: 'CUSTOMER_SUCCESS',
      action: {
        id: `AUTO_CHURN_${Date.now()}`,
        name: 'Auto-created churn mitigation sprint',
        description: 'Automatically generated action due to churn risk detection.',
        role: 'Customer Success Agent',
        importance_score: 95,
        strategy_alignment: 95,
        estimated_hours: 3,
        inputs: ['churn_risk', 'account_history'],
        outputs: ['retention_plan'],
        triggers: [{ event: 'health_score_updated', logic: 'churn_model_score >= 0.7' }],
        kpis: [{ name: 'Churn rate', target: 5, unit: '%' }],
        ai_tags: ['customer_success', 'churn_prevention', 'auto_generated'],
        goal: 'Reduce immediate churn risk with executive recovery plan.',
      },
    });
  }

  if ((context.usage_growth ?? 0) >= 20) {
    generated.push({
      stage: 'ACCOUNT_GROWTH',
      action: {
        id: `AUTO_UPSELL_${Date.now()}`,
        name: 'Auto-created expansion proposal',
        description: 'Automatically generated action due to usage expansion signal.',
        role: 'Growth Agent',
        importance_score: 90,
        strategy_alignment: 92,
        estimated_hours: 2.5,
        inputs: ['usage_growth', 'adoption_metrics'],
        outputs: ['expansion_offer'],
        triggers: [{ event: 'usage_updated', logic: 'usage_growth >= 20' }],
        kpis: [{ name: 'Expansion MRR', target: 12, unit: '%' }],
        ai_tags: ['growth', 'upsell', 'auto_generated'],
      },
    });
  }

  if ((context.nps_score ?? 100) < 30) {
    generated.push({
      stage: 'CUSTOMER_SUCCESS',
      action: {
        id: `AUTO_FIDELIZACION_${Date.now()}`,
        name: 'Auto-created NPS loyalty recovery',
        description: 'Automatically generated action due to low NPS.',
        role: 'Customer Success Agent',
        importance_score: 92,
        strategy_alignment: 94,
        estimated_hours: 3,
        inputs: ['nps_score', 'feedback_items'],
        outputs: ['loyalty_plan'],
        triggers: [{ event: 'nps_updated', logic: 'nps_score < 30' }],
        kpis: [{ name: 'NPS improvement', target: 20, unit: 'points' }],
        ai_tags: ['fidelizacion', 'retention', 'auto_generated'],
      },
    });
  }

  return generated;
}
