import {
  appendPromptHistory,
  findReusableMemory,
  normalizePromptKey,
  saveAgentMemory,
  savePanelChangeLog,
} from '@/lib/goaPersistence';
import { runDataCorrectionAgent } from '@/agents/goa/dataCorrectionAgent';
import { runDataEnrichmentAgent } from '@/agents/goa/dataEnrichmentAgent';
import { runHierarchyCorrectionAgent } from '@/agents/goa/hierarchyCorrectionAgent';
import { runPanelSpecificAgent } from '@/agents/goa/panelSpecificAgents';
import { validateGoaUpdate } from '@/agents/goa/validationAgent';
import type {
  GoaDataSnapshot,
  GoaExecutionResult,
  GoaIntent,
  GoaMemoryRecord,
  GoaMutators,
  GoaPanelContext,
  GoaProposedChange,
} from '@/agents/goa/types';

const CONFIDENCE_THRESHOLD = 0.75;

function detectIntents(prompt: string): GoaIntent[] {
  const lower = prompt.toLowerCase();
  const intents = new Set<GoaIntent>();

  if (/fix|correct|wrong|error|inconsisten|ajust|correg|repair/.test(lower)) intents.add('data_correction');
  if (/enrich|fill|complete|infer|link|merge|augment/.test(lower)) intents.add('data_enrichment');
  if (/query|show|list|what|how many|summary|count/.test(lower)) intents.add('data_query');
  if (/schema|column|field|structure|create table|add panel|new panel|route/.test(lower)) intents.add('structural_change');
  if (/kam|key\s*account|hierarchy|org\s*chart|commercial\s*structure|agent\s*structure/.test(lower)) intents.add('hierarchy_correction');
  if (/insight|recommend|analy|pattern|trend|kpi/.test(lower)) intents.add('insight_request');

  if (intents.size === 0) intents.add('clarification_required');
  return [...intents];
}

function cloneSnapshot(snapshot: GoaDataSnapshot): GoaDataSnapshot {
  return {
    orders: snapshot.orders.map((order) => ({ ...order })),
    opportunities: snapshot.opportunities.map((opportunity) => ({ ...opportunity })),
    products: snapshot.products.map((product) => ({ ...product })),
    strategy: snapshot.strategy.map((strategy) => ({ ...strategy })),
    leads: snapshot.leads.map((lead) => ({ ...lead })),
    contacts: snapshot.contacts.map((contact) => ({ ...contact })),
    companyProfile: { ...snapshot.companyProfile },
  };
}

async function applySnapshot(mutators: GoaMutators, snapshot: GoaDataSnapshot) {
  await Promise.all([
    Promise.resolve(mutators.setOrders(snapshot.orders)),
    Promise.resolve(mutators.setOpportunities(snapshot.opportunities)),
    Promise.resolve(mutators.setProducts(snapshot.products)),
    Promise.resolve(mutators.setStrategy(snapshot.strategy)),
    Promise.resolve(mutators.setLeads(snapshot.leads)),
    Promise.resolve(mutators.setContacts(snapshot.contacts)),
  ]);
}

function buildClarificationQuestion(panel: string) {
  return `I can help in ${panel}. Do you want data correction, enrichment, KPI recalculation, or structure changes?`;
}

export async function executeGlobalOrchestration(input: {
  context: GoaPanelContext;
  data: GoaDataSnapshot;
  mutators: GoaMutators;
  suggestOnly?: boolean;
}): Promise<GoaExecutionResult> {
  const intents = detectIntents(input.context.user_prompt);
  const before = cloneSnapshot(input.data);
  let after = cloneSnapshot(input.data);

  if (intents.includes('clarification_required')) {
    return {
      intents,
      safeMode: true,
      confidence: 0.45,
      changesApplied: [],
      suggestions: ['Prompt is too vague to safely modify data.', 'Provide target dataset and operation details.'],
      clarificationQuestion: buildClarificationQuestion(input.context.panel),
      executionSummary: 'Clarification required before execution.',
    };
  }

  const promptKey = normalizePromptKey(input.context.user_prompt);
  const reusableMemory = await findReusableMemory({
    companyId: input.context.company_id,
    panelKey: input.context.panelKey,
    promptKey,
  });

  const changes: GoaProposedChange[] = [];
  const suggestions: string[] = [];
  const confidenceSignals: number[] = [];

  if (reusableMemory && !input.suggestOnly) {
    suggestions.push('Auto-reuse: previously successful correction pattern was detected for this panel and prompt.');
    confidenceSignals.push(reusableMemory.confidence || 0.8);
  }

  if (intents.includes('data_correction')) {
    const correction = runDataCorrectionAgent({
      context: input.context,
      prompt: input.context.user_prompt,
      data: after,
    });
    after = correction.updatedData;
    changes.push(...correction.changes);
    confidenceSignals.push(correction.confidence);
  }

  if (intents.includes('hierarchy_correction')) {
    const hierarchyCorrection = await runHierarchyCorrectionAgent({
      context: input.context,
      prompt: input.context.user_prompt,
      data: after,
    });

    after = hierarchyCorrection.updatedData;
    changes.push(...hierarchyCorrection.changes);
    suggestions.push(...hierarchyCorrection.suggestions);
    confidenceSignals.push(hierarchyCorrection.confidence);
  }

  if (intents.includes('data_enrichment')) {
    const enrichment = runDataEnrichmentAgent({
      context: input.context,
      prompt: input.context.user_prompt,
      data: after,
    });
    after = enrichment.updatedData;
    changes.push(...enrichment.changes);
    confidenceSignals.push(enrichment.confidence);
  }

  if (intents.includes('insight_request') || intents.includes('data_query') || intents.includes('structural_change')) {
    const panelSpecific = runPanelSpecificAgent({
      context: input.context,
      prompt: input.context.user_prompt,
      data: after,
    });
    changes.push(...panelSpecific.changes);
    suggestions.push(...panelSpecific.suggestions);
    confidenceSignals.push(panelSpecific.confidence);
  }

  const validation = validateGoaUpdate({
    before,
    after,
    requestedIntents: intents,
  });

  const avgConfidence = confidenceSignals.length > 0
    ? confidenceSignals.reduce((sum, value) => sum + value, 0) / confidenceSignals.length
    : 0.6;
  const confidence = Number(Math.min(validation.confidence, avgConfidence).toFixed(2));

  const safeMode = input.suggestOnly || confidence < CONFIDENCE_THRESHOLD || !validation.valid;
  if (!validation.valid) {
    suggestions.push(...validation.issues.map((issue) => issue.message));
  }

  if (changes.length === 0) {
    suggestions.push('No deterministic changes were applied from the current prompt.');
  }

  if (!safeMode && changes.some((change) => change.dataset !== 'external')) {
    await applySnapshot(input.mutators, after);
  }

  await appendPromptHistory(input.context.company_id, input.context.panelKey, input.context.user_prompt);

  const memoryRecord: GoaMemoryRecord = {
    company_id: input.context.company_id,
    panel_key: input.context.panelKey,
    prompt_key: promptKey,
    prompt: input.context.user_prompt,
    intent: intents.join(','),
    action_taken: safeMode ? 'suggested' : 'applied',
    context: {
      panel: input.context.panel,
      route: input.context.route,
    },
    result: {
      changesApplied: changes.length,
      suggestions,
      safeMode,
    },
    feedback: null,
    confidence,
    auto_apply: !safeMode && confidence >= 0.82,
  };
  await saveAgentMemory(memoryRecord);

  if (!safeMode) {
    await savePanelChangeLog({
      company_id: input.context.company_id,
      panel: input.context.panel,
      panel_key: input.context.panelKey,
      prompt: input.context.user_prompt,
      change: changes.map((change) => change.description).join(' | '),
      before_state: {
        orders: before.orders,
        opportunities: before.opportunities,
        products: before.products,
        strategy: before.strategy,
        leads: before.leads,
        contacts: before.contacts,
      },
      after_state: {
        orders: after.orders,
        opportunities: after.opportunities,
        products: after.products,
        strategy: after.strategy,
        leads: after.leads,
        contacts: after.contacts,
      },
      agent_confidence: confidence,
    });
  }

  return {
    intents,
    safeMode,
    confidence,
    changesApplied: safeMode ? [] : changes,
    suggestions,
    executionSummary: safeMode
      ? 'Execution completed in safe mode. Suggestions generated without direct mutation.'
      : 'Prompt executed and panel data updated successfully.',
  };
}
