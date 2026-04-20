// =============================================================================
// Section Schemas — Strict field dictionaries + validation rules per upload section
//
// RULES:
// - Each section schema is SELF-CONTAINED (only extracts data relevant to its domain)
// - Fields outside the section scope MUST be ignored during extraction
// - Confidence threshold below MIN_CONFIDENCE_TO_STORE → record is rejected
// =============================================================================

export const MIN_CONFIDENCE_TO_STORE = 0.75;

export type FieldType = 'string' | 'number' | 'date' | 'currency' | 'probability' | 'boolean' | 'array' | 'enum';

export interface FieldDefinition {
  type: FieldType;
  required: boolean;
  label: string;
  allowedValues?: string[];
  min?: number;
  max?: number;
  description: string;
}

export interface SectionSchema {
  section: string;
  targetTable: string;
  schemaVersion: string;
  /** Fields this extractor MUST produce */
  fields: Record<string, FieldDefinition>;
  /** Fields from other domains that MUST be ignored */
  ignoreDomains: string[];
  /** Human-readable extraction hint for AI prompts */
  extractionHint: string;
  /** Logical cross-field rules (evaluated as text by the validator) */
  crossFieldRules: Array<{ rule: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Section registry
// ---------------------------------------------------------------------------
export const SECTION_SCHEMAS: Record<string, SectionSchema> = {

  contacts: {
    section: 'contacts',
    targetTable: 'company_contacts',
    schemaVersion: '1.0',
    fields: {
      name:        { type: 'string',      required: true,  label: 'Full Name',            description: 'Contact full name' },
      email:       { type: 'string',      required: false, label: 'Email',                description: 'Contact email address' },
      phone:       { type: 'string',      required: false, label: 'Phone',                description: 'Contact phone number' },
      role:        { type: 'string',      required: false, label: 'Role / Title',         description: 'Job title or role' },
      department:  { type: 'string',      required: false, label: 'Department',           description: 'Department or function' },
      company_name:{ type: 'string',      required: false, label: 'Company',              description: 'Company or organisation' },
      region:      { type: 'string',      required: false, label: 'Region',               description: 'Geographical region' },
      country:     { type: 'string',      required: false, label: 'Country',              description: 'Country' },
      notes:       { type: 'string',      required: false, label: 'Notes',                description: 'Free-form notes' },
    },
    ignoreDomains: ['sales', 'offers', 'strategy', 'finance', 'market', 'competitors'],
    extractionHint: 'Extract ONLY contact person data: names, emails, phones, roles, departments. Ignore revenue, offers, products, or strategy information.',
    crossFieldRules: [
      { rule: 'name || email', message: 'Contact must have at least a name or email' },
    ],
  },

  leads: {
    section: 'leads',
    targetTable: 'company_contacts',
    schemaVersion: '1.0',
    fields: {
      lead_name:       { type: 'string',      required: true,  label: 'Lead Name',           description: 'Name of the lead contact' },
      company_name:    { type: 'string',      required: true,  label: 'Company',             description: 'Lead company' },
      email:           { type: 'string',      required: false, label: 'Email',               description: 'Email address' },
      phone:           { type: 'string',      required: false, label: 'Phone',               description: 'Phone number' },
      region:          { type: 'string',      required: false, label: 'Region',              description: 'Geographical region' },
      country:         { type: 'string',      required: false, label: 'Country',             description: 'Country' },
      sector:          { type: 'string',      required: false, label: 'Sector',              description: 'Industry sector' },
      status:          { type: 'enum',        required: false, label: 'Status',              allowedValues: ['open', 'nurturing', 'qualified', 'lost', 'converted'], description: 'Lead status' },
      source:          { type: 'string',      required: false, label: 'Lead Source',         description: 'How the lead was acquired' },
      owner:           { type: 'string',      required: false, label: 'Owner / KAM',         description: 'Sales rep or KAM owner' },
      estimated_value: { type: 'currency',    required: false, label: 'Estimated Value',     description: 'Estimated deal value', min: 0 },
      notes:           { type: 'string',      required: false, label: 'Notes',               description: 'Free-form notes' },
    },
    ignoreDomains: ['sales', 'offers', 'finance', 'market', 'competitors', 'strategy'],
    extractionHint: 'Extract ONLY lead and prospect data. Do not extract orders, invoices, offers, or financial reports.',
    crossFieldRules: [
      { rule: 'lead_name && company_name', message: 'Lead must have a name and company' },
    ],
  },

  customers: {
    section: 'customers',
    targetTable: 'customers',
    schemaVersion: '1.0',
    fields: {
      customer_name:         { type: 'string',   required: true,  label: 'Customer Name',       description: 'Customer or account name' },
      account_tier:          { type: 'enum',      required: false, label: 'Account Tier',        allowedValues: ['Strategic', 'Key', 'Standard', 'SME', 'Mid', 'Enterprise'], description: 'Account tier' },
      sector:                { type: 'string',   required: false, label: 'Sector',              description: 'Industry sector' },
      operating_region:      { type: 'string',   required: false, label: 'Region',              description: 'Operating region' },
      strategic_importance:  { type: 'number',   required: false, label: 'Strategic Importance', description: 'Score 0-100', min: 0, max: 100 },
      growth_potential:      { type: 'number',   required: false, label: 'Growth Potential',    description: 'Score 0-100', min: 0, max: 100 },
      relationship_strength: { type: 'number',   required: false, label: 'Relationship Strength', description: 'Score 0-100', min: 0, max: 100 },
      notes:                 { type: 'string',   required: false, label: 'Notes',               description: 'Free-form notes' },
    },
    ignoreDomains: ['leads', 'offers', 'sales', 'finance', 'market', 'competitors'],
    extractionHint: 'Extract ONLY customer and account master data. Ignore contacts, offers, orders, and financial figures.',
    crossFieldRules: [
      { rule: 'customer_name', message: 'Customer must have a name' },
    ],
  },

  sales: {
    section: 'sales',
    targetTable: 'orders',
    schemaVersion: '1.0',
    fields: {
      customer_name:      { type: 'string',   required: true,  label: 'Customer Name',     description: 'Customer name on the order' },
      product_family:     { type: 'string',   required: true,  label: 'Product Family',    description: 'Product family or category' },
      po_date:            { type: 'date',     required: false, label: 'PO Date',           description: 'Purchase order date (ISO 8601)' },
      selling_price:      { type: 'currency', required: false, label: 'Selling Price',     description: 'Order selling price', min: 0 },
      margin:             { type: 'currency', required: false, label: 'Margin',            description: 'Order margin value' },
      region:             { type: 'string',   required: false, label: 'Region',            description: 'Geographical region' },
      country:            { type: 'string',   required: false, label: 'Country',           description: 'Country' },
      segment:            { type: 'string',   required: false, label: 'Segment',           description: 'Market segment' },
      kam:                { type: 'string',   required: false, label: 'KAM',               description: 'Key account manager' },
      purchasing_year:    { type: 'string',   required: false, label: 'Purchasing Year',   description: 'Year of purchase' },
      purchasing_quarter: { type: 'string',   required: false, label: 'Purchasing Quarter', description: 'Quarter of purchase' },
      scope:              { type: 'string',   required: false, label: 'Scope',             description: 'Order scope / description' },
    },
    ignoreDomains: ['leads', 'contacts', 'customers', 'offers', 'strategy', 'market', 'competitors'],
    extractionHint: 'Extract ONLY sales order / transaction data: order dates, customers, products, prices, margins. Ignore contact details, offers, or strategy.',
    crossFieldRules: [
      { rule: 'customer_name && product_family', message: 'Sales record must have customer and product' },
      { rule: '!(selling_price < 0)', message: 'Selling price must be non-negative' },
      { rule: '!(margin > selling_price)', message: 'Margin cannot exceed selling price' },
    ],
  },

  offers: {
    section: 'offers',
    targetTable: 'offers',
    schemaVersion: '1.0',
    fields: {
      offer_number:    { type: 'string',      required: false, label: 'Offer Number',      description: 'Offer or proposal identifier' },
      title:           { type: 'string',      required: true,  label: 'Title',             description: 'Offer title or description' },
      customer_name:   { type: 'string',      required: true,  label: 'Customer',          description: 'Target customer or account' },
      total_value:     { type: 'currency',    required: false, label: 'Total Value',       description: 'Offer total value', min: 0 },
      cost_estimation: { type: 'currency',    required: false, label: 'Cost Estimation',   description: 'Estimated cost', min: 0 },
      expected_margin: { type: 'currency',    required: false, label: 'Expected Margin',   description: 'Expected margin value' },
      currency:        { type: 'string',      required: false, label: 'Currency',          description: 'Currency code (e.g. EUR, USD)' },
      probability:     { type: 'probability', required: false, label: 'Win Probability',   description: 'Win probability %', min: 0, max: 100 },
      status:          { type: 'enum',        required: false, label: 'Status',            allowedValues: ['draft', 'submitted', 'won', 'lost', 'open', 'neglected'], description: 'Offer status' },
      submission_date: { type: 'date',        required: false, label: 'Submission Date',   description: 'Date submitted' },
      valid_until:     { type: 'date',        required: false, label: 'Valid Until',       description: 'Offer expiry date' },
      decision_date:   { type: 'date',        required: false, label: 'Decision Date',     description: 'Expected decision date' },
      scope:           { type: 'string',      required: false, label: 'Scope',             description: 'Offer scope or project description' },
      products:        { type: 'array',       required: false, label: 'Products',          description: 'List of products/services in offer' },
    },
    ignoreDomains: ['leads', 'contacts', 'customers', 'sales', 'strategy', 'market'],
    extractionHint: 'Extract ONLY offer and proposal data: offer numbers, customers, values, probabilities, products included. Ignore contact details, orders, or strategy.',
    crossFieldRules: [
      { rule: 'title && customer_name', message: 'Offer must have a title and customer' },
      { rule: '!(probability > 100)', message: 'Win probability cannot exceed 100%' },
      { rule: '!(probability < 0)', message: 'Win probability cannot be negative' },
      { rule: '!(total_value < 0)', message: 'Offer value must be non-negative' },
      { rule: '!(expected_margin > total_value)', message: 'Margin cannot exceed total value' },
    ],
  },

  strategy: {
    section: 'strategy',
    targetTable: 'strategy',
    schemaVersion: '1.0',
    fields: {
      product_family:         { type: 'string',   required: true,  label: 'Product Family',      description: 'Product family or line' },
      region:                 { type: 'string',   required: false, label: 'Region',              description: 'Target region' },
      est_revenue:            { type: 'currency', required: false, label: 'Est. Revenue',        description: 'Estimated target revenue', min: 0 },
      margin:                 { type: 'currency', required: false, label: 'Margin Target',       description: 'Margin target' },
      est_purchasing_quarter: { type: 'string',   required: false, label: 'Est. Quarter',        description: 'Estimated purchasing quarter' },
      number_of_segment:      { type: 'string',   required: false, label: 'Segments',            description: 'Number of target segments' },
      kam:                    { type: 'string',   required: false, label: 'KAM',                 description: 'Key account manager' },
    },
    ignoreDomains: ['leads', 'contacts', 'customers', 'sales', 'offers', 'market', 'competitors'],
    extractionHint: 'Extract ONLY strategic planning data: target revenues, product families, regions, KPIs. Ignore contact details, specific orders, or market intelligence.',
    crossFieldRules: [
      { rule: 'product_family', message: 'Strategy record must have a product family' },
      { rule: '!(est_revenue < 0)', message: 'Estimated revenue must be non-negative' },
    ],
  },

  products: {
    section: 'products',
    targetTable: 'products',
    schemaVersion: '1.0',
    fields: {
      name:          { type: 'string',   required: true,  label: 'Product Name',     description: 'Product or service name' },
      average_value: { type: 'currency', required: false, label: 'Average Value',    description: 'Average deal / unit value', min: 0 },
      type:          { type: 'enum',     required: false, label: 'Type',             allowedValues: ['Commodity', 'Innovation', 'Service', 'Software', 'Hardware', 'Other'], description: 'Product type' },
      comments:      { type: 'string',   required: false, label: 'Comments',         description: 'Additional notes or description' },
    },
    ignoreDomains: ['leads', 'contacts', 'customers', 'sales', 'offers', 'strategy', 'market', 'competitors'],
    extractionHint: 'Extract ONLY product and service catalog data: names, types, average values. Ignore customer data, orders, or financial reports.',
    crossFieldRules: [
      { rule: 'name', message: 'Product must have a name' },
      { rule: '!(average_value < 0)', message: 'Average value must be non-negative' },
    ],
  },

  competitors: {
    section: 'competitors',
    targetTable: 'competitors',
    schemaVersion: '1.0',
    fields: {
      competitor_name:   { type: 'string', required: true,  label: 'Competitor Name',    description: 'Competitor company name' },
      product_family:    { type: 'string', required: false, label: 'Product Family',     description: 'Competing product family' },
      positioning:       { type: 'string', required: false, label: 'Positioning',        description: 'Market positioning' },
      price_positioning: { type: 'string', required: false, label: 'Price Positioning',  description: 'Price positioning (premium/value/etc.)' },
      value_proposition: { type: 'string', required: false, label: 'Value Proposition',  description: 'Key value proposition' },
      strengths:         { type: 'array',  required: false, label: 'Strengths',          description: 'List of strengths' },
      weaknesses:        { type: 'array',  required: false, label: 'Weaknesses',         description: 'List of weaknesses' },
    },
    ignoreDomains: ['leads', 'contacts', 'customers', 'sales', 'offers', 'strategy', 'finance'],
    extractionHint: 'Extract ONLY competitor intelligence data: company names, positioning, strengths, weaknesses. Ignore internal sales or customer data.',
    crossFieldRules: [
      { rule: 'competitor_name', message: 'Competitor must have a name' },
    ],
  },

  market: {
    section: 'market',
    targetTable: 'company_info_update',
    schemaVersion: '1.0',
    fields: {
      industry:          { type: 'string', required: false, label: 'Industry',        description: 'Industry or market segment' },
      market_context:    { type: 'string', required: false, label: 'Market Context',  description: 'Broader market context' },
      growth_rate:       { type: 'number', required: false, label: 'Growth Rate %',   description: 'Market growth rate', min: -100, max: 1000 },
      main_competitors:  { type: 'array',  required: false, label: 'Main Competitors', description: 'Key market competitors' },
      trends:            { type: 'array',  required: false, label: 'Market Trends',   description: 'Identified market trends' },
    },
    ignoreDomains: ['leads', 'contacts', 'customers', 'sales', 'offers', 'strategy'],
    extractionHint: 'Extract ONLY market intelligence: industry trends, growth rates, competitor landscape. Ignore internal sales or customer records.',
    crossFieldRules: [],
  },

  finance: {
    section: 'finance',
    targetTable: 'company_info_update',
    schemaVersion: '1.0',
    fields: {
      annual_revenue:  { type: 'currency', required: false, label: 'Annual Revenue',  description: 'Company annual revenue', min: 0 },
      employee_count:  { type: 'number',   required: false, label: 'Employee Count',  description: 'Number of employees', min: 0 },
      industry:        { type: 'string',   required: false, label: 'Industry',        description: 'Industry classification' },
      headquarters:    { type: 'string',   required: false, label: 'Headquarters',    description: 'HQ location' },
    },
    ignoreDomains: ['leads', 'contacts', 'customers', 'sales', 'offers', 'competitors'],
    extractionHint: 'Extract ONLY financial and company profile data: revenues, employee counts, HQ. Ignore sales orders, offers, or contacts.',
    crossFieldRules: [
      { rule: '!(annual_revenue < 0)', message: 'Annual revenue must be non-negative' },
    ],
  },
};

// Sections that should NOT have any records written to canonical DB
// (their output goes to company_info_update which is handled separately in persistCompanyUpdates).
// Note: all sections listed here either have a schema in SECTION_SCHEMAS above (market, finance)
// or are generic content sections that don't map to any canonical entity table.
export const NON_CANONICAL_SECTIONS = new Set(['market', 'finance', 'general', 'reports', 'hierarchy', 'operations', 'contracts', 'logistics', 'compliance', 'investments']);

export function getSectionSchema(category: string): SectionSchema | null {
  return SECTION_SCHEMAS[category] ?? null;
}

export function buildExtractionPrompt(category: string, textContent: string, companyContext: string): string {
  const schema = getSectionSchema(category);
  if (!schema) {
    return `Extract structured data from the following document content. Return JSON with "extracted_records" array.\n\nDocument:\n${textContent}`;
  }

  const fieldList = Object.entries(schema.fields)
    .map(([key, def]) => `  - ${key} (${def.type}${def.required ? ', REQUIRED' : ''}): ${def.description}`)
    .join('\n');

  return `You are a data extraction agent operating in section: "${schema.section}".

STRICT RULE: Extract ONLY data belonging to the "${schema.section}" domain.
IGNORE data belonging to: ${schema.ignoreDomains.join(', ')}.

${schema.extractionHint}

Company context: ${companyContext}

Extract fields according to this schema:
${fieldList}

Return ONLY valid JSON in this exact format:
{
  "section": "${schema.section}",
  "extracted_records": [
    { /* one object per record with field names matching the schema above */ }
  ],
  "confidence_score": 0.0,
  "missing_fields": [],
  "anomalies": []
}

Document content:
${textContent}`;
}
