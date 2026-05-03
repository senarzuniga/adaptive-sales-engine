import type { DataManagementInput } from './dataManagementAgent';
import type { IngestionContradiction } from './dataManagementAgent';

export interface NumericVerification {
  entityHash: string;
  entityName: string;
  fieldName: 'revenue' | 'employee_count';
  docValueA?: number;
  docValueB?: number;
  externalValue?: number;
  externalSource: 'clearbit' | 'hunter' | 'opencorporates' | 'none';
  confidenceScore: number;
  lowConfidence: boolean;
}

export interface TextEquivalenceCheck {
  entityHash: string;
  entityName: string;
  fieldName: 'company_name' | 'industry_code';
  valueA: string;
  valueB: string;
  equivalent: boolean;
  judgePrompt: string;
}

export interface DoubleCheckAgentInput extends DataManagementInput {
  contradictions: IngestionContradiction[];
}

export interface DoubleCheckAgentResult {
  verifications: NumericVerification[];
  textChecks: TextEquivalenceCheck[];
  forcedContradictions: IngestionContradiction[];
}

const clean = (value?: string) => (value || '').trim();
const normalize = (value?: string) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const randomId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `dc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const hashCompany = (company: string) => `cmp_${normalize(company) || 'unknown'}`;

const equivalentCompanyName = (a: string, b: string) => {
  const aa = normalize(a).replace(/(inc|llc|ltd|sa|corp|corporation)$/g, '');
  const bb = normalize(b).replace(/(inc|llc|ltd|sa|corp|corporation)$/g, '');
  return !!aa && aa === bb;
};

async function getExternalNumericSignal(entityName: string, fieldName: 'revenue' | 'employee_count'): Promise<{ value?: number; source: NumericVerification['externalSource']; confidence: number }> {
  const token = import.meta.env.VITE_OPENCORPORATES_API_TOKEN as string | undefined;
  if (!token) return { value: undefined, source: 'none', confidence: 0.35 };

  try {
    const query = encodeURIComponent(entityName);
    const url = `https://api.opencorporates.com/v0.4/companies/search?q=${query}&api_token=${encodeURIComponent(token)}`;
    const response = await fetch(url);
    if (!response.ok) return { value: undefined, source: 'opencorporates', confidence: 0.45 };

    const json = await response.json();
    const company = json?.results?.companies?.[0]?.company;
    if (!company) return { value: undefined, source: 'opencorporates', confidence: 0.45 };

    const revenue = Number(company?.latest_accounts?.turnover || company?.current_assets || 0);
    const employees = Number(company?.number_of_employees || 0);
    const value = fieldName === 'revenue' ? revenue : employees;

    return { value: Number.isFinite(value) && value > 0 ? value : undefined, source: 'opencorporates', confidence: 0.72 };
  } catch {
    return { value: undefined, source: 'opencorporates', confidence: 0.4 };
  }
}

export async function runDoubleCheckAgent(input: DoubleCheckAgentInput): Promise<DoubleCheckAgentResult> {
  const forcedContradictions: IngestionContradiction[] = [];
  const textChecks: TextEquivalenceCheck[] = [];

  const companyNames = [...new Set([
    ...input.orders.map((row) => clean(row.customerName)),
    ...input.opportunities.map((row) => clean(row.customerName)),
    ...input.leads.map((row) => clean(row.companyName)),
    ...input.contacts.map((row) => clean(row.companyName)),
  ].filter(Boolean))];

  const verifications = await Promise.all(companyNames.map(async (companyName) => {
    const entityHash = hashCompany(companyName);

    const orderRevenue = input.orders
      .filter((row) => normalize(row.customerName) === normalize(companyName))
      .reduce((sum, row) => sum + (row.sellingPrice || 0), 0);

    const oppRevenue = input.opportunities
      .filter((row) => normalize(row.customerName) === normalize(companyName))
      .reduce((sum, row) => sum + (row.estRevenue || 0), 0);

    const leadRevenue = input.leads
      .filter((row) => normalize(row.companyName) === normalize(companyName))
      .reduce((sum, row) => sum + (row.estimatedValue || 0), 0);

    const employeeValues = input.leads
      .filter((row) => normalize(row.companyName) === normalize(companyName))
      .map((row) => Number((row as unknown as Record<string, unknown>).employeeCount || (row as unknown as Record<string, unknown>).employee_count || 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    const revenueDocA = orderRevenue || undefined;
    const revenueDocB = oppRevenue || leadRevenue || undefined;
    const employeeDocA = employeeValues[0];
    const employeeDocB = employeeValues[1];

    const [externalRevenue, externalEmployees] = await Promise.all([
      getExternalNumericSignal(companyName, 'revenue'),
      getExternalNumericSignal(companyName, 'employee_count'),
    ]);

    const revenueMismatch = externalRevenue.value && revenueDocA
      ? Math.abs(externalRevenue.value - revenueDocA) / Math.max(1, revenueDocA) > 0.2
      : false;

    const employeeMismatch = externalEmployees.value && employeeDocA
      ? Math.abs(externalEmployees.value - employeeDocA) / Math.max(1, employeeDocA) > 0.2
      : false;

    if (revenueMismatch && revenueDocA && externalRevenue.value) {
      forcedContradictions.push({
        id: randomId(),
        entity_hash: entityHash,
        entity_name: companyName,
        field_name: 'revenue',
        value_a: String(revenueDocA),
        value_b: String(externalRevenue.value),
        source_a: 'document-A',
        source_b: externalRevenue.source,
        source_doc_ids: ['document-A', externalRevenue.source],
        status: 'pending',
        timestamp: new Date().toISOString(),
        low_confidence: true,
        confidence_score: externalRevenue.confidence,
      });
    }

    if (employeeMismatch && employeeDocA && externalEmployees.value) {
      forcedContradictions.push({
        id: randomId(),
        entity_hash: entityHash,
        entity_name: companyName,
        field_name: 'employee_count',
        value_a: String(employeeDocA),
        value_b: String(externalEmployees.value),
        source_a: 'document-A',
        source_b: externalEmployees.source,
        source_doc_ids: ['document-A', externalEmployees.source],
        status: 'pending',
        timestamp: new Date().toISOString(),
        low_confidence: true,
        confidence_score: externalEmployees.confidence,
      });
    }

    return [
      {
        entityHash,
        entityName: companyName,
        fieldName: 'revenue' as const,
        docValueA: revenueDocA,
        docValueB: revenueDocB,
        externalValue: externalRevenue.value,
        externalSource: externalRevenue.source,
        confidenceScore: externalRevenue.confidence,
        lowConfidence: revenueMismatch,
      },
      {
        entityHash,
        entityName: companyName,
        fieldName: 'employee_count' as const,
        docValueA: employeeDocA,
        docValueB: employeeDocB,
        externalValue: externalEmployees.value,
        externalSource: externalEmployees.source,
        confidenceScore: externalEmployees.confidence,
        lowConfidence: employeeMismatch,
      },
    ] as NumericVerification[];
  }));

  input.contradictions
    .filter((item) => item.field_name === 'company_name' || item.field_name === 'industry_code')
    .forEach((item) => {
      const equivalent = equivalentCompanyName(item.value_a, item.value_b);
      textChecks.push({
        entityHash: item.entity_hash,
        entityName: item.entity_name,
        fieldName: item.field_name,
        valueA: item.value_a,
        valueB: item.value_b,
        equivalent,
        judgePrompt: 'Are these two values semantically equivalent?',
      });
    });

  const nonEquivalentRows = textChecks
    .filter((item) => !item.equivalent)
    .map((item) => ({
      id: randomId(),
      entity_hash: item.entityHash,
      entity_name: item.entityName,
      field_name: item.fieldName,
      value_a: item.valueA,
      value_b: item.valueB,
      source_a: 'document-A',
      source_b: 'document-B',
      source_doc_ids: ['document-A', 'document-B'],
      status: 'pending' as const,
      timestamp: new Date().toISOString(),
      low_confidence: true,
      confidence_score: 0.55,
    }));

  return {
    verifications: verifications.flat(),
    textChecks,
    forcedContradictions: [...forcedContradictions, ...nonEquivalentRows],
  };
}
