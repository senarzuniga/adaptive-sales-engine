import { supabase } from '@/integrations/supabase/client';
import { buildCommercialIntelligence, buildStrategyDiagnostic } from '@/lib/commercialIntelligence';
import { buildPipelineMetrics, getProbabilityGuidance } from '@/lib/salesData';

const fmt = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const day = (offset: number) => new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export interface EdgeRuntimeErrorDetails {
  message: string;
  status?: number;
  retryable: boolean;
  useFallback: boolean;
  title: string;
  description: string;
  kind: 'temporary' | 'auth' | 'config' | 'unknown';
}

export interface InvokeEdgeWithRetryOptions {
  retries?: number;
  baseDelayMs?: number;
  fallbackLabel?: string;
  invoke?: (functionName: string, options: { body: unknown }) => Promise<{ data: any; error: any }>;
}

export function classifyEdgeRuntimeError(error: any, fallbackLabel = 'local fallback'): EdgeRuntimeErrorDetails {
  const message = String(error?.message || error?.error_description || error?.details || 'Remote AI service error');
  const status = Number(error?.status || error?.context?.status || error?.code) || undefined;
  const lower = message.toLowerCase();

  const temporary =
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lower.includes('non-2xx') ||
    lower.includes('failed to send a request') ||
    lower.includes('edge function returned') ||
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('temporar') ||
    lower.includes('fetch');

  if (temporary) {
    return {
      message,
      status,
      retryable: true,
      useFallback: true,
      kind: 'temporary',
      title: 'Remote AI delayed',
      description: `The app retried automatically and switched to ${fallbackLabel} so you can keep working.`,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes('unauthorized') ||
    lower.includes('authorization') ||
    lower.includes('forbidden')
  ) {
    return {
      message,
      status,
      retryable: false,
      useFallback: true,
      kind: 'auth',
      title: 'AI authorization issue',
      description: `The remote AI service is not authorized right now, so the app used ${fallbackLabel}.`,
    };
  }

  if (
    lower.includes('not configured') ||
    lower.includes('missing') ||
    lower.includes('placeholder') ||
    lower.includes('lovable_api_key')
  ) {
    return {
      message,
      status,
      retryable: false,
      useFallback: true,
      kind: 'config',
      title: 'AI configuration issue',
      description: `The remote AI service is not fully configured, so the app used ${fallbackLabel}.`,
    };
  }

  return {
    message,
    status,
    retryable: false,
    useFallback: true,
    kind: 'unknown',
    title: 'AI service issue',
    description: `The remote AI response could not be completed, so the app used ${fallbackLabel}.`,
  };
}

export async function invokeEdgeWithRetry<T = any>(functionName: string, body: unknown, options: InvokeEdgeWithRetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 700;
  const invoke = options.invoke ?? ((name: string, payload: { body: unknown }) => supabase.functions.invoke(name, payload));

  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const { data, error } = await invoke(functionName, { body });

      if (!error && !(data as any)?.error) {
        return data as T;
      }

      const candidateError = error || new Error((data as any)?.error || 'Unknown remote AI error');
      const details = classifyEdgeRuntimeError(candidateError, options.fallbackLabel);
      lastError = candidateError;

      if (!details.retryable || attempt === retries) {
        throw candidateError;
      }
    } catch (error: any) {
      const details = classifyEdgeRuntimeError(error, options.fallbackLabel);
      lastError = error;

      if (!details.retryable || attempt === retries) {
        throw error;
      }
    }

    await sleep(baseDelayMs * (attempt + 1));
  }

  throw lastError || new Error('Unknown remote AI error');
}

export function buildFallbackActionContent(input: { task?: any; companyProfile?: any; contextData?: any }) {
  const task = input.task || {};
  const companyName = input.companyProfile?.company_name || 'the company';
  const target = task.title || 'this action';
  const description = task.description || 'move the opportunity forward';

  return {
    goal: `Advance ${target} for ${companyName}. The goal is to ${description} and confirm a clear next commercial step.`,
    callScript: `1. Open the conversation by referencing the current business context and the objective around ${target}.\n2. Confirm the customer priority, timing, and decision process.\n3. Reinforce value, address objections, and agree one concrete next step with owner and date.`,
    emailTemplate: `Subject: Next step on ${target}\n\nHello,\n\nI would like to follow up on ${target}. Our objective is to align on priorities, clarify remaining questions, and confirm the next commercial step.\n\nPlease let us know a suitable time this week to review it together.\n\nBest regards,`,
    presentationNotes: `Use a concise value case for ${target}. Include customer context, expected business impact, the current status, likely objections, and the next-step recommendation.`,
  };
}

export function buildFallbackActionResultAnalysis(input: { task?: any; resultText?: string }) {
  const resultText = input.resultText || '';
  const positiveSignals = /(agreed|meeting|progress|positive|won|approved|pilot|next step)/i.test(resultText);
  const alignmentScore = positiveSignals ? 82 : 64;

  return {
    outcome: resultText,
    timestamp: new Date().toISOString(),
    aiAnalysis: positiveSignals
      ? 'Local analysis indicates positive momentum. Keep close follow-up and confirm commitment dates.'
      : 'Local analysis suggests more value reinforcement and stakeholder alignment are needed before the next step.',
    alignmentScore,
    recommendations: positiveSignals
      ? ['Confirm owners and dates', 'Maintain commercial rhythm', 'Document the next milestone']
      : ['Clarify the blocker', 'Reinforce the value case', 'Add a decision-focused follow-up'],
  };
}

export function buildFallbackExecutiveInsights(input: { orders?: any[]; opportunities?: any[]; products?: any[]; strategy?: any[]; company?: any }) {
  const orders = input.orders || [];
  const opportunities = input.opportunities || [];
  const products = input.products || [];
  const strategy = input.strategy || [];
  const companyName = input.company?.company_name || 'The company';

  const bookedRevenue = orders.reduce((sum, order) => sum + (order.sellingPrice || 0), 0);
  const pipelineMetrics = buildPipelineMetrics({ opportunities, orders });
  const strategyDiagnostic = buildStrategyDiagnostic({ company: input.company, orders, opportunities, strategy });
  const intelligence = buildCommercialIntelligence({ company: input.company, orders, opportunities, products, strategy });
  const achievement = strategyDiagnostic.currentAchievementPct;
  const coverage = strategyDiagnostic.pipelineCoveragePct;
  const weakDeals = opportunities.filter((opportunity) => getProbabilityGuidance(opportunity.contractProb || 0).band === 'weak');
  const topCustomerMap = orders.reduce((acc: Record<string, number>, order) => {
    const key = order.customerName || 'Unknown';
    acc[key] = (acc[key] || 0) + (order.sellingPrice || 0);
    return acc;
  }, {});
  const topCustomerShare = Object.values(topCustomerMap).sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0);
  const concentration = bookedRevenue > 0 ? (topCustomerShare / bookedRevenue) * 100 : 0;
  const healthScore = Math.max(35, Math.min(92, Math.round((achievement || 55) - weakDeals.length * 2 + (products.length > 0 ? 8 : 0))));

  return {
    executive_summary: `Local executive analysis generated because the remote AI service is unavailable. ${companyName} currently shows current achieved revenue of ${fmt(strategyDiagnostic.currentRevenue)} against a strategic target of ${fmt(strategyDiagnostic.targetRevenue)}, with weighted coverage reaching ${coverage.toFixed(0)}% and ${weakDeals.length} weak open offers below the 75% success threshold.`,
    health_score: healthScore,
    health_label: healthScore >= 75 ? 'Solid' : healthScore >= 55 ? 'Watchlist' : 'At Risk',
    critical_insights: [
      {
        title: 'Current-vs-target reality check',
        type: 'pattern',
        severity: achievement < 50 ? 'high' : 'medium',
        description: `Current confirmed revenue is ${fmt(strategyDiagnostic.currentRevenue)} versus a strategic target of ${fmt(strategyDiagnostic.targetRevenue)}.`,
        data_point: `${achievement.toFixed(0)}% achieved · ${coverage.toFixed(0)}% covered incl. pipeline`,
      },
      {
        title: 'Weak offer attention needed',
        type: weakDeals.length > 0 ? 'warning' : 'strength',
        severity: weakDeals.length > 2 ? 'high' : 'low',
        description: weakDeals.length > 0
          ? `${weakDeals.length} open opportunities are below 75% probability and need stronger improvement actions.`
          : 'Most open opportunities are already above the weak-offer threshold.',
      },
      {
        title: 'Customer concentration',
        type: concentration > 60 ? 'risk' : 'pattern',
        severity: concentration > 60 ? 'high' : 'medium',
        description: concentration > 0
          ? `Top customers represent about ${concentration.toFixed(0)}% of booked revenue.`
          : 'Customer concentration will become visible as more booked sales data is loaded.',
      },
    ],
    recommendations: intelligence.bridgePlan.slice(0, 3).map((item, index) => ({
      priority: index === 0 ? 'immediate' : index === 1 ? 'short_term' : 'medium_term',
      action: item.title,
      expected_impact: item.rationale,
      effort: item.priority === 'critical' ? 'high' : item.priority === 'high' ? 'medium' : 'low',
    })),
    portfolio_diagnosis: `Current portfolio health is driven by ${products.length} tracked products, ${orders.length} booked orders, and ${opportunities.length} opportunities in the commercial funnel.`,
    growth_outlook: achievement >= 100
      ? 'Current confirmed performance is already aligned with the strategic plan.'
      : coverage >= 100
        ? 'The target is still open, but the weighted funnel could close it if execution quality stays high.'
        : 'Growth outlook depends on building more qualified pipeline in the under-covered strategic pillars and accelerating the strongest open deals.',
    key_risks: [
      ...intelligence.rootCauseMap.slice(0, 3).map((cause) => cause.title),
      ...(weakDeals.length > 0 ? ['Weak opportunity quality below 75%'] : []),
    ],
  };
}

export function buildFallbackWeeklyPlan(input: { companyProfile?: any; opportunities?: any[]; orders?: any[]; strategy?: any[]; weekNotes?: string }) {
  const companyName = input.companyProfile?.company_name || 'the company';
  const opportunities = input.opportunities || [];
  const orders = input.orders || [];
  const strategy = input.strategy || [];
  const pipelineMetrics = buildPipelineMetrics({ opportunities, orders });
  const weakDeals = opportunities.filter((opportunity) => getProbabilityGuidance(opportunity.contractProb || 0).band === 'weak');
  const strongDeals = opportunities.filter((opportunity) => getProbabilityGuidance(opportunity.contractProb || 0).band === 'strong');
  const target = strategy.reduce((sum, row) => sum + (row.estRevenue || 0), 0);
  const actual = pipelineMetrics.soldRevenue;

  const tasks = [
    weakDeals[0] && {
      title: `Improve weak offer for ${weakDeals[0].customerName || 'priority account'}`,
      description: 'Raise win probability by refining the value case, qualification, and next-step discipline.',
      pillar: 'p4',
      priority: 'high',
      category: 'follow_up',
      dueDate: day(2),
      rationale: 'Offers below 75% probability are considered weak and need improvement actions.',
      budgetImpactScore: 85,
      targetSegment: weakDeals[0].productFamily || weakDeals[0].region || 'pipeline',
      estimatedRevenueImpact: weakDeals[0].estRevenue || 0,
      selected: true,
    },
    strongDeals[0] && {
      title: `Protect confidence on ${strongDeals[0].customerName || 'strong deal'}`,
      description: 'Use relationship management and disciplined follow-up to secure closure on the strongest deal.',
      pillar: 'p4',
      priority: 'high',
      category: 'meeting',
      dueDate: day(3),
      rationale: 'Deals at or above 75% should focus on confidence, relationship, and follow-up.',
      budgetImpactScore: 90,
      targetSegment: strongDeals[0].productFamily || strongDeals[0].region || 'pipeline',
      estimatedRevenueImpact: strongDeals[0].estRevenue || 0,
      selected: true,
    },
    {
      title: 'Review strategy gap coverage',
      description: 'Compare booked revenue, sold opportunities, and weighted open pipeline against the current target.',
      pillar: 'p1',
      priority: target > actual ? 'high' : 'medium',
      category: 'strategy',
      dueDate: day(4),
      rationale: 'A weekly commercial review keeps the strategy grounded in real pipeline coverage.',
      budgetImpactScore: 78,
      targetSegment: 'company-wide',
      estimatedRevenueImpact: Math.max(target - actual, 0),
      selected: true,
    },
  ].filter(Boolean);

  return {
    weekSummary: `Local weekly planner generated for ${companyName}. Current confirmed sold revenue is ${fmt(pipelineMetrics.soldRevenue)} and weighted open coverage is ${fmt(pipelineMetrics.weightedOpenRevenue)}. ${input.weekNotes ? `Planner note: ${input.weekNotes}` : ''}`,
    tasks,
  };
}

export function buildFallbackEmailResponse(input: { customerName?: string; emailSubject?: string; emailBody?: string; companyProfile?: any }) {
  const customerName = input.customerName || 'there';
  const subject = input.emailSubject || 'your request';
  const body = input.emailBody || '';
  const complaint = /(issue|problem|complaint|delay|urgent|broken|error)/i.test(body + ' ' + subject);

  return {
    canAnswer: !complaint,
    confidence: complaint ? 72 : 84,
    responseSubject: `Re: ${subject}`,
    responseBody: complaint
      ? `Hello ${customerName},\n\nThank you for your message. We are reviewing the situation and will come back shortly with a concrete next step. We appreciate your patience and will keep the follow-up active.\n\nBest regards,`
      : `Hello ${customerName},\n\nThank you for your message. We appreciate your interest and would be glad to help. We can review your request and arrange the next step with the relevant commercial contact.\n\nBest regards,`,
    internalNote: complaint
      ? 'Local fallback suggests quick escalation and a confidence-recovery follow-up.'
      : 'Local fallback suggests a normal commercial response and follow-up.',
    suggestedCcName: '',
    suggestedCcEmail: '',
    suggestedCcReason: complaint ? 'Escalate internally if the issue affects delivery or trust.' : 'No escalation required.',
    category: complaint ? 'complaint' : 'general_info',
    urgency: complaint ? 'high' : 'medium',
    suggestedFollowUp: complaint ? 'Reply within 24 hours and confirm ownership.' : 'Offer a call or demo and confirm the next step.',
  };
}

export function buildFallbackGeneratedContent(input: { topic?: string; targetPlatform?: string; contentType?: string; companyProfile?: any; additionalContext?: string }) {
  const topic = input.topic || 'commercial update';
  const platform = input.targetPlatform || 'linkedin';
  const companyName = input.companyProfile?.company_name || 'our team';
  const context = input.additionalContext ? ` ${input.additionalContext}` : '';

  return {
    title: `${companyName}: ${topic}`,
    body: `${companyName} is sharing a concise ${input.contentType || 'content'} update on ${topic}.${context} The message should highlight customer value, practical impact, and a clear next step.`,
    summary: `Local content draft created for ${platform}.`,
    hashtags: ['#sales', '#strategy', '#growth'],
    callToAction: 'Invite the audience to connect, ask questions, or request a follow-up discussion.',
    suggestedImageDescription: `Professional visual representing ${topic} for ${platform}.`,
    platform,
    contentType: input.contentType || 'update',
    alternativeVersions: [],
  };
}

export function buildFallbackOfferAnalysis(input: { totalCost: number; targetMargin: number; currency?: string }) {
  const totalCost = input.totalCost || 0;
  const targetMargin = input.targetMargin || 0;
  const basePrice = totalCost * (1 + targetMargin / 100);
  const conservativePrice = totalCost * (1 + Math.max(targetMargin - 5, 5) / 100);
  const stretchPrice = totalCost * (1 + (targetMargin + 5) / 100);
  const riskScore = targetMargin < 15 ? 'high' : targetMargin < 25 ? 'medium' : 'low';
  const marginScore = targetMargin >= 25 ? 'high' : targetMargin >= 15 ? 'medium' : 'low';

  return {
    scenarios: [
      { type: 'conservative', totalCost, sellingPrice: conservativePrice, marginAmount: conservativePrice - totalCost, marginPct: Math.max(targetMargin - 5, 5), riskLevel: 'low', adjustments: ['Use a defensive pricing approach to protect conversion.'] },
      { type: 'base', totalCost, sellingPrice: basePrice, marginAmount: basePrice - totalCost, marginPct: targetMargin, riskLevel: riskScore, adjustments: ['Maintain the target margin with a balanced commercial position.'] },
      { type: 'stretch', totalCost, sellingPrice: stretchPrice, marginAmount: stretchPrice - totalCost, marginPct: targetMargin + 5, riskLevel: 'high', adjustments: ['Use only when the value case clearly supports premium pricing.'] },
    ],
    scoring: {
      marginScore,
      marginValue: Math.min(100, Math.max(0, targetMargin * 3)),
      riskScore,
      riskValue: riskScore === 'low' ? 20 : riskScore === 'medium' ? 50 : 80,
      globalScore: Math.min(100, Math.max(35, Math.round(65 + targetMargin - (riskScore === 'high' ? 20 : riskScore === 'medium' ? 8 : 0)))),
      explanation: 'Local offer analysis generated while the remote AI pricing engine was unavailable.',
    },
    riskFactors: [
      'Verify all cost assumptions before final approval.',
      'Confirm the commercial value case matches the proposed margin.',
    ],
    recommendations: [
      'Use the base scenario as the primary proposal.',
      'Keep a conservative fallback ready for negotiation pressure.',
      'Only use the stretch scenario if customer value and urgency are proven.',
    ],
  };
}

export function buildFallbackServiceContractAnalysis(input: { contractDef?: any; suggestedAnnualFee?: number; includedPartsCost?: number; marginTarget?: number }) {
  const contractName = input.contractDef?.contract_name || 'service contract';
  return {
    executiveSummary: `Local contract analysis generated for ${contractName}. The recommendation is to keep the offer simple, protect recurring value, and align the SLA with the customer risk profile.`,
    revenueOpportunities: [
      { title: 'Recurring revenue stability', detail: 'Use the annual fee as the anchor for predictable income and long-term retention.', impact: fmt(input.suggestedAnnualFee || 0) },
      { title: 'Parts bundling control', detail: 'Include only high-frequency parts that improve service certainty without eroding margin.', impact: fmt(input.includedPartsCost || 0) },
    ],
    productizationAdvice: [
      'Package the contract in clear tiers so the customer understands the service ladder.',
      'Protect margin by separating included items from premium optional add-ons.',
    ],
    aiAgentRecommendations: [
      `Use a target margin of about ${input.marginTarget || 0}% as the baseline for negotiation.`,
      'Reinforce uptime, response time, and lifecycle value during the sales conversation.',
    ],
  };
}
