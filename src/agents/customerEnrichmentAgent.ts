import type { ContactRecord, LeadRecord, OpportunityRecord, OrderRecord } from '@/store/DataStore';
import type { DataManagementInput, NormalizedEntityRegistries } from './dataManagementAgent';
import { runEliteLoop, type EliteLoopStep } from '@/lib/eliteAgentCore';

export interface EnrichedCompanyProfile {
  id: string;
  companyName: string;
  totalRevenue: number;
  pipelineValue: number;
  orderCount: number;
  averageMargin: number;
  productsPurchased: string[];
  assignedKam: string;
  region: string;
  sector: string;
  linkedContacts: Array<{ name: string; email: string; role: string }>;
  enrichmentScore: number;
  completeness: 'high' | 'medium' | 'low';
}

export interface CustomerEnrichmentInput extends DataManagementInput {
  registries?: NormalizedEntityRegistries;
}

export interface CustomerEnrichmentResult {
  profiles: EnrichedCompanyProfile[];
}

export interface CustomerEnrichmentEliteResult extends CustomerEnrichmentResult {
  loop: EliteLoopStep<{ profiles: number }>;
}

const clean = (value?: string) => (value || '').trim();
const normalize = (value?: string) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const profileId = (companyName: string) => `profile_${normalize(companyName) || 'unknown'}`;

const average = (values: number[]) => (values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0);

const scoreCompleteness = (profile: Omit<EnrichedCompanyProfile, 'enrichmentScore' | 'completeness'>) => {
  const checks = [
    profile.totalRevenue > 0,
    profile.pipelineValue >= 0,
    profile.orderCount > 0,
    profile.averageMargin > 0,
    profile.productsPurchased.length > 0,
    !!profile.assignedKam,
    !!profile.region,
    !!profile.sector,
    profile.linkedContacts.length > 0,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const completeness: EnrichedCompanyProfile['completeness'] = score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low';
  return { score, completeness };
};

const fallbackCompanies = (orders: OrderRecord[], opportunities: OpportunityRecord[], leads: LeadRecord[], contacts: ContactRecord[]) => {
  const names = new Set<string>();
  [...orders.map((r) => r.customerName), ...opportunities.map((r) => r.customerName), ...leads.map((r) => r.companyName), ...contacts.map((r) => r.companyName)]
    .map(clean)
    .filter(Boolean)
    .forEach((n) => names.add(n));
  return [...names];
};

export function runCustomerEnrichmentAgent(input: CustomerEnrichmentInput): CustomerEnrichmentResult {
  const companies = input.registries
    ? Object.values(input.registries.companies).map((company) => company.name)
    : fallbackCompanies(input.orders, input.opportunities, input.leads, input.contacts);

  const profiles = companies.map((companyName) => {
    const companyKey = normalize(companyName);

    const companyOrders = input.orders.filter((row) => normalize(row.customerName) === companyKey);
    const companyOpps = input.opportunities.filter((row) => normalize(row.customerName) === companyKey);
    const companyLeads = input.leads.filter((row) => normalize(row.companyName) === companyKey);
    const companyContacts = input.contacts.filter((row) => normalize(row.companyName) === companyKey);

    const revenue = companyOrders.reduce((sum, row) => sum + (row.sellingPrice || 0), 0);
    const pipelineValue = companyOpps
      .filter((row) => !['won', 'lost'].includes((row.status || '').toLowerCase()))
      .reduce((sum, row) => sum + (row.estRevenue || 0), 0);

    const productsPurchased = [...new Set([...companyOrders.map((row) => clean(row.productFamily)), ...companyOpps.map((row) => clean(row.productFamily))].filter(Boolean))];
    const kamCandidates = [...companyOrders.map((row) => clean(row.kam)), ...companyOpps.map((row) => clean(row.kam)), ...companyLeads.map((row) => clean(row.owner)), ...companyContacts.map((row) => clean(row.kam))].filter(Boolean);
    const kamCounts = kamCandidates.reduce<Record<string, number>>((acc, kam) => {
      acc[kam] = (acc[kam] || 0) + 1;
      return acc;
    }, {});
    const assignedKam = Object.entries(kamCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    const registryCompany = input.registries
      ? Object.values(input.registries.companies).find((company) => normalize(company.name) === companyKey)
      : undefined;

    const region = registryCompany?.region || companyOrders[0]?.region || companyOpps[0]?.region || companyLeads[0]?.region || companyContacts[0]?.region || '';
    const sector = registryCompany?.sector || companyLeads[0]?.sector || '';

    const registryContacts = input.registries
      ? Object.values(input.registries.contacts)
          .filter((contact) => contact.companyId === registryCompany?.id)
          .map((contact) => ({ name: clean(contact.name), email: clean(contact.email), role: clean(contact.role) }))
          .filter((contact) => contact.name || contact.email)
      : [];

    const linkedContacts = registryContacts.length
      ? registryContacts
      : companyContacts
          .map((contact) => ({ name: clean(contact.name), email: clean(contact.email), role: clean(contact.role) }))
          .filter((contact) => contact.name || contact.email);

    const baseProfile = {
      id: profileId(companyName),
      companyName,
      totalRevenue: revenue,
      pipelineValue,
      orderCount: companyOrders.length,
      averageMargin: Number(average(companyOrders.map((row) => row.margin || 0)).toFixed(2)),
      productsPurchased,
      assignedKam,
      region,
      sector,
      linkedContacts,
    };

    const { score, completeness } = scoreCompleteness(baseProfile);

    return {
      ...baseProfile,
      enrichmentScore: score,
      completeness,
    };
  });

  profiles.sort((a, b) => b.enrichmentScore - a.enrichmentScore);
  return { profiles };
}

export function runCustomerEnrichmentEliteAgent(input: CustomerEnrichmentInput): CustomerEnrichmentEliteResult {
  const result = runCustomerEnrichmentAgent(input);
  const avg = result.profiles.length
    ? Number((result.profiles.reduce((s, p) => s + p.enrichmentScore, 0) / result.profiles.length / 100).toFixed(3))
    : 0;

  return {
    ...result,
    loop: runEliteLoop({
      observation: { profiles: result.profiles.length },
      understand: 'Profile completeness and enrichment quality are predictors of targeting performance.',
      hypotheses: [
        'Higher enrichment score yields better account prioritization decisions.',
        'Contact completeness increases conversion probability for event and pipeline plays.',
      ],
      action: 'Generated enriched company profiles and ranked them by enrichment score.',
      expectedOutcome: 0.76,
      realOutcome: avg,
      reason: 'Built unified account views for proactive planning and autonomous recommendations.',
      dataUsed: ['orders', 'opportunities', 'leads', 'contacts', 'entity registries'],
      expectedImpact: 'Improved account strategy, segmentation, and follow-up effectiveness.',
    }),
  };
}
