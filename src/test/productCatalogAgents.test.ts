import { describe, expect, it } from 'vitest';
import { runProductAnalysisAgent, runProductSearchAgent } from '@/agents/productCatalogAgents';
import { parseProductComments, serializeProductComments } from '@/lib/productCatalog';

describe('product catalog agents', () => {
  it('builds strategic signals from product metadata', () => {
    const signal = runProductAnalysisAgent({
      name: 'Predictive Service Suite',
      type: 'innovation',
      comments: 'digital maintenance solution',
      category: 'service',
      characteristics: ['AI diagnostics', 'lifecycle contract'],
    });

    expect(signal.lifecycleSignal).toBe('innovative');
    expect(signal.offerModel).toBe('integrated solutions');
    expect(signal.scenario).toMatch(/consultative/i);
  });

  it('generates catalog suggestions from commercial history', () => {
    const suggestions = runProductSearchAgent({
      products: [],
      orders: [{ productFamily: 'Assembly Cell', sellingPrice: 250000, margin: 20, region: '' }],
      opportunities: [{ productFamily: 'Lifecycle Service', estRevenue: 90000, contractProb: 60, status: 'open', region: '' }],
    });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((item) => item.category === 'service')).toBe(true);
  });

  it('serializes and parses product metadata in comments', () => {
    const encoded = serializeProductComments('base note', {
      category: 'service',
      characteristics: ['Remote monitoring'],
      estimatedCost: 12000,
      repositories: ['Service KB'],
      validated: true,
      source: 'generated',
    });

    const parsed = parseProductComments(encoded);
    expect(parsed.notes).toBe('base note');
    expect(parsed.meta.category).toBe('service');
    expect(parsed.meta.repositories).toContain('Service KB');
  });
});
