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
});
