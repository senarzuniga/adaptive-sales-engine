import { describe, expect, it } from 'vitest';
import {
  buildCompetitiveLandscapes,
  buildPortfolioAnalysis,
  buildProductPositioningModel,
  buildStrategyRoadmaps,
} from '@/lib/positioningEngine';

describe('positioning engine', () => {
  const company = {
    company_name: 'Ingecart',
    industry: 'Industrial Automation',
    sub_sector: '',
    headquarters: '',
    operating_regions: '',
    employee_count: '',
    annual_revenue: '',
    main_products: '',
    main_customer_segments: 'Corrugated packaging plants',
    main_competitors: 'ABB, KUKA, ProMach',
    sales_team_size: '',
    kam_count: '',
    sales_channels: '',
    current_challenges: '',
    strategic_goals: '',
    additional_notes: '',
    website_url: '',
    linkedin_url: '',
    business_description: '',
    objectives: '',
    strategy_context: '',
    market_context: '',
    enrichment_status: 'completed',
  };

  it('builds positioning records for product families with deterministic fields', () => {
    const positioning = buildProductPositioningModel({
      company,
      products: [{ name: 'AMR Systems', type: 'Innovation', averageValue: 200000, comments: 'digital routing' }],
      orders: [{ productFamily: 'AMR Systems', sellingPrice: 400000, margin: 28 } as any],
      opportunities: [{ productFamily: 'AMR Systems', estRevenue: 300000, contractProb: 60, status: 'open' } as any],
      strategy: [{ productFamily: 'AMR Systems', estRevenue: 500000 } as any],
    });

    expect(positioning.length).toBe(1);
    expect(positioning[0].name).toBe('AMR Systems');
    expect(positioning[0].lifecycleStage.length).toBeGreaterThan(0);
    expect(positioning[0].differentiationScore).toBeGreaterThan(0);
    expect(positioning[0].recommendedSalesApproach.length).toBeGreaterThan(0);
  });

  it('builds portfolio, landscape, and roadmap outputs from positioning records', () => {
    const positioning = buildProductPositioningModel({
      company,
      products: [
        { name: 'AMR Systems', type: 'Innovation', averageValue: 200000, comments: 'digital routing' },
        { name: 'Retal', type: 'Commodity', averageValue: 90000, comments: 'standard handling' },
      ],
      orders: [
        { productFamily: 'AMR Systems', sellingPrice: 400000, margin: 28 } as any,
        { productFamily: 'Retal', sellingPrice: 120000, margin: 14 } as any,
      ],
      opportunities: [
        { productFamily: 'AMR Systems', estRevenue: 300000, contractProb: 60, status: 'open' } as any,
      ],
      strategy: [{ productFamily: 'AMR Systems', estRevenue: 500000 } as any],
    });

    const portfolio = buildPortfolioAnalysis(positioning, [
      { productFamily: 'AMR Systems', sellingPrice: 400000 } as any,
      { productFamily: 'Retal', sellingPrice: 120000 } as any,
    ]);
    const landscapes = buildCompetitiveLandscapes(positioning, company as any);
    const roadmaps = buildStrategyRoadmaps(positioning);

    expect(portfolio.totalProducts).toBe(2);
    expect(portfolio.portfolioHealthScore).toBeGreaterThan(0);
    expect(landscapes.length).toBe(2);
    expect(roadmaps.length).toBe(2);
  });
});
