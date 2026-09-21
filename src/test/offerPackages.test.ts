import { describe, expect, it } from 'vitest';
import {
  buildDefaultCommercialTerms,
  buildDeliveryTermsText,
  buildEquipmentIncotermText,
  buildPackageExecutiveDetail,
  buildPaymentTermsText,
  buildWarrantyTermsText,
  calculatePackageDirectCost,
  createOfferPackage,
  isInstallationPackage,
  resizePaymentMilestones,
  summarizePackageCostWithPolicy,
} from '@/lib/offerPackages';

describe('offerPackages helpers', () => {
  it('builds Ingecart commercial wording defaults', () => {
    const terms = buildDefaultCommercialTerms();
    expect(buildEquipmentIncotermText(terms)).toContain('EXW Barcelona, Spain');
    expect(buildPaymentTermsText(terms)).toContain('30% by bank transfer with the purchase order');
    expect(buildDeliveryTermsText(terms)).toContain('8 months');
    expect(buildWarrantyTermsText(terms)).toContain('12 months from commissioning');
  });

  it('resizes payment milestones while preserving existing entries', () => {
    const current = buildDefaultCommercialTerms().paymentMilestones;
    const resized = resizePaymentMilestones(2, current);
    expect(resized).toHaveLength(2);
    expect(resized[0].percentage).toBe(30);
  });

  it('computes package cost and injects installation notes when needed', () => {
    const pkg = createOfferPackage(1);
    pkg.name = 'Installation package';
    pkg.type = 'installation';
    pkg.itemIds = ['item-1'];
    pkg.commercialPrice = 25000;

    const items = [{ id: 'item-1', name: 'Commissioning', description: 'Site services', quantity: 1 }];
    const costRows = [
      { offer_item_id: 'item-1', category: 'installation', line_item: 'Labour', total_cost: 12000 },
      { offer_item_id: 'item-1', category: 'transport', line_item: 'Flights and hotel', total_cost: 3000 },
    ];

    expect(calculatePackageDirectCost(pkg, items, costRows)).toBe(15000);
    expect(isInstallationPackage(pkg, costRows)).toBe(true);
    expect(buildPackageExecutiveDetail(pkg, items, costRows)).toContain('Associated costs include the hotel');
  });

  it('adds policy charges to package cost and margins can be computed over proposed price', () => {
    const pkg = createOfferPackage(1);
    pkg.type = 'optional';
    pkg.itemIds = ['item-1'];
    pkg.commercialPrice = 90000;

    const items = [{ id: 'item-1', name: 'Mesa 90 grados', description: 'Mesa desplazamiento y giro', quantity: 1 }];
    const costRows = [
      { offer_item_id: 'item-1', category: 'materials', total_cost: 30000 },
      { offer_item_id: 'item-1', category: 'engineering', total_cost: 12000 },
      { offer_item_id: 'item-1', category: 'subcontracting', total_cost: 6000 },
      { offer_item_id: 'item-1', category: 'installation', total_cost: 3000 },
      { offer_item_id: 'item-1', category: 'transport', total_cost: 900 },
    ];

    const summary = summarizePackageCostWithPolicy(pkg, items, costRows);
    expect(summary.directCost).toBe(51900);
    expect(summary.policyCharges.warranty).toBeCloseTo(1920, 2);
    expect(summary.policyCharges.materialStructure).toBeCloseTo(4500, 2);
    expect(summary.policyCharges.financial).toBeCloseTo(1038, 2);
    expect(summary.policyCharges.commercialMgmt).toBeCloseTo(1816.5, 2);
    expect(summary.totalCostWithPolicy).toBeCloseTo(61174.5, 2);

    const margin = pkg.commercialPrice - summary.totalCostWithPolicy;
    const marginPct = margin / pkg.commercialPrice * 100;
    expect(margin).toBeCloseTo(28825.5, 2);
    expect(marginPct).toBeCloseTo(32.03, 2);
  });
});
