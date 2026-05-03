import type { CatalogProduct } from '@/components/ProductForm';
import type { ProductRecord } from '@/store/DataStore';

/**
 * Merges uploaded ProductRecords with manually added CatalogProducts,
 * deduplicating by name and returning a unified catalog array.
 */
export function buildProductCatalog(
  uploadedProducts: ProductRecord[],
  manualProducts: CatalogProduct[],
): CatalogProduct[] {
  const seen = new Set<string>();
  const result: CatalogProduct[] = [];

  for (const p of uploadedProducts) {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const attributes = (p.attributes || {}) as Record<string, unknown>;
    const attachmentInfo = attributes.attachment_info as CatalogProduct['attachmentInfo'];
    result.push({
      id: `upload_${key}`,
      name: p.name,
      sku: p.sku || '',
      category: p.category || '',
      description: p.description || '',
      currency: p.currency || 'EUR',
      quoteReference: String(attributes.ref_quote || ''),
      poReference: String(attributes.ref_po || ''),
      attachmentInfo,
      attributes,
      type: p.type,
      averageValue: p.averageValue,
      sellingPrice: p.sellingPrice ?? p.averageValue,
      unitCost: p.unitCost ?? 0,
      stockQuantity: p.stockQuantity ?? 0,
      status: p.status || 'active',
      comments: p.comments,
    });
  }

  for (const p of manualProducts) {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(p);
  }

  return result;
}

/**
 * Returns a summary string for the product catalog.
 */
export function describeProductCatalog(catalog: CatalogProduct[]): string {
  if (catalog.length === 0) return 'No products in the catalog.';
  const byType: Record<string, number> = {};
  for (const p of catalog) {
    byType[p.type] = (byType[p.type] || 0) + 1;
  }
  const breakdown = Object.entries(byType)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');
  return `Catalog contains ${catalog.length} products: ${breakdown}.`;
}
