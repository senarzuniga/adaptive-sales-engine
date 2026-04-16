import { describe, expect, it } from 'vitest';
import { buildFallbackIntelligenceReport } from '@/lib/businessIntelligenceFallback';

describe('business intelligence fallback', () => {
  it('supports regional and sector-style analysis subjects', () => {
    const report = buildFallbackIntelligenceReport({
      targetName: 'Carton board sector in France',
      analysisType: 'geographic-market',
      subjectType: 'sector',
      analysisBrief: 'Focus on industrial packaging, machinery suppliers, and growth outlook.',
      companyContext: { company_name: 'DemoCo', industry: 'Paper machinery' },
    });

    expect(report.executive_summary).toMatch(/Carton board sector in France/i);
    expect(report.market_analysis.trends.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});
