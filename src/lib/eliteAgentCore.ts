export interface EliteLoopStep<T> {
  observe: T;
  understand: string;
  hypotheses: string[];
  action: string;
  measurement: {
    expectedOutcome: number;
    realOutcome: number;
    delta: number;
  };
  learning: string;
  optimization: string;
  explainability: {
    reason: string;
    dataUsed: string[];
    expectedImpact: string;
  };
}

export interface EliteAgentMemory<TContext = unknown> {
  shortTerm: TContext[];
  longTerm: Array<{
    actionId: string;
    context: string;
    expectedOutcome: number;
    realOutcome: number;
    delta: number;
    timestamp: string;
  }>;
  semantic: Array<{
    pattern: string;
    strategy: string;
    performance: number;
  }>;
}

export const defaultEliteMemory = <TContext,>(): EliteAgentMemory<TContext> => ({
  shortTerm: [],
  longTerm: [],
  semantic: [],
});

export function runEliteLoop<TObserve>(params: {
  observation: TObserve;
  understand: string;
  hypotheses: string[];
  action: string;
  expectedOutcome: number;
  realOutcome: number;
  reason: string;
  dataUsed: string[];
  expectedImpact: string;
}): EliteLoopStep<TObserve> {
  const delta = Number((params.realOutcome - params.expectedOutcome).toFixed(3));
  const learning = delta >= 0
    ? 'Outcome met or exceeded expectation. Keep this strategy and reinforce similar patterns.'
    : 'Outcome underperformed expectation. Adjust scoring weights and targeting logic.';

  const optimization = delta >= 0
    ? 'Increase confidence weight for similar contexts in next-best-action selection.'
    : 'Reduce confidence for this action in similar contexts and try alternative hypotheses.';

  return {
    observe: params.observation,
    understand: params.understand,
    hypotheses: params.hypotheses,
    action: params.action,
    measurement: {
      expectedOutcome: params.expectedOutcome,
      realOutcome: params.realOutcome,
      delta,
    },
    learning,
    optimization,
    explainability: {
      reason: params.reason,
      dataUsed: params.dataUsed,
      expectedImpact: params.expectedImpact,
    },
  };
}

export function expectedImpactScore(params: {
  revenueProbability: number;
  value: number;
  cost: number;
  effort: number;
}): number {
  return Number(((params.revenueProbability * params.value) - (params.cost + params.effort)).toFixed(2));
}

export function runFactCheckValidation(params: {
  batchEntityHashes: string[];
  unresolved: Array<{ entity_hash: string; entity_name: string }>;
}) {
  const batch = new Set(params.batchEntityHashes);
  const blocking = params.unresolved.filter((item) => batch.has(item.entity_hash));
  return {
    valid: blocking.length === 0,
    blocking,
    error: blocking.length > 0
      ? `Cannot save: unresolved contradictions for ${[...new Set(blocking.map((item) => item.entity_name))].join(', ')}`
      : null,
  };
}
