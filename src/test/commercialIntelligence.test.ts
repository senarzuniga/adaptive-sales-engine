import { describe, expect, it } from 'vitest';
import { buildCommercialIntelligence, buildStrategyDiagnostic, harmonizeCommercialRecords } from '@/lib/commercialIntelligence';

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

  it('measures strategy achievement against actual revenue and exposes the real gap to the strategic plan', () => {
    const intelligence = buildCommercialIntelligence({
      company: {
        company_name: 'Ingecart',
        industry: 'Packaging Automation',
        annual_revenue: 'Targeting €3.5M within 3 years',
        strategy_context: 'Three-pillar growth model: Standard Products target €2.8M, Custom Projects €0.5M/year, Services growing from €0.2M to €1.1M+ at scale.',
        strategic_goals: 'Reach the three-pillar commercial model with strong service growth.',
        business_description: 'Provider of packaging automation and services.',
        main_products: 'AMR, Easy Pack, Retal, Palletizer, Services',
      },
      orders: [
        { customerName: 'Client A', productFamily: 'AMR', region: 'Spain', sellingPrice: 220000, margin: 25, kam: 'Ana' },
        { customerName: 'Client B', productFamily: 'Service', region: 'Spain', sellingPrice: 180000, margin: 30, kam: 'Ana' },
      ],
      opportunities: [
        { customerName: 'Client C', productFamily: 'Retal', region: 'Spain', estRevenue: 300000, contractProb: 60, status: 'open', kam: 'Ana' },
      ],
      products: [
        { name: 'AMR', type: 'innovation', averageValue: 120000, comments: 'Strategic product' },
        { name: 'Service Contract', type: 'commodity', averageValue: 40000, comments: 'Recurring revenue' },
      ],
      strategy: [],
    });

    expect(intelligence.strategyDiagnostic.targetRevenue).toBe(3500000);
    expect(intelligence.strategyDiagnostic.currentRevenue).toBe(400000);
    expect(intelligence.strategyDiagnostic.revenueGap).toBe(3100000);
    expect(intelligence.strategyDiagnostic.currentAchievementPct).toBeLessThan(20);
    expect(intelligence.strategyDiagnostic.pipelineCoveragePct).toBeLessThan(30);
    expect(intelligence.rootCauseMap.length).toBeGreaterThan(0);
    expect(intelligence.bridgePlan.length).toBeGreaterThan(0);
  });

  it('prefers the trusted company target when strategy rows are suspiciously inflated', () => {
    const diagnostic = buildStrategyDiagnostic({
      company: {
        company_name: 'Ingecart',
        annual_revenue: 'Current Revenue €2.0M · Target Revenue (3 years) €3.5M',
        strategy_context: 'Current Model 85% Custom Projects · Target Model 80% Standard Products',
      },
      orders: [
        { customerName: 'Client A', productFamily: 'AMR', region: 'Spain', sellingPrice: 400000, margin: 25, kam: 'Ana' },
      ],
      opportunities: [],
      strategy: Array.from({ length: 13 }, (_, idx) => ({
        productFamily: idx % 2 === 0 ? 'Standard Products' : 'Custom Projects',
        region: 'Europe',
        estRevenue: 3500000,
        margin: 25,
        kam: 'Ana',
      })),
    });

    expect(diagnostic.targetRevenue).toBe(3500000);
    expect(diagnostic.targetSource).toBe('Company Profile Target');
    expect(diagnostic.validationWarnings.length).toBeGreaterThan(0);
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
