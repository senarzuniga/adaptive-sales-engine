import type { GoaDataSnapshot, GoaPanelContext, GoaProposedChange } from '@/agents/goa/types';

export interface PanelAgentResult {
  changes: GoaProposedChange[];
  suggestions: string[];
  confidence: number;
}

export function runPanelSpecificAgent(input: {
  context: GoaPanelContext;
  prompt: string;
  data: GoaDataSnapshot;
}): PanelAgentResult {
  const panel = input.context.panelKey;
  const prompt = input.prompt.toLowerCase();

  if (panel === 'offer_pricing') {
    return {
      changes: [],
      suggestions: [
        'Offer & Pricing changes require direct offer record updates in the dedicated panel workflow.',
        'Use this prompt to generate validation or improvement suggestions before applying commercial offer edits.',
      ],
      confidence: 0.74,
    };
  }

  if (panel === 'sales_architecture' || panel === 'ai_sales') {
    if (/recalculate|kpi|metric|pipeline/i.test(prompt)) {
      return {
        changes: [
          {
            dataset: 'external',
            description: 'Recalculation trigger registered for sales metrics and strategic indicators.',
          },
        ],
        suggestions: [
          'Metrics will refresh on the next render cycle using the updated data context.',
        ],
        confidence: 0.81,
      };
    }
  }

  return {
    changes: [],
    suggestions: [],
    confidence: 0.65,
  };
}
