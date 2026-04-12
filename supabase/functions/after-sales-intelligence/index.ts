import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assets, contracts, interventions, companyContext, analysisType } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert After-Sales Revenue Intelligence system for industrial B2B companies (OEMs, machinery, equipment).

You analyze installed base data, service contracts, and intervention history to provide:

1. INSTALLED BASE HEALTH: Asset coverage, connectivity, lifecycle distribution, risk segments
2. SERVICE MATURITY: Reactive vs predictive ratio, contract penetration, remote service adoption
3. REVENUE OPPORTUNITIES: Upsell, cross-sell, contract upgrades, spare parts, lifecycle timing
4. PRODUCTIZATION RECOMMENDATIONS: How to package services as products (uptime guarantees, performance contracts, subscriptions)
5. RECURRING REVENUE ANALYSIS: Subscription mix, MRR/ARR potential, churn risk
6. VALUE DEMONSTRATION: KPIs to show customers (uptime, savings, productivity gains)
7. AI AGENT RECOMMENDATIONS: What automated agents should do (opportunity detection, maintenance scheduling, commercial offers)

Return structured JSON with the exact fields requested. Be specific with numbers and actionable recommendations.
Always identify at least 5 revenue opportunities and 5 actionable recommendations.`;

    let userPrompt = '';
    
    if (analysisType === 'full_diagnostic') {
      userPrompt = `Perform a complete After-Sales Engine diagnostic:

## Installed Base Assets
${JSON.stringify(assets || [], null, 2)}

## Service Contracts
${JSON.stringify(contracts || [], null, 2)}

## Service Interventions
${JSON.stringify(interventions || [], null, 2)}

## Company Context
${JSON.stringify(companyContext || {}, null, 2)}

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
    { "type": "upsell|cross-sell|renewal|upgrade|spare-parts|new-contract", "title": "string", "description": "string", "estimatedValue": number, "probability": number, "triggerSignal": "string", "recommendedAction": "string", "urgency": "high|medium|low" }
  ],
  "productizationAdvice": [
    { "packageName": "string", "type": "uptime-guarantee|performance-contract|subscription|full-care|monitoring", "description": "string", "targetSegment": "string", "estimatedAnnualRevenue": number, "pricingModel": "string" }
  ],
  "recurringRevenueAnalysis": {
    "currentARR": number,
    "potentialARR": number,
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
    { "agentType": "opportunity|maintenance|commercial|customer-success", "action": "string", "expectedImpact": "string", "priority": "high|medium|low" }
  ],
  "executiveSummary": "string"
}`;
    } else if (analysisType === 'opportunity_scan') {
      userPrompt = `Scan for after-sales revenue opportunities:

## Assets: ${JSON.stringify(assets || [])}
## Contracts: ${JSON.stringify(contracts || [])}
## Interventions: ${JSON.stringify(interventions || [])}

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

Return JSON with:
{
  "packages": [
    { "packageName": "string", "tier": "basic|advanced|premium|full-care", "description": "string", "includes": ["string"], "pricingModel": "string", "estimatedPrice": number, "targetSegment": "string" }
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
