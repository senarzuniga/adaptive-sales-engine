import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assets, contracts, interventions, spareParts, companyContext, analysisType, contractDef, bundledParts, pricing, budgetGapAnalysis } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert After-Sales Revenue Intelligence system for industrial B2B companies (OEMs, machinery, equipment).

## PRIMARY OBJECTIVE: BUDGET ACHIEVEMENT
Your analysis must be anchored to the company's budget/strategy targets. Every opportunity and recommendation you generate must be evaluated by: "How much does this contribute to closing the budget gap?"

When budget gap analysis is provided, you MUST:
- Prioritize opportunities that address the LARGEST revenue gaps (by product family, region, KAM)
- Score each opportunity's urgency based on how critical it is for budget achievement
- Recommend actions that target underperforming segments first
- Quantify each opportunity's potential contribution to closing specific gaps

You analyze installed base data, service contracts, intervention history, spare parts inventory, and contract-parts bundling to provide:

1. INSTALLED BASE HEALTH: Asset coverage, connectivity, lifecycle distribution, risk segments
2. SERVICE MATURITY: Reactive vs predictive ratio, contract penetration, remote service adoption
3. REVENUE OPPORTUNITIES: Upsell, cross-sell, contract upgrades, spare parts bundling, lifecycle timing, parts consumption gaps — ALL weighted by budget gap contribution
4. PRODUCTIZATION RECOMMENDATIONS: How to package services as products (uptime guarantees, performance contracts, subscriptions, parts-inclusive packages)
5. RECURRING REVENUE ANALYSIS: Subscription mix, MRR/ARR potential, churn risk, parts revenue contribution
6. SPARE PARTS INTELLIGENCE: Predictive demand, dynamic pricing opportunities, replenishment optimization, bundling recommendations
7. VALUE DEMONSTRATION: KPIs to show customers (uptime, savings, productivity gains, parts coverage)
8. AI AGENT RECOMMENDATIONS: Automated agents for opportunity detection, maintenance scheduling, commercial offers, parts reorder triggers
9. CONTRACT PROFITABILITY: Margin analysis, risk assessment, tier optimization, parts cost impact on contract economics
10. BUDGET GAP CONTRIBUTION: For each opportunity, specify which budget segment (product/region/KAM) it helps close and by how much

Return structured JSON with the exact fields requested. Be specific with numbers and actionable recommendations.
Always identify at least 5 revenue opportunities and 5 actionable recommendations.
When spare parts data is available, specifically analyze parts bundling opportunities, consumption forecasts, and dynamic pricing potential.
When budget gap analysis is available, rank ALL opportunities by their contribution to closing the largest gaps.`;

    let userPrompt = '';
    
    if (analysisType === 'full_diagnostic') {
      userPrompt = `Perform a complete After-Sales Engine diagnostic:

## Installed Base Assets
${JSON.stringify(assets || [], null, 2)}

## Service Contracts
${JSON.stringify(contracts || [], null, 2)}

## Service Interventions
${JSON.stringify(interventions || [], null, 2)}

## Spare Parts Inventory
${JSON.stringify(spareParts || [], null, 2)}

## Company Context
${JSON.stringify(companyContext || {}, null, 2)}

## Budget Gap Analysis (PRIORITIZATION DRIVER)
${budgetGapAnalysis ? JSON.stringify(budgetGapAnalysis, null, 2) : "No budget gap data available"}

Return JSON with:
{
  "installedBaseHealth": {
    "totalAssets": number,
    "connectedPct": number,
    "lifecycleDistribution": { "commissioning": number, "active": number, "midLife": number, "endOfLife": number },
    "riskSegmentation": { "high": number, "medium": number, "low": number },
    "coverageGaps": ["string"],
    "recommendations": ["string"]
  },
  "serviceMaturity": {
    "currentLevel": "reactive|preventive|predictive|prescriptive",
    "maturityScore": number,
    "reactiveRatio": number,
    "predictiveRatio": number,
    "remoteServiceRatio": number,
    "contractPenetration": number,
    "recommendations": ["string"]
  },
  "revenueOpportunities": [
    { "type": "upsell|cross-sell|renewal|upgrade|spare-parts|new-contract|parts-bundling|tier-upgrade", "title": "string", "description": "string", "estimatedValue": number, "probability": number, "triggerSignal": "string", "recommendedAction": "string", "urgency": "high|medium|low", "budgetGapContribution": { "targetSegment": "string", "segmentType": "product_family|region|kam", "gapClosureAmount": number, "gapClosurePct": number } }
  ],
  "sparePartsIntelligence": {
    "totalInventoryValue": number,
    "criticalLowStock": number,
    "avgMargin": number,
    "bundlingOpportunities": [{ "partName": "string", "suggestedContract": "string", "estimatedRevenueImpact": number }],
    "pricingOptimizations": [{ "partName": "string", "currentPrice": number, "suggestedPrice": number, "reason": "string" }],
    "demandForecasts": [{ "partName": "string", "currentDemand": number, "predictedDemand": number, "trend": "string" }]
  },
  "productizationAdvice": [
    { "packageName": "string", "type": "uptime-guarantee|performance-contract|subscription|full-care|monitoring|parts-inclusive", "description": "string", "targetSegment": "string", "estimatedAnnualRevenue": number, "pricingModel": "string", "partsComponent": "string" }
  ],
  "recurringRevenueAnalysis": {
    "currentARR": number,
    "potentialARR": number,
    "partsRevenueContribution": number,
    "subscriptionMix": { "basic": number, "advanced": number, "premium": number },
    "churnRiskAccounts": ["string"],
    "growthLevers": ["string"]
  },
  "valueMetrics": {
    "avgUptime": number,
    "avgResponseTime": number,
    "costSavingsDelivered": number,
    "customerSatisfactionIndicators": ["string"]
  },
  "aiAgentRecommendations": [
    { "agentType": "opportunity|maintenance|commercial|customer-success|parts-reorder|contract-renewal", "action": "string", "expectedImpact": "string", "priority": "high|medium|low" }
  ],
  "executiveSummary": "string"
}`;
    } else if (analysisType === 'contract_analysis') {
      userPrompt = `Analyze a service contract being built:

## Contract Definition
${JSON.stringify(contractDef || {}, null, 2)}

## Bundled Spare Parts
${JSON.stringify(bundledParts || [], null, 2)}

## Pricing Configuration
${JSON.stringify(pricing || {}, null, 2)}

## Existing Contracts for Reference
${JSON.stringify(contracts || [], null, 2)}

## Available Assets
${JSON.stringify(assets || [], null, 2)}

## Spare Parts Context
${JSON.stringify(spareParts || [], null, 2)}

Analyze this contract and return JSON with:
{
  "executiveSummary": "Overall assessment of contract viability, pricing competitiveness, and risk",
  "revenueOpportunities": [
    { "type": "tier-upgrade|parts-bundling|add-on|cross-sell", "title": "string", "description": "string", "estimatedValue": number, "recommendedAction": "string", "urgency": "high|medium|low" }
  ],
  "productizationAdvice": [
    { "packageName": "string", "type": "string", "description": "string", "pricingModel": "string", "estimatedAnnualRevenue": number }
  ],
  "aiAgentRecommendations": [
    { "agentType": "commercial|parts-reorder|contract-renewal|pricing", "action": "string", "expectedImpact": "string", "priority": "high|medium|low" }
  ],
  "riskFactors": ["string"],
  "pricingRecommendation": { "suggestedPrice": number, "rationale": "string", "competitivePosition": "string" },
  "partsConsumptionForecast": { "totalAnnualCost": number, "coverageAdequacy": "string", "suggestions": ["string"] }
}`;
    } else if (analysisType === 'opportunity_scan') {
      userPrompt = `Scan for after-sales revenue opportunities:

## Assets: ${JSON.stringify(assets || [])}
## Contracts: ${JSON.stringify(contracts || [])}
## Interventions: ${JSON.stringify(interventions || [])}
## Spare Parts: ${JSON.stringify(spareParts || [])}

Return JSON with:
{
  "opportunities": [
    { "type": "string", "title": "string", "description": "string", "estimatedValue": number, "probability": number, "triggerSignal": "string", "recommendedAction": "string", "urgency": "high|medium|low", "customerName": "string" }
  ],
  "totalPipelineValue": number,
  "topPriorityActions": ["string"]
}`;
    } else {
      userPrompt = `Analyze service productization potential:

## Company: ${JSON.stringify(companyContext || {})}
## Current Contracts: ${JSON.stringify(contracts || [])}
## Assets: ${JSON.stringify(assets || [])}
## Spare Parts: ${JSON.stringify(spareParts || [])}

Return JSON with:
{
  "packages": [
    { "packageName": "string", "tier": "basic|advanced|premium|full-care", "description": "string", "includes": ["string"], "pricingModel": "string", "estimatedPrice": number, "targetSegment": "string", "partsIncluded": boolean }
  ],
  "recurringRevenueModel": { "currentState": "string", "targetState": "string", "transitionSteps": ["string"] },
  "recommendations": ["string"]
}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI analysis failed");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    let analysis;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content);
    } catch {
      analysis = { executiveSummary: content, error: "Could not parse structured response" };
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("after-sales-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
