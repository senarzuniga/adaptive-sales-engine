export type ProductCategory = 'product' | 'service';

export interface ProductCatalogMeta {
  category?: ProductCategory;
  characteristics?: string[];
  estimatedCost?: number;
  repositories?: string[];
  validated?: boolean;
  source?: 'manual' | 'generated';
}

const META_TOKEN = '[ASE_CATALOG_META]';

function safeParseMeta(raw: string): ProductCatalogMeta {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as ProductCatalogMeta;
  } catch {
    return {};
  }
}

function cleanList(values?: string[]) {
  return (values || []).map((value) => value.trim()).filter(Boolean);
}

export function parseProductComments(comments?: string | null): { notes: string; meta: ProductCatalogMeta } {
  const raw = (comments || '').trim();
  if (!raw.includes(META_TOKEN)) return { notes: raw, meta: {} };

  const [notesPart, metaPart] = raw.split(META_TOKEN);
  const meta = safeParseMeta(metaPart || '');
  return {
    notes: (notesPart || '').trim(),
    meta: {
      category: meta.category === 'service' ? 'service' : meta.category === 'product' ? 'product' : undefined,
      characteristics: cleanList(meta.characteristics),
      estimatedCost: Number.isFinite(meta.estimatedCost) ? Number(meta.estimatedCost) : undefined,
      repositories: cleanList(meta.repositories),
      validated: Boolean(meta.validated),
      source: meta.source === 'generated' ? 'generated' : meta.source === 'manual' ? 'manual' : undefined,
    },
  };
}

export function serializeProductComments(notes: string, meta: ProductCatalogMeta): string {
  const normalizedMeta: ProductCatalogMeta = {
    category: meta.category,
    characteristics: cleanList(meta.characteristics),
    estimatedCost: Number.isFinite(meta.estimatedCost) ? Number(meta.estimatedCost) : undefined,
    repositories: cleanList(meta.repositories),
    validated: meta.validated ? true : undefined,
    source: meta.source,
  };

  const hasMeta = Boolean(
    normalizedMeta.category ||
    (normalizedMeta.characteristics && normalizedMeta.characteristics.length > 0) ||
    Number.isFinite(normalizedMeta.estimatedCost) ||
    (normalizedMeta.repositories && normalizedMeta.repositories.length > 0) ||
    normalizedMeta.validated ||
    normalizedMeta.source
  );

  if (!hasMeta) return notes.trim();
  return `${notes.trim()}${notes.trim() ? '\n' : ''}${META_TOKEN}${JSON.stringify(normalizedMeta)}`;
}
