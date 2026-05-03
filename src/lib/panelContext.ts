import type { GoaDataSnapshot, GoaPanelContext } from '@/agents/goa/types';

const PANEL_REGISTRY: Array<{ key: string; label: string; matcher: RegExp }> = [
  { key: 'dashboard', label: 'Dashboard', matcher: /^\/$/ },
  { key: 'sales_data', label: 'Sales Data', matcher: /^\/upload/ },
  { key: 'company_info', label: 'Company Info', matcher: /^\/company-info/ },
  { key: 'analysis_360', label: '360 Analysis', matcher: /^\/360-analysis/ },
  { key: 'portfolio_analysis', label: 'Portfolio Analysis', matcher: /^\/portfolio-analysis/ },
  { key: 'sales_architecture', label: 'Sales Architecture', matcher: /^\/sales-architecture/ },
  { key: 'kam', label: 'Key Account Management', matcher: /^\/kam/ },
  { key: 'after_sales', label: 'After-Sales Engine', matcher: /^\/after-sales/ },
  { key: 'ai_sales', label: 'AI-Augmented Sales', matcher: /^\/ai-sales/ },
  { key: 'behavioral', label: 'Behavioral Transformation', matcher: /^\/behavioral/ },
  { key: 'product_strategy', label: 'Product Strategy', matcher: /^\/product-strategy/ },
  { key: 'product_catalog', label: 'Product Catalog', matcher: /^\/product-catalog/ },
  { key: 'monitoring', label: 'Monitoring', matcher: /^\/monitoring/ },
  { key: 'weekly_planner', label: 'Weekly Planner', matcher: /^\/weekly-planner/ },
  { key: 'team_directory', label: 'Team Directory', matcher: /^\/team-directory/ },
  { key: 'email_cobot', label: 'Email Co-Bot', matcher: /^\/email-cobot/ },
  { key: 'marketing_content', label: 'Marketing Content', matcher: /^\/marketing-content/ },
  { key: 'offer_pricing', label: 'Offer & Pricing', matcher: /^\/offer-pricing/ },
  { key: 'service_contract_builder', label: 'Service Contract Builder', matcher: /^\/service-contract-builder/ },
  { key: 'project_management', label: 'Project Management', matcher: /^\/project-management/ },
  { key: 'budget_command_center', label: 'Budget Command Center', matcher: /^\/budget-command-center/ },
  { key: 'cost_rates', label: 'Cost & Rates', matcher: /^\/cost-rates/ },
  { key: 'business_intelligence', label: 'Business Intelligence', matcher: /^\/business-intelligence/ },
  { key: 'social_media', label: 'Social Media', matcher: /^\/social-media/ },
  { key: 'saved_companies', label: 'Saved Companies', matcher: /^\/companies/ },
];

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

const avg = (values: number[]) => {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
};

const topNEntries = (input: Record<string, number>, limit = 5) =>
  Object.entries(input)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => ({ key, value }));

export function resolvePanelFromRoute(route: string) {
  const found = PANEL_REGISTRY.find((panel) => panel.matcher.test(route));
  return found || { key: 'generic_panel', label: 'Generic Panel', matcher: /.*/ };
}

function buildVisibleSnapshot(route: string, data: GoaDataSnapshot) {
  const salesByCustomer: Record<string, number> = {};
  data.orders.forEach((order) => {
    const key = order.customerName || 'Unknown';
    salesByCustomer[key] = (salesByCustomer[key] || 0) + (order.sellingPrice || 0);
  });

  const pipelineByCustomer: Record<string, number> = {};
  data.opportunities.forEach((opportunity) => {
    const key = opportunity.customerName || 'Unknown';
    pipelineByCustomer[key] = (pipelineByCustomer[key] || 0) + (opportunity.estRevenue || 0);
  });

  return {
    route,
    row_counts: {
      orders: data.orders.length,
      opportunities: data.opportunities.length,
      products: data.products.length,
      strategy: data.strategy.length,
      leads: data.leads.length,
      contacts: data.contacts.length,
    },
    top_customers_by_sales: topNEntries(salesByCustomer),
    top_customers_by_pipeline: topNEntries(pipelineByCustomer),
    sample_orders: data.orders.slice(0, 3),
    sample_opportunities: data.opportunities.slice(0, 3),
    sample_products: data.products.slice(0, 3),
  };
}

function buildHistoricalSnapshot(data: GoaDataSnapshot) {
  const totalSold = sum(data.orders.map((order) => order.sellingPrice || 0));
  const totalPipeline = sum(data.opportunities.map((opportunity) => opportunity.estRevenue || 0));

  return {
    totals: {
      sold_revenue: totalSold,
      open_pipeline: totalPipeline,
      total_contacts: data.contacts.length,
      total_leads: data.leads.length,
    },
    quality_signals: {
      orders_missing_margin: data.orders.filter((order) => !order.margin && order.margin !== 0).length,
      opp_missing_probability: data.opportunities.filter((opportunity) => !opportunity.contractProb && opportunity.contractProb !== 0).length,
      products_missing_type: data.products.filter((product) => !product.type?.trim()).length,
      contacts_missing_email: data.contacts.filter((contact) => !contact.email?.trim()).length,
    },
    averages: {
      avg_order_margin: avg(data.orders.map((order) => order.margin || 0)),
      avg_opportunity_probability: avg(data.opportunities.map((opportunity) => opportunity.contractProb || 0)),
    },
  };
}

export function buildPanelContext(input: {
  route: string;
  companyId: string;
  userPrompt: string;
  data: GoaDataSnapshot;
}): GoaPanelContext {
  const panel = resolvePanelFromRoute(input.route);

  return {
    panel: panel.label,
    panelKey: panel.key,
    route: input.route,
    company_id: input.companyId,
    visible_data: buildVisibleSnapshot(input.route, input.data),
    historical_data: buildHistoricalSnapshot(input.data),
    user_prompt: input.userPrompt,
  };
}
