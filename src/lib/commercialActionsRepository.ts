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
            email_template: 'Subject: Strategic fit conversation — {{company}}',
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

const REQUIRED_FIELDS = ['id', 'description', 'role', 'inputs', 'outputs', 'triggers', 'kpis', 'ai_tags'] as const;

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
        if ((action as Record<string, unknown>)[field] === undefined) {
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
  if (!raw) return cloneRepository(DEFAULT_REPOSITORY);

  try {
    const parsed = JSON.parse(raw) as ActionsRepository;
    const report = validateRepository(parsed);
    if (!report.valid || detectCircularTriggers(parsed).length > 0) {
      return cloneRepository(DEFAULT_REPOSITORY);
    }
    return parsed;
  } catch {
    return cloneRepository(DEFAULT_REPOSITORY);
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
