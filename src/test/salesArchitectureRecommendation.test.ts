import { describe, expect, it } from 'vitest';
import { buildSalesArchitectureFallbackRecommendation } from '@/lib/salesArchitecture';

describe('buildSalesArchitectureFallbackRecommendation', () => {
  it('covers the required global sales architecture outcome', () => {
    const result = buildSalesArchitectureFallbackRecommendation({
      companyName: 'DemoCo',
      currentRevenue: 2200000,
      targetRevenue: 4500000,
      teamSize: 12,
      businessDescription: 'Industrial B2B company selling automation and service contracts.',
      strategicGoals: 'Scale internationally with a more systematic sales model.',
      totalPipeline: 1800000,
      totalNeglected: 450000,
      regions: [
        { region: 'USA', pipeline: 900000, customers: 8, neglected: 2 },
        { region: 'SPAIN', pipeline: 500000, customers: 10, neglected: 3 },
      ],
      kams: [
        { name: 'Ana', pipeline: 800000, sold: 250000, neglected: 2, regions: ['USA'] },
      ],
    });

    expect(result).toMatch(/Market Segmentation/i);
    expect(result).toMatch(/Geographic Sales Model/i);
    expect(result).toMatch(/Channel Strategy/i);
    expect(result).toMatch(/Pricing Architecture/i);
    expect(result).toMatch(/Opportunity Management/i);
    expect(result).toMatch(/Sales Resource Allocation/i);
    expect(result).toMatch(/Systematic Growth/i);
    expect(result).toMatch(/Option Scorecard/i);
  });
});
