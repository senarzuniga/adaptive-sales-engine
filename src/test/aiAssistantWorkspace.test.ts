import { describe, expect, it } from 'vitest';
import { buildAssistantBridgePrompt, buildAssistantLeadAndContact, buildAssistantOfferDraft, buildAssistantTask, buildBilingualIngecartHtmlReport, inferAssistantDestination, inferAssistantRequestType, parseAssistantFields } from '@/lib/aiAssistantWorkspace';

const companyProfile = {
  company_name: 'Ingecart',
  industry: 'Industrial automation',
} as any;

describe('aiAssistantWorkspace', () => {
  it('infers request types and destinations from free prompts', () => {
    expect(inferAssistantRequestType('Please create an offer for Sigmaq', 'auto')).toBe('offer');
    expect(inferAssistantRequestType('Fix this bug in the application', 'auto')).toBe('application-change');
    expect(inferAssistantDestination('Build a market analysis for LATAM dealers', 'Ingecart', ['Linetex']).destination).toBe('market-intelligence');
    expect(inferAssistantDestination('Prepare account content for Linetex', 'Ingecart', ['Linetex']).destination).toBe('account-content');
  });

  it('parses bilingual field prompts into structured data', () => {
    const parsed = parseAssistantFields('Customer: RapidBond\nContact: Carlos Perez\nEmail: carlos@example.com\nCountry: USA\nTitle: Dealer reactivation\nEstimated value: EUR 125,000');
    expect(parsed.companyName).toBe('RapidBond');
    expect(parsed.contactName).toBe('Carlos Perez');
    expect(parsed.email).toBe('carlos@example.com');
    expect(parsed.country).toBe('USA');
    expect(parsed.estimatedValue).toBeGreaterThan(100000);
  });

  it('builds bilingual html, workspace assets and bridge prompts', () => {
    const html = buildBilingualIngecartHtmlReport({
      title: 'Dealer plan',
      subtitle: 'Commercial activation',
      companyName: 'Ingecart',
      esSummary: 'Resumen',
      enSummary: 'Summary',
      sections: [{ titleEs: 'Objetivo', titleEn: 'Objective', bodyEs: 'Activar dealer', bodyEn: 'Activate dealer' }],
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('data-language="en"');

    const bundle = buildAssistantOfferDraft('Customer: Sigmaq\nTitle: FFG line proposal', 'company-1', 'OFF-2026-138', 'Sigmaq');
    expect(bundle.offer.offer_number).toBe('OFF-2026-138');
    expect(bundle.offer.customer_name).toBe('Sigmaq');
    expect(bundle.commercialTerms.payment_milestones.length).toBeGreaterThan(0);

    const task = buildAssistantTask('Urgent follow-up with Mike at Linetex', 'Linetex');
    expect(task.priority).toBe('critical');
    expect(task.assignee).toBe('AI Assistant');

    const { lead, contact } = buildAssistantLeadAndContact('Customer: RapidBond\nContact: Kristian\nEmail: kristian@example.com', companyProfile);
    expect(lead.companyName).toBe('RapidBond');
    expect(contact.name).toBe('Kristian');

    expect(buildAssistantBridgePrompt('Add an AI route', 'Ingecart')).toContain('Please implement this change in ASE');
  });
});
