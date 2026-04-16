type SubjectType = 'company' | 'geographical' | 'sector' | 'product' | 'process' | 'trade-show' | 'custom';

interface IntelligenceFallbackInput {
  targetName: string;
  targetWebsite?: string;
  analysisType: string;
  subjectType: SubjectType;
  analysisBrief?: string;
  companyContext?: any;
}

const confidence = (type: string) => (type === 'company' ? 'MEDIUM' : 'LOW');

const subjectDescriptor = (type: SubjectType) => {
  switch (type) {
    case 'geographical': return 'geographical region';
    case 'sector': return 'industry sector';
    case 'product': return 'product domain';
    case 'process': return 'production process';
    case 'trade-show': return 'trade show or event';
    case 'custom': return 'strategic subject';
    default: return 'company';
  }
};

export function buildFallbackIntelligenceReport(input: IntelligenceFallbackInput) {
  const descriptor = subjectDescriptor(input.subjectType);
  const ownCompany = input.companyContext?.company_name || 'your company';
  const industry = input.companyContext?.industry || 'industrial markets';
  const brief = input.analysisBrief?.trim() || `Priority focus on ${input.targetName}.`;

  return {
    executive_summary: `${input.targetName} was analyzed as a ${descriptor} relevant to ${ownCompany}. This fallback report highlights the main strategic dynamics, commercial opportunities, and risks based on the provided context and standard market logic.\n\nThe analysis indicates that ${input.targetName} should be monitored through a combination of market-fit, commercial attractiveness, and execution complexity lenses. The strongest use case is to support decision making around expansion, focus, partnerships, and commercial prioritization in ${industry}.`,
    company_profile: {
      sector: input.subjectType === 'sector' ? input.targetName : industry,
      sub_sector: input.analysisType,
      company_type: descriptor,
      founded_year: 'N/A',
      size_category: input.subjectType === 'geographical' ? 'Regional scope' : 'Strategic scope',
      employee_estimate: 'N/A',
      headquarters: input.subjectType === 'geographical' ? input.targetName : 'N/A',
      locations: [input.targetName],
      org_structure_notes: brief,
      products_services: [input.targetName],
      market_positioning: `Relevant subject for commercial assessment within ${industry}.`,
      confidence_level: confidence(input.subjectType),
    },
    financial_analysis: {
      revenue_estimate: 'Estimated based on market context',
      revenue_currency: 'EUR',
      ebitda_estimate: 'Context dependent',
      net_profit_estimate: 'Context dependent',
      growth_rate: 'Moderate to positive in priority segments',
      margin_estimate: 'Depends on business model and position',
      debt_level: 'N/A',
      financial_health: `For ${descriptor} analysis, the financial lens should focus on investment intensity, pricing power, and recurring revenue potential.`,
      data_sources: ['User-provided context', 'Internal strategic framework'],
      confidence_level: confidence(input.subjectType),
      hypotheses_explored: [
        `High-growth hypothesis for ${input.targetName}`,
        `Stable but competitive scenario for ${input.targetName}`,
      ],
    },
    product_analysis: {
      products: [
        {
          name: input.targetName,
          classification: input.subjectType === 'product' ? 'innovation' : 'commodity',
          differentiation: `Differentiation should be assessed through value proposition, switching cost, and technical uniqueness for ${input.targetName}.`,
          margin_estimate: 'Context dependent',
          lifecycle_stage: input.subjectType === 'trade-show' ? 'awareness' : 'growth',
        },
      ],
      price_dependency: 'Evaluate sensitivity to procurement pressure, substitution risk, and service bundling.',
      overall_assessment: `${input.targetName} should be positioned according to strategic importance, solution fit, and ability to create defendable value.`,
    },
    market_analysis: {
      market_size: `Relevant addressable scope around ${input.targetName}`,
      market_growth: 'Moderate to attractive depending on specialization',
      trends: [
        'Digitalization and automation are increasing decision speed and data availability.',
        'Customers are prioritizing lifecycle value and reliability over purely transactional pricing.',
        `Sector and regional specialization is becoming more important for ${ownCompany}.`,
      ],
      entry_barriers: 'Commercial relationships, technical expertise, references, and local access',
      regulatory_risks: input.subjectType === 'geographical' ? 'Local regulations, certifications, and procurement rules' : 'Moderate and context dependent',
      market_attractiveness: 'MEDIUM',
      competition_level: 'MEDIUM',
      opportunities: [
        `Build a sharper go-to-market approach around ${input.targetName}.`,
        'Use segmentation and account prioritization to focus resources.',
        'Translate market intelligence into proposals, partnerships, and account plans.',
      ],
    },
    competitive_analysis: {
      competitors: [
        { name: 'Incumbent players', positioning: 'Established presence', strengths: ['Access', 'References'], weaknesses: ['Slower adaptation'] },
        { name: 'Specialist challengers', positioning: 'Niche experts', strengths: ['Focus', 'Agility'], weaknesses: ['Scale limits'] },
      ],
      competitive_advantages: ['Better specialization', 'Faster commercial focus', 'Closer alignment with target segments'],
      competitive_risks: ['Fragmented execution', 'Insufficient local insight', 'Price-only positioning'],
      competitive_map_summary: `Success in ${input.targetName} will depend on how well ${ownCompany} differentiates beyond price and builds credible relevance.`,
    },
    strategic_analysis: {
      swot: {
        strengths: ['Clear strategic focus is possible', 'Can leverage existing commercial capabilities'],
        weaknesses: ['Need deeper subject-specific intelligence', 'Execution discipline is required'],
        opportunities: ['Focused segmentation', 'Partnerships or regional access models', 'Higher-value positioning'],
        threats: ['Competitive saturation', 'Low differentiation', 'Misallocated commercial resources'],
      },
      current_situation: `${input.targetName} is being evaluated as a strategic theme for decision support.`,
      trajectory: 'Most likely outcome improves if the company applies disciplined prioritization and local insight.',
      key_risks: ['Weak follow-through', 'Low-quality positioning', 'Insufficient stakeholder understanding'],
      diagnosis: `${input.targetName} should be treated as a commercial opportunity area that requires structured validation, targeted messaging, and explicit resource choices.`,
    },
    valuation: {
      estimated_value: 'Strategic value depends on monetization path',
      value_range_min: 'Low case: limited traction',
      value_range_max: 'High case: strong adoption and repeatability',
      valuation_currency: 'EUR',
      methods_used: ['Strategic attractiveness assessment', 'Commercial potential logic'],
      multiples_applied: {},
      confidence_level: confidence(input.subjectType),
      valuation_notes: `For ${descriptor} topics, value should be measured by revenue potential, relevance to strategic accounts, and scalability.`,
    },
    sale_propensity: {
      probability: 'MEDIUM',
      financial_signals: ['Potential to support growth if targeted correctly'],
      strategic_signals: [`Relevant to ${ownCompany} strategic development`],
      organizational_signals: ['Requires cross-functional coordination'],
      contextual_signals: [brief],
      main_sale_drivers: ['Market need', 'Differentiated value proposition', 'Focused commercial execution'],
      potential_buyer_types: ['Strategic accounts', 'Regional operators', 'Industrial buyers'],
      recommendation: 'prepare_sale',
      reasoning: `The topic is commercially relevant, but it requires sharper validation and prioritization before major resource commitment.`,
    },
    future_scenarios: {
      five_year: {
        best_case: `${ownCompany} builds a repeatable commercial play around ${input.targetName} and captures above-market growth.`,
        worst_case: `The topic remains exploratory with no disciplined follow-through.`,
        most_probable: `Moderate progress if prioritized through focused account and market development actions.`,
      },
      ten_year: {
        best_case: `${input.targetName} becomes a durable strategic pillar for expansion and differentiation.`,
        worst_case: `The company misses the opportunity due to fragmentation and slow response.`,
        most_probable: `Long-term value emerges only if the subject is embedded into a consistent commercial model.`,
      },
    },
    recommendations: [
      { type: 'strategic', priority: 'high', action: `Define a clear commercial thesis for ${input.targetName}.`, rationale: 'Avoid generic exploration without focus.', timeline: '0-30 days' },
      { type: 'commercial', priority: 'high', action: 'Map target segments, stakeholders, and buying triggers.', rationale: 'Turn intelligence into an actionable go-to-market plan.', timeline: '30-60 days' },
      { type: 'operational', priority: 'medium', action: 'Create a short pilot or validation plan with explicit success metrics.', rationale: 'Reduce uncertainty before scaling investment.', timeline: '60-90 days' },
    ],
    data_sources: [
      { source: 'User prompt and local business context', type: 'internal', reliability: confidence(input.subjectType), date: new Date().toISOString().split('T')[0] },
    ],
    hypothesis_log: [
      { section: 'strategic_analysis', hypotheses: ['High-potential growth area', 'Context-specific niche opportunity'], selected: 'Context-specific niche opportunity', justification: `The available brief suggests focused potential but limited verified external evidence in fallback mode.` },
    ],
  };
}
