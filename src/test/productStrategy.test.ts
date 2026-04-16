import { describe, expect, it } from 'vitest';
import { buildProductPositioningActions, buildProductStrategySnapshot, evaluateProductActionFeedback } from '@/lib/productStrategy';

describe('product strategy snapshot', () => {
  it('classifies products by lifecycle and market fit', () => {
    const result = buildProductStrategySnapshot({
      products: [
        { name: 'Smart Service', averageValue: 120000, type: 'innovation', comments: 'predictive monitoring' },
        { name: 'Standard Parts', averageValue: 18000, type: 'commodity', comments: 'high volume replacements' },
      ],
      orders: [
        { productFamily: 'Smart Service', sellingPrice: 300000, margin: 32, region: 'Spain' },
        { productFamily: 'Standard Parts', sellingPrice: 90000, margin: 12, region: 'France' },
      ],
      opportunities: [
        { productFamily: 'Smart Service', estRevenue: 500000, contractProb: 70, status: 'open', region: 'Spain' },
        { productFamily: 'Standard Parts', estRevenue: 40000, contractProb: 30, status: 'open', region: 'France' },
      ],
    });

    expect(result.products.length).toBe(2);
    expect(result.products[0].lifecycleLabel.length).toBeGreaterThan(0);
    expect(result.summary).toMatch(/portfolio/i);
  });

  it('creates actionable product-positioning recommendations with scripts and support content', () => {
    const snapshot = buildProductStrategySnapshot({
      products: [
        { name: 'Smart Service', averageValue: 120000, type: 'innovation', comments: 'predictive monitoring' },
      ],
      orders: [{ productFamily: 'Smart Service', sellingPrice: 300000, margin: 32, region: 'Spain' }],
      opportunities: [{ productFamily: 'Smart Service', estRevenue: 500000, contractProb: 70, status: 'open', region: 'Spain' }],
    });

    const actions = buildProductPositioningActions(snapshot.products, 'DemoCo');
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].goal).toMatch(/Smart Service/i);
    expect(actions[0].supportContent).toMatch(/positioning/i);
    expect(actions[0].script).toMatch(/opening/i);
  });

  it('reprioritizes actions based on voice or written feedback', () => {
    const evaluation = evaluateProductActionFeedback(
      {
        id: '1',
        title: 'Reposition commodity offer',
        priority: 'medium',
        scenario: 'Commodity defense',
      },
      'Customer says price pressure is high and deal is stalled, we need a stronger service-value scenario.'
    );

    expect(evaluation.priority).toBe('high');
    expect(evaluation.newActionNeeded).toBe(true);
    expect(evaluation.scenarioAdjustment).toMatch(/service-value/i);
  });
});
