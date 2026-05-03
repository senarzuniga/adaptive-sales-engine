import type { CatalogProduct } from '@/components/ProductForm';
import type { ProductRecord } from '@/store/DataStore';
import { runEliteLoop, type EliteLoopStep } from '@/lib/eliteAgentCore';

export interface ProductCatalogInput {
  products: ProductRecord[];
  catalogProducts: CatalogProduct[];
}

export interface ProductCatalogEntry {
  id: string;
  name: string;
  type: string;
  averageValue: number;
  comments: string;
  source: 'uploaded' | 'manual';
  lifecycleLabel: 'Innovation' | 'Growth' | 'Core' | 'Commodity';
}

export interface ProductCatalogResult {
  entries: ProductCatalogEntry[];
  totalProducts: number;
  byLifecycle: Record<string, number>;
  summary: string;
}

export interface ProductCatalogEliteResult extends ProductCatalogResult {
  loop: EliteLoopStep<{ products: number }>;
}

function inferLifecycle(type: string, comments: string): ProductCatalogEntry['lifecycleLabel'] {
  const t = type.toLowerCase();
  const c = comments.toLowerCase();
  if (t.includes('innovation') || c.includes('predictive') || c.includes('digital') || c.includes('solution')) return 'Innovation';
  if (t.includes('commodity') || c.includes('standard') || c.includes('replacement')) return 'Commodity';
  if (t.includes('growth') || c.includes('growth') || c.includes('expanding')) return 'Growth';
  return 'Core';
}

export function runProductCatalogAgent(input: ProductCatalogInput): ProductCatalogResult {
  const fromUploaded: ProductCatalogEntry[] = input.products.map((p, i) => ({
    id: `uploaded_${i}_${p.name}`,
    name: p.name,
    type: p.type,
    averageValue: p.averageValue,
    comments: p.comments,
    source: 'uploaded',
    lifecycleLabel: inferLifecycle(p.type, p.comments),
  }));

  const fromManual: ProductCatalogEntry[] = input.catalogProducts.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    averageValue: p.averageValue,
    comments: p.comments,
    source: 'manual',
    lifecycleLabel: inferLifecycle(p.type, p.comments),
  }));

  const seenNames = new Set<string>();
  const entries: ProductCatalogEntry[] = [];

  for (const entry of [...fromUploaded, ...fromManual]) {
    const key = entry.name.trim().toLowerCase();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      entries.push(entry);
    }
  }

  const byLifecycle: Record<string, number> = { Innovation: 0, Growth: 0, Core: 0, Commodity: 0 };
  for (const entry of entries) {
    byLifecycle[entry.lifecycleLabel] = (byLifecycle[entry.lifecycleLabel] || 0) + 1;
  }

  const summary = `Product catalog: ${entries.length} unique products — ${byLifecycle.Innovation} Innovation, ${byLifecycle.Growth} Growth, ${byLifecycle.Core} Core, ${byLifecycle.Commodity} Commodity.`;

  return { entries, totalProducts: entries.length, byLifecycle, summary };
}

export function runProductCatalogEliteAgent(input: ProductCatalogInput): ProductCatalogEliteResult {
  const result = runProductCatalogAgent(input);
  const innovationShare = result.totalProducts ? result.byLifecycle.Innovation / result.totalProducts : 0;
  const growthShare = result.totalProducts ? result.byLifecycle.Growth / result.totalProducts : 0;
  const realOutcome = Number(Math.min(1, innovationShare * 0.6 + growthShare * 0.4 + 0.35).toFixed(3));

  return {
    ...result,
    loop: runEliteLoop({
      observation: { products: result.totalProducts },
      understand: 'Portfolio lifecycle distribution influences strategy and pricing recommendations.',
      hypotheses: [
        'Balanced innovation/core mix improves future pipeline resilience.',
        'Lifecycle classification helps prioritize product go-to-market actions.',
      ],
      action: 'Merged product sources, deduplicated catalog, and classified lifecycle mix.',
      expectedOutcome: 0.72,
      realOutcome,
      reason: 'Prepared product intelligence foundation for strategic and commercial modules.',
      dataUsed: ['uploaded products', 'manual catalog entries', 'product metadata'],
      expectedImpact: 'Better product positioning decisions and more accurate action prioritization.',
    }),
  };
}
