export type OfferTemplateType = 'machine_selling' | 'service_selling';

export interface OfferTemplateSection {
  id: string;
  title: string;
  required: boolean;
  is_last_section?: boolean;
  content_types?: string[];
  content_blocks?: string[];
  subsections?: Array<{ id: string; title: string }>;
}

export interface OfferTemplateDefinition {
  template_id: string;
  template_type: OfferTemplateType;
  sections: OfferTemplateSection[];
}

export const MACHINE_SELLING_TEMPLATE: OfferTemplateDefinition = {
  template_id: 'machine_selling_v1',
  template_type: 'machine_selling',
  sections: [
    {
      id: 'cover_page',
      title: 'Cover Page & Executive Summary',
      required: true,
      content_types: ['company_logo', 'offer_title', 'client_name', 'offer_date', 'validity_period'],
    },
    {
      id: 'technical_specifications',
      title: 'Technical Specifications & Equipment Overview',
      required: true,
      subsections: [
        { id: 'machine_model', title: 'Machine Model & Configuration' },
        { id: 'technical_data', title: 'Technical Data Sheet' },
        { id: 'included_components', title: 'Included Components & Accessories' },
        { id: 'options_upgrades', title: 'Optional Upgrades & Customizations' },
      ],
    },
    {
      id: 'performance_guarantees',
      title: 'Performance Guarantees & KPIs',
      required: false,
      content_types: ['throughput_rates', 'efficiency_metrics', 'uptime_guarantees', 'quality_standards'],
    },
    {
      id: 'commercial_terms',
      title: 'Commercial Terms',
      required: true,
      subsections: [
        { id: 'pricing', title: 'Pricing Breakdown' },
        { id: 'payment_terms', title: 'Payment Terms & Milestones' },
        { id: 'taxes_duties', title: 'Taxes, Duties & Shipping' },
        { id: 'warranty', title: 'Warranty & Post-Sale Support' },
      ],
    },
    {
      id: 'delivery_installation',
      title: 'Delivery, Installation & Commissioning',
      required: true,
      content_types: ['delivery_timeline', 'installation_process', 'training_included', 'site_requirements'],
    },
    {
      id: 'service_maintenance',
      title: 'Service & Maintenance Packages',
      required: false,
      content_types: ['preventive_maintenance', 'corrective_maintenance', 'spare_parts_kits', 'remote_support'],
    },
    {
      id: 'legal_conditions',
      title: 'Offer & Purchase Conditions',
      required: true,
      is_last_section: true,
      content_blocks: ['general_terms', 'delivery_conditions', 'payment_default', 'confidentiality', 'governing_law', 'acceptance_deadline'],
    },
  ],
};

export const SERVICE_SELLING_TEMPLATE: OfferTemplateDefinition = {
  template_id: 'service_selling_v1',
  template_type: 'service_selling',
  sections: [
    { id: 'cover_page', title: 'Cover Page & Service Overview', required: true },
    {
      id: 'scope_of_work',
      title: 'Scope of Work (SoW)',
      required: true,
      subsections: [
        { id: 'objectives', title: 'Project Objectives & Success Criteria' },
        { id: 'deliverables', title: 'Deliverables & Milestones' },
        { id: 'exclusions', title: 'Exclusions & Assumptions' },
        { id: 'client_responsibilities', title: 'Client Responsibilities' },
      ],
    },
    {
      id: 'methodology',
      title: 'Methodology & Approach',
      required: false,
      content_types: ['project_phases', 'tools_technologies', 'team_structure', 'communication_plan'],
    },
    {
      id: 'timeline',
      title: 'Project Timeline & Resource Allocation',
      required: true,
      content_types: ['gantt_chart', 'resource_matrix', 'key_milestones', 'dependencies'],
    },
    {
      id: 'commercial_terms',
      title: 'Commercial Terms',
      required: true,
      subsections: [
        { id: 'fee_structure', title: 'Fee Structure (Fixed Price / T&M / Retainer)' },
        { id: 'payment_schedule', title: 'Payment Schedule' },
        { id: 'expenses', title: 'Expenses & Reimbursements' },
      ],
    },
    {
      id: 'governance',
      title: 'Governance & Reporting',
      required: true,
      content_types: ['steering_committee', 'reporting_frequency', 'escalation_process', 'change_management'],
    },
    {
      id: 'service_levels',
      title: 'Service Level Agreements (SLAs)',
      required: false,
      content_types: ['response_times', 'resolution_times', 'availability', 'penalties_bonuses'],
    },
    {
      id: 'legal_conditions',
      title: 'Offer & Purchase Conditions',
      required: true,
      is_last_section: true,
      content_blocks: ['service_terms', 'liability_limits', 'ip_ownership', 'termination_conditions', 'data_protection', 'confidentiality'],
    },
  ],
};

export const OFFER_TEMPLATES: OfferTemplateDefinition[] = [MACHINE_SELLING_TEMPLATE, SERVICE_SELLING_TEMPLATE];

export function getTemplateByType(type: OfferTemplateType) {
  return OFFER_TEMPLATES.find((template) => template.template_type === type) || MACHINE_SELLING_TEMPLATE;
}

export const DEFAULT_OFFER_VARIABLES = [
  '{{client.company_name}}',
  '{{offer.serial_number}}',
  '{{offer.total_amount}}',
  '{{offer.valid_until}}',
  '{{sales_rep.name}}',
  '{{sales_rep.email}}',
] as const;
