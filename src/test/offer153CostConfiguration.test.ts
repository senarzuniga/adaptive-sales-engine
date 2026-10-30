import { beforeEach, describe, expect, it } from 'vitest';
import { applyOffer153LocalConfiguration, buildOffer153Configuration, offer153Specification } from '@/lib/offer153CostConfiguration';
import { computeInstallationCost, describeInstallationPlan } from '@/lib/installationCost';

const companyId = 'ingecart-real';
const storageKey = (table: string) => `acs_workspace_${table}_${companyId}`;
const read = (table: string) => JSON.parse(localStorage.getItem(storageKey(table)) || '[]');
const offer = { id: 'existing-offer-153', company_id: companyId, offer_number: 'OFF-2026-153', customer_name: 'Existing customer', title: 'Existing scope', status: 'draft', kam: 'Existing owner', target_margin: 20 };

describe('OFF-2026-153 authorized cost configuration', () => {
  beforeEach(() => localStorage.clear());

  it('matches every supplied unit cost and the exact direct-cost total', () => {
    const result = buildOffer153Configuration(offer);
    expect(result.items.map((row) => row.item_type)).toEqual(['product', 'product', 'service']);
    expect(result.product.name).toBe('SR1400 104 METROS');
    expect(result.product.estimatedCost).toBe(66520.98);
    expect(result.product.defaultLengthM).toBe(104);
    expect(result.product.configurableByLength).toBe(false);
    const materialCost = result.costRows.filter((row) => row.category === 'materials' && row.offer_item_id === result.items[0].id).reduce((sum, row) => sum + row.total_cost, 0);
    expect(materialCost).toBeCloseTo(55270.98, 2);
    expect(result.directCost).toBe(109020.98);
    expect(result.offer.contract_value).toBe(165708);
    expect(result.offer.offer_total_price_override).toBe(165708);
    expect(result.scenarios[0].selling_price).toBe(165708);
    expect(result.scenarios[0].margin_amount).toBeCloseTo(165708 - result.totalCost, 2);
    expect(result.offer.customer_name).toBe(offer.customer_name);
    expect(result.offer.kam).toBe(offer.kam);
    expect(result.offer.status).toBe('draft');
  });

  it('keeps unspecified quantities/prices pending and never invents them', () => {
    const result = buildOffer153Configuration(offer);
    for (const label of ['PERNO CHARNELA', 'MANÓMETRO']) {
      const line = result.costRows.find((row) => row.line_item === label);
      expect(line).toMatchObject({ quantity: 0, unit_cost: 0, total_cost: 0 });
      expect(line?.notes).toContain('PENDIENTE');
    }
    expect(result.product.validated).toBe(false);
    expect(result.product.averageValue).toBe(0); // No individual selling price was supplied.
  });

  it('models workshop hours and engineering consistently with builder formulas', () => {
    const result = buildOffer153Configuration(offer);
    expect(result.costRows.find((row) => row.line_item.startsWith('MONTAJE EN TALLER'))).toMatchObject({ category: 'subcontracting', quantity: 65, unit_cost: 50, total_cost: 3250 });
    expect(result.costRows.find((row) => row.line_item === 'INGENIERÍA')).toMatchObject({ category: 'engineering', quantity: 1, unit_cost: 2500, hours: 0, hourly_rate: 0, total_cost: 2500 });
    expect(result.costRows.find((row) => row.line_item === 'RAMPA')).toMatchObject({ category: 'materials', quantity: 1, unit_cost: 17400, total_cost: 17400 });
  });

  it('uses the installation lump sum once, without fabricated days/headcount or extra travel', () => {
    const result = buildOffer153Configuration(offer);
    const line = result.costRows.find((row) => row.category === 'installation')!;
    const installed = computeInstallationCost(line.installation);
    expect(line.days).toBe(0);
    expect(line.resources).toBe(0);
    expect(installed.total).toBe(25100);
    expect(installed.travel).toBe(0);
    expect(result.costRows.some((row) => row.category === 'transport')).toBe(false);
    expect(describeInstallationPlan(line.installation, installed)).toContain('all-inclusive'.replace('a', 'A'));
  });

  it('preserves ASE overhead policies and reports direct costs separately', () => {
    const result = buildOffer153Configuration(offer);
    expect(result.offer.cost_policy.warrantyPct).toBe(4);
    expect(result.totalCost).toBeGreaterThan(result.directCost);
    const zeroPolicy = { warrantyPct: 0, financialPct: 0, commercialMgmtPct: 0, materialStructurePct: 0 };
    const noOverheads = buildOffer153Configuration({ ...offer, cost_policy: zeroPolicy });
    expect(noOverheads.totalCost).toBe(109020.98);
    expect(noOverheads.scenarios[0].margin_amount).toBe(56687.02);
  });

  it('updates existing records once, preserves other offers/terms, backs up and reloads correctly', () => {
    localStorage.setItem(storageKey('offers'), JSON.stringify([offer, { id: 'other', offer_number: 'OFF-2026-152' }]));
    localStorage.setItem(storageKey('offer_items'), JSON.stringify([{ id: 'old-item', offer_id: offer.id }, { id: 'other-item', offer_id: 'other' }]));
    localStorage.setItem(storageKey('cost_breakdowns'), JSON.stringify([{ id: 'old-cost', offer_item_id: 'old-item' }, { id: 'other-cost', offer_item_id: 'other-item', total_cost: 10 }]));
    localStorage.setItem(storageKey('offer_commercial_terms'), JSON.stringify([{ offer_id: offer.id, equipment_incoterm: 'DAP', validity_days: 45 }]));
    localStorage.setItem(`acs_products_${companyId}`, JSON.stringify([{ name: 'Other catalog product', averageValue: 20 }]));
    expect(applyOffer153LocalConfiguration(companyId, 'Ingecart 2018 SL')).toBe('applied');
    expect(read('offers').find((row: any) => row.id === offer.id).contract_value).toBe(165708);
    expect(read('offers')).toHaveLength(2);
    expect(read('offer_items').filter((row: any) => row.offer_id === offer.id)).toHaveLength(3);
    expect(read('cost_breakdowns').some((row: any) => row.id === 'old-cost')).toBe(false);
    expect(read('cost_breakdowns').some((row: any) => row.id === 'other-cost')).toBe(true);
    expect(read('offer_commercial_terms')[0]).toMatchObject({ equipment_incoterm: 'DAP', validity_days: 45 });
    const marker = `acs_cost_configuration_${companyId}_${offer153Specification.revision}`;
    const backup = JSON.parse(localStorage.getItem(`${marker}_backup`)!);
    expect(JSON.parse(backup[storageKey('offers')])[0]).toEqual(offer);
    expect(JSON.parse(localStorage.getItem(`acs_products_${companyId}`)!)).toHaveLength(2);
    const before = localStorage.getItem(storageKey('cost_breakdowns'));
    expect(applyOffer153LocalConfiguration(companyId, 'Ingecart 2018 SL')).toBe('already-applied');
    expect(localStorage.getItem(storageKey('cost_breakdowns'))).toBe(before);
  });

  it('never applies to another company or fabricates a missing offer', () => {
    expect(applyOffer153LocalConfiguration(companyId, 'Other Company')).toBe('other-company');
    expect(applyOffer153LocalConfiguration(companyId, 'Ingecart 2018 SL')).toBe('not-found');
    expect(read('offers')).toHaveLength(0);
  });

  it('refuses ambiguous offer duplicates and a conflicting company id', () => {
    localStorage.setItem(storageKey('offers'), JSON.stringify([offer, { ...offer, id: 'duplicate' }]));
    expect(applyOffer153LocalConfiguration(companyId, 'Ingecart 2018 SL')).toBe('not-found');
    localStorage.setItem(storageKey('offers'), JSON.stringify([{ ...offer, company_id: 'someone-else' }]));
    expect(applyOffer153LocalConfiguration(companyId, 'Ingecart 2018 SL')).toBe('not-found');
  });
});