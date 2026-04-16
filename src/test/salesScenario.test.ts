import { describe, expect, it } from 'vitest';
import { buildSalesScenarioRecommendation, buildScenarioSynthesis } from '@/lib/salesScenario';

describe('sales scenario recommendations', () => {
  it('builds a named scenario report from a custom prompt', () => {
    const report = buildSalesScenarioRecommendation({
      scenarioName: 'Scenario 1',
      prompt: 'What if we use a hybrid distributor model for Germany and France?',
      companyName: 'DemoCo',
      totalPipeline: 2500000,
      totalSold: 900000,
      keyRegions: ['Germany', 'France'],
      topCustomers: ['Acme', 'Globex'],
    });

    expect(report).toMatch(/Scenario 1/i);
    expect(report).toMatch(/hybrid distributor model/i);
    expect(report).toMatch(/recommended moves/i);
  });

  it('creates a final AI plus context recommendation across scenarios', () => {
    const summary = buildScenarioSynthesis([
      { name: 'Scenario 1', prompt: 'Distributor-led expansion', report: 'Focus on partners and coverage.' },
      { name: 'Scenario 2', prompt: 'Direct enterprise team', report: 'Focus on strategic accounts.' },
    ]);

    expect(summary).toMatch(/AI \+ Context - Recommendations/i);
    expect(summary).toMatch(/Scenario 1/i);
    expect(summary).toMatch(/Scenario 2/i);
  });
});
