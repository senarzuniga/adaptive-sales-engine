import type { ContactRecord, LeadRecord, OpportunityRecord, OrderRecord, ProductRecord, StrategyRecord } from '@/store/DataStore';

export interface EntityCompany {
  id: string;
  name: string;
  normalizedName: string;
  region?: string;
  country?: string;
  sector?: string;
  kam?: string;
  sources: string[];
  linkedContactIds: string[];
}

export interface EntityCustomer {
  id: string;
  name: string;
  normalizedName: string;
  companyId?: string;
  region?: string;
  country?: string;
  kam?: string;
  sources: string[];
}

export interface EntityProduct {
  id: string;
  name: string;
  normalizedName: string;
  type?: string;
  averageValue?: number;
  sources: string[];
}

export interface EntityContact {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  companyId?: string;
  sources: string[];
}

export interface NormalizedEntityRegistries {
  companies: Record<string, EntityCompany>;
  customers: Record<string, EntityCustomer>;
  products: Record<string, EntityProduct>;
  contacts: Record<string, EntityContact>;
}

export interface DatasetQualityReport {
  dataset: 'orders' | 'opportunities' | 'products' | 'strategy' | 'leads' | 'contacts';
  rowCount: number;
  nullPercentage: number;
  issues: string[];
}

export interface DataManagementInput {
  orders: OrderRecord[];
  opportunities: OpportunityRecord[];
  products: ProductRecord[];
  strategy: StrategyRecord[];
  leads: LeadRecord[];
  contacts: ContactRecord[];
}

export interface DataManagementResult {
  registries: NormalizedEntityRegistries;
  quality: DatasetQualityReport[];
}

const EMPTY_REGISTRY: NormalizedEntityRegistries = {
  companies: {},
  customers: {},
  products: {},
  contacts: {},
};

const clean = (value?: string) => (value || '').trim();
const normalize = (value?: string) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const hashId = (prefix: string, value: string) => {
  const raw = normalize(value);
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `${prefix}_${(hash >>> 0).toString(16)}`;
};

const mergeString = (current?: string, incoming?: string) => {
  const c = clean(current);
  const i = clean(incoming);
  if (!c && i) return i;
  if (c && i && i.length > c.length) return i;
  return c;
};

const mergeSource = (existing: string[], source: string) => (existing.includes(source) ? existing : [...existing, source]);

const upsertCompany = (
  companies: Record<string, EntityCompany>,
  companyName: string,
  source: string,
  payload: Partial<EntityCompany> = {},
) => {
  const name = clean(companyName);
  if (!name) return undefined;
  const id = hashId('cmp', name);
  const prev = companies[id];
  companies[id] = {
    id,
    name: mergeString(prev?.name, name) || name,
    normalizedName: normalize(name),
    region: mergeString(prev?.region, payload.region),
    country: mergeString(prev?.country, payload.country),
    sector: mergeString(prev?.sector, payload.sector),
    kam: mergeString(prev?.kam, payload.kam),
    linkedContactIds: [...new Set([...(prev?.linkedContactIds || []), ...(payload.linkedContactIds || [])])],
    sources: mergeSource(prev?.sources || [], source),
  };
  return id;
};

const upsertCustomer = (
  customers: Record<string, EntityCustomer>,
  customerName: string,
  source: string,
  payload: Partial<EntityCustomer> = {},
) => {
  const name = clean(customerName);
  if (!name) return;
  const id = hashId('cus', name);
  const prev = customers[id];
  customers[id] = {
    id,
    name: mergeString(prev?.name, name) || name,
    normalizedName: normalize(name),
    companyId: payload.companyId || prev?.companyId,
    region: mergeString(prev?.region, payload.region),
    country: mergeString(prev?.country, payload.country),
    kam: mergeString(prev?.kam, payload.kam),
    sources: mergeSource(prev?.sources || [], source),
  };
};

const upsertProduct = (
  products: Record<string, EntityProduct>,
  productName: string,
  source: string,
  payload: Partial<EntityProduct> = {},
) => {
  const name = clean(productName);
  if (!name) return;
  const id = hashId('prd', name);
  const prev = products[id];
  products[id] = {
    id,
    name: mergeString(prev?.name, name) || name,
    normalizedName: normalize(name),
    type: mergeString(prev?.type, payload.type),
    averageValue: payload.averageValue ?? prev?.averageValue,
    sources: mergeSource(prev?.sources || [], source),
  };
};

const upsertContact = (
  contacts: Record<string, EntityContact>,
  payload: Partial<EntityContact>,
  source: string,
) => {
  const key = clean(payload.email) || clean(payload.name);
  if (!key) return undefined;
  const id = hashId('ctc', key);
  const prev = contacts[id];
  contacts[id] = {
    id,
    name: mergeString(prev?.name, payload.name),
    email: mergeString(prev?.email, payload.email),
    phone: mergeString(prev?.phone, payload.phone),
    role: mergeString(prev?.role, payload.role),
    department: mergeString(prev?.department, payload.department),
    companyId: payload.companyId || prev?.companyId,
    sources: mergeSource(prev?.sources || [], source),
  };
  return id;
};

const qualityForDataset = <T extends Record<string, unknown>>(
  dataset: DatasetQualityReport['dataset'],
  rows: T[],
  requiredFields: string[],
  getPrimary: (row: T) => string,
): DatasetQualityReport => {
  if (rows.length === 0) return { dataset, rowCount: 0, nullPercentage: 0, issues: ['No rows loaded'] };

  let nulls = 0;
  const totalCells = rows.length * Math.max(requiredFields.length, 1);
  const issues: string[] = [];
  const seen = new Set<string>();

  rows.forEach((row) => {
    requiredFields.forEach((field) => {
      const value = row[field];
      if (value === null || value === undefined || clean(String(value)) === '') nulls += 1;
    });

    const primary = normalize(getPrimary(row));
    if (!primary) issues.push('Rows with missing primary identifier detected');
    if (primary) {
      if (seen.has(primary)) issues.push(`Duplicate primary identifier: ${getPrimary(row)}`);
      seen.add(primary);
    }
  });

  return {
    dataset,
    rowCount: rows.length,
    nullPercentage: Number(((nulls / totalCells) * 100).toFixed(2)),
    issues: [...new Set(issues)],
  };
};

export function runDataManagementAgent(input: DataManagementInput): DataManagementResult {
  const registries: NormalizedEntityRegistries = structuredClone(EMPTY_REGISTRY);

  input.orders.forEach((row) => {
    const companyId = upsertCompany(registries.companies, row.customerName, 'orders', {
      region: row.region,
      country: row.country,
      kam: row.kam,
    });
    upsertCustomer(registries.customers, row.customerName, 'orders', {
      companyId,
      region: row.region,
      country: row.country,
      kam: row.kam,
    });
    upsertProduct(registries.products, row.productFamily, 'orders');
  });

  input.opportunities.forEach((row) => {
    const companyId = upsertCompany(registries.companies, row.customerName, 'opportunities', {
      region: row.region,
      country: row.country,
      kam: row.kam,
    });
    upsertCustomer(registries.customers, row.customerName, 'opportunities', {
      companyId,
      region: row.region,
      country: row.country,
      kam: row.kam,
    });
    upsertProduct(registries.products, row.productFamily, 'opportunities');
    const contactId = upsertContact(
      registries.contacts,
      {
        name: row.contact,
        companyId,
      },
      'opportunities',
    );
    if (companyId && contactId) {
      const company = registries.companies[companyId];
      company.linkedContactIds = [...new Set([...(company.linkedContactIds || []), contactId])];
    }
  });

  input.products.forEach((row) => {
    upsertProduct(registries.products, row.name, 'products', {
      type: row.type,
      averageValue: row.averageValue,
    });
  });

  input.strategy.forEach((row) => {
    upsertProduct(registries.products, row.productFamily, 'strategy');
  });

  input.leads.forEach((row) => {
    const companyId = upsertCompany(registries.companies, row.companyName, 'leads', {
      region: row.region,
      country: row.country,
      sector: row.sector,
      kam: row.owner,
    });
    upsertCustomer(registries.customers, row.companyName, 'leads', {
      companyId,
      region: row.region,
      country: row.country,
      kam: row.owner,
    });
    const contactId = upsertContact(
      registries.contacts,
      {
        name: row.leadName,
        email: row.email,
        phone: row.phone,
        companyId,
      },
      'leads',
    );
    if (companyId && contactId) {
      const company = registries.companies[companyId];
      company.linkedContactIds = [...new Set([...(company.linkedContactIds || []), contactId])];
    }
  });

  input.contacts.forEach((row) => {
    const companyId = upsertCompany(registries.companies, row.companyName, 'contacts', {
      region: row.region,
      country: row.country,
      kam: row.kam,
    });
    const contactId = upsertContact(
      registries.contacts,
      {
        name: row.name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        department: row.department,
        companyId,
      },
      'contacts',
    );
    if (companyId && contactId) {
      const company = registries.companies[companyId];
      company.linkedContactIds = [...new Set([...(company.linkedContactIds || []), contactId])];
    }
  });

  const quality: DatasetQualityReport[] = [
    qualityForDataset('orders', input.orders as unknown as Record<string, unknown>[], ['customerName', 'productFamily', 'sellingPrice'], (r) => String(r.customerName || '')),
    qualityForDataset('opportunities', input.opportunities as unknown as Record<string, unknown>[], ['customerName', 'status', 'estRevenue'], (r) => String(r.oppNumber || r.customerName || '')),
    qualityForDataset('products', input.products as unknown as Record<string, unknown>[], ['name', 'averageValue'], (r) => String(r.name || '')),
    qualityForDataset('strategy', input.strategy as unknown as Record<string, unknown>[], ['productFamily', 'estRevenue'], (r) => String(r.productFamily || '')),
    qualityForDataset('leads', input.leads as unknown as Record<string, unknown>[], ['companyName', 'leadName'], (r) => String(r.email || r.leadName || '')),
    qualityForDataset('contacts', input.contacts as unknown as Record<string, unknown>[], ['companyName', 'name'], (r) => String(r.email || r.name || '')),
  ];

  return { registries, quality };
}
