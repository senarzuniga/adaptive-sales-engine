import { describe, expect, it } from 'vitest';
import { buildFallbackMarketingContent } from '@/lib/marketingContentFallback';

describe('marketing content fallback', () => {
  it('builds publish-ready content when remote generation is unavailable', () => {
    const result = buildFallbackMarketingContent({
      contentType: 'article',
      topic: 'How to improve industrial service contracts',
      targetPlatform: 'linkedin',
      companyProfile: {
        company_name: 'DemoCo',
        industry: 'Industrial automation',
        main_products: 'Service contracts, spare parts',
        strategic_goals: 'Grow lifecycle revenue',
      },
      context: {
        ordersCtx: 'Top customers include Acme and Globex.',
        oppsCtx: 'Open pipeline is €2,300,000 in Spain and France.',
      },
    });

    expect(result.platform).toBe('linkedin');
    expect(result.title.length).toBeGreaterThan(5);
    expect(result.body).toMatch(/DemoCo/i);
    expect(result.hashtags.length).toBeGreaterThan(0);
  });
});
