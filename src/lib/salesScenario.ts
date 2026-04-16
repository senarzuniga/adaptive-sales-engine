export interface SalesScenarioInput {
  scenarioName: string;
  prompt: string;
  companyName: string;
  totalPipeline: number;
  totalSold: number;
  keyRegions: string[];
  topCustomers: string[];
}

export interface ScenarioResult {
  name: string;
  prompt: string;
  report: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const inferScenarioModel = (prompt: string) => {
  const lower = prompt.toLowerCase();
  if (lower.includes('distributor') || lower.includes('partner') || lower.includes('channel')) return 'Partner-Led Expansion';
  if (lower.includes('direct') || lower.includes('internal team')) return 'Direct Sales Coverage';
  if (lower.includes('hybrid')) return 'Hybrid Coverage Model';
  if (lower.includes('pricing')) return 'Value-Based Pricing Shift';
  return 'Adaptive Commercial Scenario';
};

export function buildSalesScenarioRecommendation(input: SalesScenarioInput): string {
  const model = inferScenarioModel(input.prompt);
  const pipelineGap = Math.max(0, input.totalPipeline - input.totalSold);
  const regions = input.keyRegions.length > 0 ? input.keyRegions.join(', ') : 'priority markets';
  const customers = input.topCustomers.length > 0 ? input.topCustomers.join(', ') : 'top accounts';

  return [
    `## ${input.scenarioName}`,
    '',
    `Prompt tested: ${input.prompt}`,
    '',
    '### Scenario Thesis',
    `${input.companyName} explores a ${model} to convert more of the current ${fmt(input.totalPipeline)} pipeline into disciplined growth while protecting ${fmt(input.totalSold)} already captured revenue.`,
    '',
    '### Strategic Fit',
    `This scenario is best suited for ${regions}, especially around accounts such as ${customers}. It is strongest when the business wants faster coverage without losing control of strategic customers.`,
    '',
    '### Recommended Moves',
    '- Define account ownership rules by region, channel, and deal size.',
    '- Protect strategic accounts with direct KAM leadership and shared partner support where needed.',
    '- Use a weekly pipeline governance cadence to review neglected deals and cross-sell options.',
    '- Align pricing, follow-up discipline, and stakeholder plans before scaling headcount.',
    '',
    '### Risk Review',
    `Main risk: fragmented execution across ${regions}. Current uncovered commercial value is approximately ${fmt(pipelineGap)} if the team does not coordinate around scenario execution.`,
    '',
    '### Success Metrics',
    '- Higher conversion of priority pipeline',
    '- Lower neglected opportunity value',
    '- Better KAM ownership clarity',
    '- Faster response time on strategic accounts',
  ].join('\n');
}

export function buildScenarioSynthesis(scenarios: ScenarioResult[]): string {
  if (scenarios.length === 0) {
    return '## AI + Context - Recommendations\n\nNo scenario has been created yet.';
  }

  const highlights = scenarios.map((scenario) => `- ${scenario.name}: ${scenario.prompt}`).join('\n');

  return [
    '## AI + Context - Recommendations',
    '',
    'The best final recommendation is to combine the strongest ideas from the tested scenarios while preserving commercial discipline and customer ownership.',
    '',
    '### Scenario Portfolio Reviewed',
    highlights,
    '',
    '### Final Recommendation',
    '- Keep direct control over strategic and multi-site customers.',
    '- Use partners or agents only where they increase regional coverage speed.',
    '- Run quarterly account reviews and monthly pipeline reviews across all scenarios.',
    '- Standardize pricing, stakeholder mapping, and value-plan templates before scaling.',
  ].join('\n');
}
