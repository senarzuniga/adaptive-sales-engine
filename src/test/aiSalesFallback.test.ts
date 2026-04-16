import { describe, expect, it } from 'vitest';
import { buildFallbackActionPool } from '@/lib/aiSalesFallback';

describe('AI sales fallback action pool', () => {
  it('returns prioritized actions when remote AI is unavailable', () => {
    const result = buildFallbackActionPool({
      companyProfile: { company_name: 'DemoCo', strategic_goals: 'Grow service contracts', industry: 'Industrial' },
      opportunities: [
        { customerName: 'Acme', productFamily: 'Service', estRevenue: 500000, contractProb: 80, margin: 28, status: 'open', kam: 'Ana', region: 'Spain' },
        { customerName: 'Globex', productFamily: 'Upgrade', estRevenue: 200000, contractProb: 35, margin: 20, status: 'neglected', kam: 'Luis', region: 'France' },
      ],
      orders: [
        { customerName: 'Acme', productFamily: 'Spare parts', sellingPrice: 300000, margin: 22, kam: 'Ana', region: 'Spain' },
      ],
      strategy: [],
      tasks: [],
    });

    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.summary.totalActions).toBe(result.actions.length);
    expect(result.actions.some((action) => action.priority === 'critical')).toBe(true);
  });
});
