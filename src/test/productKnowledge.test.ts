import { describe, expect, it } from 'vitest';
import { buildSeedProductCatalog, estimateProductPresetCost } from '@/lib/productKnowledge';

describe('product knowledge catalog', () => {
  it('includes the AMR corr area scrap standard profile with Ingecart cost rates', () => {
    const products = buildSeedProductCatalog([]);
    const product = products.find((item) => item.name === 'AMR Corr Area scrap Mng Std');

    expect(product).toBeTruthy();
    expect(product?.estimatedCost).toBe(210136);
    expect(product?.costPreset?.find((line) => line.lineItem === 'Syffise')?.unitCost).toBe(190016);
    expect(product?.costPreset?.find((line) => line.role === 'DIRECTOR ING. ELECTRICA')?.hourlyRate).toBe(85);
    expect(estimateProductPresetCost(product!)).toBe(210136);
  });

  it('adds the validated SR1400 per-meter profile from the workbook model', () => {
    const products = buildSeedProductCatalog([]);
    const sr1400 = products.find((item) => item.name === 'SR1400');
    const sr1400PerMeter = products.find((item) => item.name === 'SR1400 por metro');

    expect(sr1400).toBeTruthy();
    expect(sr1400?.estimatedCost).toBe(55572.9);
    expect(estimateProductPresetCost(sr1400!, 80, false)).toBeCloseTo(55572.9, 2);

    expect(sr1400PerMeter).toBeTruthy();
    expect(sr1400PerMeter?.estimatedCost).toBe(53292.05);
    expect(sr1400PerMeter?.comments).toContain('721.10 EUR/m');
    expect(estimateProductPresetCost(sr1400PerMeter!, 75, false)).toBeCloseTo(53292.05, 2);
    expect(estimateProductPresetCost(sr1400PerMeter!, 50, false)).toBeCloseTo(41887.8, 2);
    expect(estimateProductPresetCost(sr1400PerMeter!, 100, false)).toBeCloseTo(64696.3, 2);
  });
});
