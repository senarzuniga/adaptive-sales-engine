import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { recoverMissingIngecartData } from '@/lib/ingecartWorkspaceRecovery';
import { buildDefaultCommercialTerms, hydrateCommercialTerms, summarizePackageCostWithPolicy } from '@/lib/offerPackages';
import { DEFAULT_INGECART_POLICY } from '@/lib/utils';
import rawPack from '../../public/company-packs/Ingecart/ingecart_pack.json?raw';

const pack = JSON.parse(rawPack);
const companyId = 's138-test';
const key = (table: string) => `acs_workspace_${table}_${companyId}`;
const read = (table: string) => JSON.parse(localStorage.getItem(key(table)) || '[]');
const offer = pack.workspace.offers.find((row: any) => row.offer_number === 'OFF-2026-S138');
const item = pack.workspace.offer_items.find((row: any) => row.offer_id === offer.id);
const costs = pack.workspace.cost_breakdowns.filter((row: any) => row.offer_item_id === item.id);
const terms = pack.workspace.offer_commercial_terms.find((row: any) => row.offer_id === offer.id);
const savedOffer = { id: 'existing', offer_number: 'OFF-2026-120', title: 'User edited', contract_value: 123 };
const seedExisting = () => {
  for (const suffix of ['orders', 'opps', 'products', 'strategy', 'leads', 'contacts', 'tasks']) localStorage.setItem(`acs_${suffix}_${companyId}`, '[]');
  localStorage.setItem(key('offers'), JSON.stringify([savedOffer]));
  localStorage.setItem(key('offer_items'), JSON.stringify([{ id: 'edited-item', offer_id: savedOffer.id, description: 'Keep me' }]));
  localStorage.setItem(key('cost_breakdowns'), JSON.stringify([{ id: 'edited-cost', offer_item_id: 'edited-item', total_cost: 77 }]));
};
const recover = () => recoverMissingIngecartData(companyId, 'Ingecart 2018 SL');

describe('Durable SAICA OFF-2026-S138 recovery from the actual shipped pack', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => pack }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

  it('ships one Spanish draft at 5450 ex VAT with a separate provisional internal cost basis', () => {
    expect(pack.workspace.offers).toHaveLength(60);
    expect(pack.workspace.offers.filter((row: any) => row.offer_number === 'OFF-2026-S138')).toHaveLength(1);
    expect(offer).toMatchObject({ status: 'draft', offer_kind: 'service', document_language: 'es', currency: 'EUR', contract_value: 5450, offer_total_price_override: 5450, total_cost: 4776.44 });
    expect(costs).toHaveLength(2);
    expect(costs.find((row: any) => row.category === 'materials').total_cost).toBe(2176.44);
    expect(costs.find((row: any) => row.category === 'engineering')).toMatchObject({ hours: 40, hourly_rate: 65, total_cost: 2600 });
    expect(costs.find((row: any) => row.category === 'engineering').notes).toMatch(/PROVISIONAL.*NO APROBADA/);
    expect(costs.reduce((sum: number, row: any) => sum + row.total_cost, 0)).toBeCloseTo(4776.44, 2);
    const scenario = pack.workspace.offer_scenarios.find((row: any) => row.offer_id === offer.id);
    expect(scenario.ai_analysis.engineering_package_selling_price).toBe(3273.56);
    expect(scenario.margin_amount).toBeCloseTo(5450 - 4776.44, 2);
    const summary = summarizePackageCostWithPolicy({ id: 'test', name: '', type: 'core', itemIds: [item.id], commercialPrice: 5450, executiveSummary: '', sortOrder: 1 }, [item], costs, { ...DEFAULT_INGECART_POLICY, ...offer.cost_policy });
    expect(summary.totalCostWithPolicy).toBeCloseTo(4776.44, 2);
    expect(offer.project_description).toContain('no incluye mantenimiento anual');
    expect(offer.project_description).toContain('copia de seguridad existente');
  });

  it('has a real public DOCX ZIP asset rather than a Windows-path-only reference', () => {
    const href = offer.document_paths[0];
    expect(href).toBe('/offer-documents/OFF-2026-S138_SAICA_Reposicion_PC_Industrial_Rev3.docx');
    const bytes = readFileSync(`${process.cwd()}/public${href}`);
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('retains unspecified commercial terms through snake-case and camel-case hydration', () => {
    const hydrated = hydrateCommercialTerms(terms);
    expect(hydrated).toMatchObject({ equipmentIncoterm: '', incotermLocation: '', deliveryMonths: 0, validityDays: 0, warrantyMonths: 0, paymentMilestones: [] });
    expect(hydrated.deliveryNotes).toMatch(/2 a 3 semanas.*disponibilidad de hardware/);
    expect(hydrateCommercialTerms(hydrated)).toEqual(hydrated);
    expect(hydrateCommercialTerms(null)).toEqual(buildDefaultCommercialTerms());
  });

  it('hydrates a fresh company, remaps ownership and keeps all previous pack offers', async () => {
    await recover();
    expect(read('offers')).toHaveLength(pack.workspace.offers.length);
    expect(read('offers').find((row: any) => row.id === offer.id).company_id).toBe(companyId);
    expect(read('offer_items').find((row: any) => row.id === item.id)).toEqual(item);
    expect(read('cost_breakdowns').filter((row: any) => row.offer_item_id === item.id)).toEqual(costs);
  });

  it('adds only the missing offer bundle to existing tables and stays byte-identical on reopening', async () => {
    seedExisting();
    await recover();
    expect(read('offers')).toHaveLength(2);
    expect(read('offers')[0]).toEqual(savedOffer);
    expect(read('offer_items')).toHaveLength(2);
    expect(read('offer_items')[0].description).toBe('Keep me');
    expect(read('cost_breakdowns')).toHaveLength(3);
    expect(read('cost_breakdowns')[0].total_cost).toBe(77);
    const snapshot = { ...localStorage };
    await recover();
    expect({ ...localStorage }).toEqual(snapshot);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('never overwrites a same-number browser offer or injects orphan Rev3 rows', async () => {
    seedExisting();
    const edited = { id: 'local_5fafac4d-16e3-48b0-b46b-180bd892940e', offer_number: ' off-2026-s138 ', contract_value: 7502, title: 'Keep existing edits' };
    localStorage.setItem(key('offers'), JSON.stringify([savedOffer, edited]));
    // Missing core forces a pack fetch even though this offer already exists.
    localStorage.removeItem(`acs_tasks_${companyId}`);
    await recover();
    expect(read('offers')).toEqual([savedOffer, edited]);
    expect(read('offer_items').some((row: any) => row.id === item.id)).toBe(false);
    expect(read('offer_scenarios')).toEqual([]);
    expect(read('offer_commercial_terms')).toEqual([]);
  });

  it.each(['offers', 'offer_items', 'cost_breakdowns', 'offer_packages', 'offer_scenarios', 'offer_commercial_terms'])('honors an explicitly empty %s table without installing a partial bundle', async (table) => {
    seedExisting();
    localStorage.setItem(key(table), '[]');
    await recover();
    expect(localStorage.getItem(key(table))).toBe('[]');
    expect(read('offers').some((row: any) => row.id === offer.id)).toBe(false);
    expect(read('offer_items').some((row: any) => row.id === item.id)).toBe(false);
  });

  it('honors disabled recovery and other companies without fetching', async () => {
    seedExisting();
    localStorage.setItem(`acs_ingecart_recovery_disabled_${companyId}`, 'true');
    await recover();
    await recoverMissingIngecartData('other', 'Other company');
    expect(fetch).not.toHaveBeenCalled();
    expect(read('offers')).toEqual([savedOffer]);
  });

  it('rechecks edits and disabled recovery made while fetching', async () => {
    seedExisting();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      localStorage.setItem(key('offers'), JSON.stringify([{ ...offer, id: 'user-id', contract_value: 6000 }]));
      return { ok: true, json: async () => pack };
    }));
    await recover();
    expect(read('offers')).toEqual([{ ...offer, id: 'user-id', contract_value: 6000 }]);
    expect(read('offer_items')).toHaveLength(1);
    localStorage.setItem(key('offers'), JSON.stringify([savedOffer]));
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      localStorage.setItem(`acs_ingecart_recovery_disabled_${companyId}`, 'true');
      return { ok: true, json: async () => pack };
    }));
    await recover();
    expect(read('offers')).toEqual([savedOffer]);
  });

  it('refuses colliding child IDs rather than mixing another offer costs', async () => {
    seedExisting();
    localStorage.setItem(key('offer_items'), JSON.stringify([{ id: item.id, offer_id: savedOffer.id }]));
    await recover();
    expect(read('offers')).toEqual([savedOffer]);
    expect(read('cost_breakdowns')).toHaveLength(1);
  });

  it('rolls back modified and inserted keys on a storage failure', async () => {
    seedExisting();
    const snapshot = { ...localStorage };
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
      if (name === key('cost_breakdowns')) throw new Error('Quota exceeded');
      original.call(this, name, value);
    });
    await expect(recover()).rejects.toThrow('Quota exceeded');
    expect({ ...localStorage }).toEqual(snapshot);
  });

  it('fails explicitly on malformed existing tables or HTTP failure', async () => {
    seedExisting();
    localStorage.setItem(key('offer_items'), '{"not":"an array"}');
    await expect(recover()).rejects.toThrow('lista válida');
    expect(read('offers')).toEqual([savedOffer]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(recover()).rejects.toThrow('HTTP 503');
  });
});