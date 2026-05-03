import type { GoaDataSnapshot, GoaPanelContext, GoaProposedChange } from '@/agents/goa/types';

export interface EnrichmentAgentResult {
  updatedData: GoaDataSnapshot;
  changes: GoaProposedChange[];
  confidence: number;
}

const cloneSnapshot = (snapshot: GoaDataSnapshot): GoaDataSnapshot => ({
  orders: snapshot.orders.map((order) => ({ ...order })),
  opportunities: snapshot.opportunities.map((opportunity) => ({ ...opportunity })),
  products: snapshot.products.map((product) => ({ ...product })),
  strategy: snapshot.strategy.map((strategy) => ({ ...strategy })),
  leads: snapshot.leads.map((lead) => ({ ...lead })),
  contacts: snapshot.contacts.map((contact) => ({ ...contact })),
  companyProfile: { ...snapshot.companyProfile },
});

export function runDataEnrichmentAgent(input: {
  context: GoaPanelContext;
  prompt: string;
  data: GoaDataSnapshot;
}): EnrichmentAgentResult {
  const updatedData = cloneSnapshot(input.data);
  const changes: GoaProposedChange[] = [];

  const prompt = input.prompt.toLowerCase();
  const wantsFill = /fill|enrich|complete|link|infer|autofill/i.test(prompt);

  if (wantsFill) {
    const regionByCustomer = new Map<string, string>();
    updatedData.orders.forEach((order) => {
      if (order.customerName && order.region) regionByCustomer.set(order.customerName.toLowerCase(), order.region);
    });

    updatedData.opportunities = updatedData.opportunities.map((opportunity, index) => {
      if (!opportunity.region?.trim() && opportunity.customerName) {
        const region = regionByCustomer.get(opportunity.customerName.toLowerCase());
        if (region) {
          const enriched = { ...opportunity, region };
          changes.push({
            dataset: 'opportunities',
            description: `Linked region from historical orders for opportunity row ${index + 1}.`,
            before: { region: opportunity.region, customerName: opportunity.customerName },
            after: { region: enriched.region, customerName: enriched.customerName },
          });
          return enriched;
        }
      }
      return opportunity;
    });

    const emailDomainByCompany = new Map<string, string>();
    updatedData.contacts.forEach((contact) => {
      if (contact.companyName && contact.email?.includes('@')) {
        const domain = contact.email.split('@')[1]?.trim();
        if (domain) emailDomainByCompany.set(contact.companyName.toLowerCase(), domain);
      }
    });

    updatedData.leads = updatedData.leads.map((lead, index) => {
      if (!lead.email?.trim() && lead.companyName) {
        const domain = emailDomainByCompany.get(lead.companyName.toLowerCase());
        if (domain) {
          const normalizedLeadName = lead.leadName?.trim().toLowerCase().replace(/\s+/g, '.');
          if (normalizedLeadName) {
            const enriched = { ...lead, email: `${normalizedLeadName}@${domain}` };
            changes.push({
              dataset: 'leads',
              description: `Generated lead email from known company domain on row ${index + 1}.`,
              before: { email: lead.email, leadName: lead.leadName },
              after: { email: enriched.email, leadName: enriched.leadName },
            });
            return enriched;
          }
        }
      }
      return lead;
    });
  }

  return {
    updatedData,
    changes,
    confidence: changes.length > 0 ? 0.8 : 0.6,
  };
}
