import type { OpportunityRecord, OrderRecord, ProductRecord } from '@/store/DataStore';

export interface ProductStrategicSignals {
  lifecycleSignal: 'innovative' | 'mature' | 'declining';
  offerModel: 'equipment' | 'services' | 'integrated solutions';
  competitionFocus: 'price' | 'performance' | 'long-term value';
  technologyStage: 'growing' | 'mature' | 'approaching obsolescence';
  scenario: 'consultative selling' | 'efficiency and market coverage' | 'lifecycle value services' | 'repositioning and portfolio transformation';
}

export type ProductCatalogSuggestion = ProductRecord;

const toWords = (value?: string) => (value || '').toLowerCase();

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

export function runProductAnalysisAgent(
  product: Pick<ProductRecord, 'name' | 'type' | 'comments' | 'category' | 'characteristics'>,
): ProductStrategicSignals {
  const text = `${toWords(product.name)} ${toWords(product.type)} ${toWords(product.comments)} ${toWords((product.characteristics || []).join(' '))}`;

  const innovative = includesAny(text, ['innov', 'ai', 'digital', 'predictive', 'advanced', 'new']);
  const declining = includesAny(text, ['obsolete', 'legacy', 'declin', 'phase-out', 'sunset']);
  const serviceModel = product.category === 'service' || includesAny(text, ['service', 'maintenance', 'support', 'contract']);
  const integrated = includesAny(text, ['solution', 'bundle', 'integrated', 'package']) || (serviceModel && includesAny(text, ['equipment', 'hardware', 'machine']));
  const priceDriven = includesAny(text, ['commodity', 'standard', 'discount', 'price']);
  const performanceDriven = includesAny(text, ['performance', 'quality', 'precision', 'speed', 'efficiency']);

  const lifecycleSignal: ProductStrategicSignals['lifecycleSignal'] = declining ? 'declining' : innovative ? 'innovative' : 'mature';
  const offerModel: ProductStrategicSignals['offerModel'] = integrated ? 'integrated solutions' : serviceModel ? 'services' : 'equipment';
  const competitionFocus: ProductStrategicSignals['competitionFocus'] = priceDriven ? 'price' : performanceDriven ? 'performance' : 'long-term value';
  const technologyStage: ProductStrategicSignals['technologyStage'] =
    lifecycleSignal === 'declining' ? 'approaching obsolescence' : lifecycleSignal === 'innovative' ? 'growing' : 'mature';
  const scenario: ProductStrategicSignals['scenario'] =
    lifecycleSignal === 'innovative'
      ? 'consultative selling'
      : lifecycleSignal === 'declining'
        ? 'repositioning and portfolio transformation'
        : offerModel === 'services'
          ? 'lifecycle value services'
          : 'efficiency and market coverage';

  return { lifecycleSignal, offerModel, competitionFocus, technologyStage, scenario };
}

export function runProductSearchAgent(input: {
  products: ProductRecord[];
  orders: OrderRecord[];
  opportunities: OpportunityRecord[];
}): ProductCatalogSuggestion[] {
  const existing = new Set(input.products.map((product) => product.name.trim().toLowerCase()).filter(Boolean));
  const metrics = new Map<string, { revenue: number; pipeline: number; regions: Set<string> }>();

  input.orders.forEach((order) => {
    const name = order.productFamily.trim();
    if (!name) return;
    const prev = metrics.get(name) || { revenue: 0, pipeline: 0, regions: new Set<string>() };
    prev.revenue += Number(order.sellingPrice || 0);
    if (order.region) prev.regions.add(order.region);
    metrics.set(name, prev);
  });

  input.opportunities.forEach((opportunity) => {
    const name = opportunity.productFamily.trim();
    if (!name) return;
    const prev = metrics.get(name) || { revenue: 0, pipeline: 0, regions: new Set<string>() };
    prev.pipeline += Number(opportunity.estRevenue || 0);
    if (opportunity.region) prev.regions.add(opportunity.region);
    metrics.set(name, prev);
  });

  return Array.from(metrics.entries())
    .filter(([name]) => !existing.has(name.toLowerCase()))
    .sort(([, a], [, b]) => (b.revenue + b.pipeline) - (a.revenue + a.pipeline))
    .slice(0, 8)
    .map(([name, metric]) => {
      const category = includesAny(name.toLowerCase(), ['service', 'support', 'maintenance']) ? 'service' : 'product';
      const estimatedCost = Math.max(0, (metric.revenue + metric.pipeline) / Math.max(1, metric.revenue > 0 ? 12 : 20));
      return {
        name,
        averageValue: Math.round((metric.revenue + metric.pipeline) / Math.max(1, metric.revenue > 0 ? 8 : 14)),
        type: category === 'service' ? 'service model' : 'equipment line',
        category,
        characteristics: [
          category === 'service' ? 'Lifecycle value delivery' : 'Core offer for customer projects',
          metric.pipeline > metric.revenue ? 'Growing demand signal' : 'Commercially established line',
          metric.regions.size > 1 ? `Multi-region presence (${metric.regions.size})` : 'Single-region focus',
        ],
        estimatedCost: Math.round(estimatedCost),
        repositories: ['Internal technical repository', 'Commercial playbook repository'],
        comments: 'Auto-generated by search agent from commercial history. Validate before using in offers.',
        validated: false,
        source: 'generated',
      };
    });
}
