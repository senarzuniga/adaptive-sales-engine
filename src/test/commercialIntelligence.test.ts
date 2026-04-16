import { describe, expect, it } from 'vitest';
import { buildCommercialIntelligence, harmonizeCommercialRecords } from '@/lib/commercialIntelligence';

describe('commercial intelligence engine', () => {
  it('enforces sales truth so probability 100 offers become sold and do not inflate open pipeline', () => {
    const result = harmonizeCommercialRecords({
      orders: [
        {
          oppNumber: 'SO-10',
          customerName: 'Alpha Foods',
          productFamily: 'Robotics',
          region: 'Iberia',
          sellingPrice: 120000,
        },
      ],
      opportunities: [
        {
          oppNumber: 'SO-20',
          customerName: 'Beta Plastics',
          productFamily: 'Sensors',
          region: 'France',
          estRevenue: 90000,
          contractProb: 100,
          status: 'open',
        },
        {
          oppNumber: 'SO-21',
          customerName: 'Gamma Steel',
          productFamily: 'Services',
          region: 'Germany',
          estRevenue: 50000,
          contractProb: 40,
          status: 'open',
        },
      ],
    });

    expect(result.opportunities.find((item) => item.oppNumber === 'SO-20')?.status).toBe('won');
    expect(result.metrics.soldRevenue).toBe(210000);
    expect(result.metrics.openPipeline).toBe(50000);
  });

  it('builds multi-layer commercial intelligence with competitors, segmentation, opportunities, and actions', () => {
    const intelligence = buildCommercialIntelligence({
      company: {
        company_name: 'Adaptive Sales Engine',
        industry: 'Industrial Automation',
        main_customer_segments: 'Food, Packaging, Automotive',
        main_competitors: 'ABB, Siemens',
        strategic_goals: 'Grow services and solution-selling',
        market_context: 'European industrial OEM market',
        business_description: 'Integrator of automation, controls, and services',
      },
      orders: [
        { customerName: 'Ingecart Spain', productFamily: 'Automation', region: 'Iberia', sellingPrice: 200000, margin: 28, kam: 'Ana' },
        { customerName: 'PackCo', productFamily: 'Service', region: 'France', sellingPrice: 150000, margin: 32, kam: 'Luis' },
      ],
      opportunities: [
        { customerName: 'Ingecart Spain', productFamily: 'Spare Parts', region: 'Iberia', estRevenue: 60000, contractProb: 82, status: 'open', kam: 'Ana' },
        { customerName: 'New Foods', productFamily: 'Automation', region: 'Italy', estRevenue: 180000, contractProb: 55, status: 'open', kam: 'Luis' },
      ],
      products: [
        { name: 'Automation Cell', type: 'innovation', averageValue: 120000, comments: 'High differentiation' },
        { name: 'Service Contract', type: 'commodity', averageValue: 40000, comments: 'Recurring revenue' },
      ],
      strategy: [
        { productFamily: 'Automation', region: 'Iberia', estRevenue: 300000, margin: 25, kam: 'Ana' },
        { productFamily: 'Service', region: 'France', estRevenue: 200000, margin: 30, kam: 'Luis' },
      ],
      leads: [
        { company: 'Delta Foods', region: 'Italy', interest: 'Automation retrofit' },
        { company: 'Nova Packaging', region: 'Germany', interest: 'Predictive maintenance' },
      ],
      assets: [
        { customerName: 'Ingecart Spain', lifecycle_stage: 'mid-life', risk_level: 'medium' },
      ],
    });

    expect(intelligence.keyAccounts.length).toBeGreaterThan(0);
    expect(intelligence.productPortfolio.length).toBeGreaterThan(0);
    expect(intelligence.competitors.length).toBeGreaterThan(0);
    expect(intelligence.marketSegments.length).toBeGreaterThan(0);
    expect(intelligence.opportunities.length).toBeGreaterThan(0);
    expect(intelligence.actions.length).toBeGreaterThan(0);
    expect(intelligence.qualityGate.accepted).toBe(true);
  });
});
