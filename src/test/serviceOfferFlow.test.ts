import { describe, expect, it } from 'vitest';
import {
  buildServiceOfferDraftSeed,
  buildServiceOfferContent,
  buildServiceTopOpportunities,
  isServiceOfferNumber,
  getServiceOfferDraftStorageKey,
  SMART_PLANT_ANNUAL_OFFER_REFERENCES,
} from '@/lib/serviceOfferFlow';

describe('service offer opportunity synthesis', () => {
  it('includes Smart Plant annual offer references', () => {
    const result = buildServiceTopOpportunities({
      opportunities: [],
      assets: [],
      contracts: [],
      interventions: [],
      spareParts: [],
    });
    const referenceIds = SMART_PLANT_ANNUAL_OFFER_REFERENCES.map((ref) => `smart-plant-${ref.offerNumber.toLowerCase()}`);
    referenceIds.forEach((id) => expect(result.some((item) => item.id === id)).toBe(true));
  });

  it('derives opportunities from installed-base signals', () => {
    const result = buildServiceTopOpportunities({
      opportunities: [],
      assets: [
        { customer_name: 'Acme Mills', risk_level: 'high', lifecycle_stage: 'end-of-life', connection_status: 'registered' },
        { customer_name: 'Acme Mills', risk_level: 'medium', lifecycle_stage: 'active', connection_status: 'connected' },
      ],
      contracts: [],
      interventions: [],
      spareParts: [],
    });
    const maint = result.find((item) => item.id === 'asset-maint-acme-mills');
    const digital = result.find((item) => item.id === 'asset-digital-acme-mills');
    expect(maint).toBeDefined();
    expect(maint?.opportunityType).toBe('maintenance');
    expect(digital).toBeDefined();
    expect(digital?.opportunityType).toBe('digital');
  });

  it('converts reactive interventions into a reliability opportunity', () => {
    const result = buildServiceTopOpportunities({
      opportunities: [],
      assets: [],
      contracts: [],
      interventions: [
        { customer_name: 'Beta Plant', intervention_type: 'reactive' },
        { customer_name: 'Beta Plant', intervention_type: 'reactive' },
        { customer_name: 'Beta Plant', intervention_type: 'reactive' },
      ],
      spareParts: [],
    });
    const opportunity = result.find((item) => item.id === 'interventions-beta-plant');
    expect(opportunity).toBeDefined();
    expect(opportunity?.opportunityType).toBe('reliability');
    expect(opportunity?.urgency).toBe('high');
    expect(opportunity?.score).toBeGreaterThan(0);
  });

  it('detects critical spare parts and creates a spares opportunity', () => {
    const result = buildServiceTopOpportunities({
      opportunities: [],
      assets: [],
      contracts: [],
      interventions: [],
      spareParts: [
        { customer_name: 'Gamma Paper', stock_status: 'critical', quantity_on_hand: 0, reorder_point: 5, quantity_recommended: 10, unit_price: 1200 },
        { customer_name: 'Gamma Paper', stock_status: 'ok', quantity_on_hand: 20, reorder_point: 5, quantity_recommended: 2, unit_price: 300 },
      ],
    });
    const opportunity = result.find((item) => item.id === 'spares-gamma-paper');
    expect(opportunity).toBeDefined();
    expect(opportunity?.opportunityType).toBe('spares');
    expect(opportunity?.estimatedValue).toBeGreaterThanOrEqual(12000);
  });

  it('sorts opportunities by descending score', () => {
    const result = buildServiceTopOpportunities({
      opportunities: [],
      assets: [
        { customer_name: 'Score Mills', risk_level: 'high', lifecycle_stage: 'active', connection_status: 'unknown' },
      ],
      contracts: [],
      interventions: [],
      spareParts: [],
    });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });
});

describe('service offer numbering and draft seed', () => {
  it('recognizes service offer numbers by S prefix before the last segment', () => {
    expect(isServiceOfferNumber('OFF-2026-S133')).toBe(true);
    expect(isServiceOfferNumber('OFF-2026-97')).toBe(false);
    expect(isServiceOfferNumber('')).toBe(false);
  });

  it('generates a company-scoped draft storage key', () => {
    expect(getServiceOfferDraftStorageKey('company-123')).toBe('acs_service_offer_draft_company-123');
    expect(getServiceOfferDraftStorageKey()).toBe('acs_service_offer_draft_default');
  });

  it('builds a service draft seed from a candidate', () => {
    const seed = buildServiceOfferDraftSeed({
      id: 'svc-123',
      title: 'Annual maintenance - Acme',
      customerName: 'Acme Mills',
      description: 'Test',
      recommendedAction: 'Prepare service offer',
      recommendedScope: 'Scope details',
      triggerSignal: 'High risk assets',
      opportunityType: 'maintenance',
      sourceType: 'installed-base',
      sourceLabel: 'Installed base',
      estimatedValue: 90000,
      probability: 80,
      urgency: 'high',
      score: 88,
      aiGenerated: true,
      status: 'identified',
      referenceDocuments: [],
    });
    expect(seed.offerKind).toBe('service');
    expect(seed.customerName).toBe('Acme Mills');
    expect(seed.currency).toBe('EUR');
    expect(seed.targetMargin).toBe(35);
    expect(seed.items.length).toBe(1);
    expect(seed.items[0].type).toBe('service');
    expect(seed.items[0].costLines.length).toBe(4);
    expect(seed.serviceContent).toBeDefined();
    expect(seed.serviceContent.sections.length).toBeGreaterThan(0);
    expect(seed.serviceContent.deliverables.length).toBeGreaterThan(0);
    expect(seed.serviceContent.responseSla.length).toBeGreaterThan(0);
  });

  it('builds service content with TPM programme for maintenance type', () => {
    const content = buildServiceOfferContent('maintenance');
    expect(content.sections.includes('tpm-preventive')).toBe(true);
    expect(content.tpmProgramme.daily.length).toBeGreaterThan(0);
    expect(content.tpmProgramme.weekly.length).toBeGreaterThan(0);
    expect(content.tpmProgramme.monthly.length).toBeGreaterThan(0);
    expect(content.tpmProgramme.quarterly.length).toBeGreaterThan(0);
    expect(content.whyIngecart.some((line) => line.includes('1,200 m'))).toBe(true);
    expect(content.coveredMachines.some((line) => line.toLowerCase().includes('corrug'))).toBe(true);
  });

  it('builds service content without TPM for digital type', () => {
    const content = buildServiceOfferContent('digital');
    expect(content.sections.includes('tpm-preventive')).toBe(false);
    expect(content.scopeSummary.toLowerCase()).toContain('smart plant');
    expect(content.deliverables.length).toBeGreaterThan(0);
  });
});
