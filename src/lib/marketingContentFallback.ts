interface MarketingFallbackInput {
  contentType: string;
  topic: string;
  targetPlatform: string;
  companyProfile?: any;
  context?: {
    ordersCtx?: string;
    oppsCtx?: string;
    stratCtx?: string;
    productsInfo?: string;
  };
}

interface MarketingFallbackOutput {
  title: string;
  body: string;
  summary: string;
  hashtags: string[];
  callToAction: string;
  suggestedImageDescription?: string;
  platform: string;
  contentType: string;
  alternativeVersions?: { platform: string; body: string }[];
}

const platformCTA: Record<string, string> = {
  linkedin: 'Let us know if you would like to explore how this approach could support your business goals.',
  newsletter: 'Reply to this newsletter if you want a tailored follow-up conversation.',
  twitter: 'Tell us your view in the comments or send us a message.',
  instagram: 'Reach out if you want to learn more.',
  facebook: 'Contact us to continue the conversation.',
};

export function buildFallbackMarketingContent(input: MarketingFallbackInput): MarketingFallbackOutput {
  const companyName = input.companyProfile?.company_name || 'Our company';
  const industry = input.companyProfile?.industry || 'our industry';
  const products = input.companyProfile?.main_products || 'our solutions portfolio';
  const goals = input.companyProfile?.strategic_goals || 'sustainable commercial growth';
  const platform = input.targetPlatform || 'linkedin';
  const topic = input.topic || 'commercial excellence';

  const title = `${companyName}: ${topic}`.slice(0, 120);
  const summary = `${companyName} shares a practical perspective on ${topic}, grounded in its experience in ${industry}.`;
  const callToAction = platformCTA[platform] || platformCTA.linkedin;

  const body = [
    `${companyName} continues to focus on ${goals}.`,
    '',
    `Today we want to highlight an important topic for our customers and partners: ${topic}.`,
    '',
    `Across ${industry}, companies are looking for ways to improve performance, simplify execution, and create more value from investments in ${products}.`,
    '',
    input.context?.productsInfo ? `Portfolio context: ${input.context.productsInfo}` : '',
    input.context?.ordersCtx ? `Commercial track record: ${input.context.ordersCtx}` : '',
    input.context?.oppsCtx ? `Current market momentum: ${input.context.oppsCtx}` : '',
    input.context?.stratCtx ? `Strategic direction: ${input.context.stratCtx}` : '',
    '',
    `Our view is simple: the best results come from combining market insight, operational discipline, and a clear value proposition for the customer.`,
    '',
    callToAction,
  ].filter(Boolean).join('\n');

  const hashtags = [
    '#B2B',
    '#SalesTransformation',
    '#CommercialExcellence',
    `#${String(industry).replace(/[^a-z0-9]/gi, '')}`,
  ].slice(0, 4);

  return {
    title,
    body,
    summary,
    hashtags,
    callToAction,
    suggestedImageDescription: `Professional visual representing ${companyName} discussing ${topic} in ${industry}.`,
    platform,
    contentType: input.contentType || 'article',
    alternativeVersions: [
      { platform: 'linkedin', body },
      { platform: 'newsletter', body },
    ],
  };
}
