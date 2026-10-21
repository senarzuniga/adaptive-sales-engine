const normalizeKamText = (value: string) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const LINETEX_OWNER_ALIASES = [
  'linetex',
  'linetes',
  'lientex',
  'line text',
  'line tex',
  'rapidbond',
  'rapid bond',
  'mike kocherga',
  'christian kocherga',
  'carlos perez',
];

const HERIBERTO_OWNER_ALIASES = ['heriberto'];
const INGECART_OWNER_ALIASES = ['ingecart'];

const LINETEX_ACCOUNT_HINTS = [
  'rapidbond',
  'rapid bond',
  'cartogua',
  'cascades',
  'copak',
  'kelly box',
  'president container',
  'sigmaq',
  'international paper',
  'ip ',
];

const normalizeCountryRegion = (country: string, region: string) => normalizeKamText(`${country} ${region}`);

const isMexicoContext = (country: string, region: string) => {
  const normalized = normalizeCountryRegion(country, region);
  return normalized.includes('mexico') || normalized.includes('mex');
};

const isUsaOrLatamContext = (country: string, region: string) => {
  const normalized = normalizeCountryRegion(country, region);
  return (
    normalized.includes('usa')
    || normalized.includes('united states')
    || normalized.includes('latam')
    || normalized.includes('latin america')
  );
};

export const canonicalizeKamOwner = (value: string): string => {
  const clean = String(value || '').trim();
  if (!clean) return '';
  const normalized = normalizeKamText(clean);
  if (LINETEX_OWNER_ALIASES.some((alias) => normalized.includes(alias))) return 'Linetex';
  if (HERIBERTO_OWNER_ALIASES.some((alias) => normalized.includes(alias))) return 'Heriberto';
  if (INGECART_OWNER_ALIASES.some((alias) => normalized.includes(alias))) return 'Ingecart';
  return clean;
};

export const inferKamOwner = (params: {
  existingKam?: string;
  customerName?: string;
  country?: string;
  region?: string;
  fallbackKam?: string;
}): string => {
  const normalizedExisting = canonicalizeKamOwner(params.existingKam || '');
  if (normalizedExisting) return normalizedExisting;

  const customer = normalizeKamText(params.customerName || '');
  if (LINETEX_ACCOUNT_HINTS.some((hint) => customer.includes(hint))) return 'Linetex';

  if (isMexicoContext(params.country || '', params.region || '')) return 'Heriberto';
  if (isUsaOrLatamContext(params.country || '', params.region || '')) return 'Linetex';

  return canonicalizeKamOwner(params.fallbackKam || '') || (params.fallbackKam || 'Ingecart');
};
