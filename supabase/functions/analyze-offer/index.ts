import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { costBreakdown, offerContext, companyContext, historicalData, companyRates } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a senior Costing and Pricing Manager specialized in preparing accurate, profitable, and risk-controlled commercial offers for B2B machinery/industrial projects.

Your mission is to ensure that EVERY offer:
- Reflects real costs (no underestimation)
- Includes all applicable rates and indirect costs
- Protects the expected margin
- Identifies risks and uncertainties
- Is competitive but financially safe

CORE PRINCIPLE: "An offer is only valid if it guarantees profitability under realistic execution conditions." Never prioritize winning a deal over protecting margin.

COST STRUCTURE VALIDATION:
You must verify that all offers include:
1. Direct Costs: Labour (real rates), Materials, Machines/production
2. Indirect Costs: Overhead rates, Support functions
3. External Costs: Freight/logistics, Insurance (liability, transport, currency), Subcontracting
4. Risk Adjustments: Contingencies, Uncertainty factors, Project complexity
5. Margin: Minimum threshold, Target margin, Risk-adjusted margin

RATE VALIDATION (CRITICAL):
- Validate that labour rates, overhead rates, machine rates, efficiency rates, risk factor rates, and margin rates are realistic
- Flag ANY missing rate category
- Compare applied rates against company-configured rates if provided
- Detect underestimated productivity assumptions

You analyze offer cost structures and provide:
1. THREE scenarios: conservative (high costs, low margin), base, and optimized (efficient costs, high margin)
2. Multi-dimensional scoring: margin score, risk score, global score (0-100)
3. Risk detection: underestimated engineering, installation costs, logistics variability, missing indirect costs, missing insurance, missing contingencies
4. Pricing recommendations: cost-plus, value-based, benchmarking approaches
5. Profitability control: minimum margin scenario, risk-adjusted margin
6. Actionable optimization suggestions

CRITICAL RULES:
- Always generate exactly 3 scenarios with concrete numbers
- Score margin, risk, and global on a 0-100 scale
- Identify at least 3 risk factors
- NEVER ignore indirect costs — flag if missing
- NEVER assume ideal productivity
- ALWAYS include contingencies
- ALWAYS justify margin
- If data is incomplete, propose ranges and indicate impact on margin
- Never return a single solution without comparison
- Detect outliers and inconsistencies in cost ratios

Return a JSON object with this exact structure:
{
  "scenarios": [
    { "type": "conservative", "totalCost": number, "sellingPrice": number, "marginAmount": number, "marginPct": number, "riskLevel": "high|medium|low", "adjustments": "description" },
    { "type": "base", "totalCost": number, "sellingPrice": number, "marginAmount": number, "marginPct": number, "riskLevel": "high|medium|low", "adjustments": "description" },
    { "type": "optimized", "totalCost": number, "sellingPrice": number, "marginAmount": number, "marginPct": number, "riskLevel": "high|medium|low", "adjustments": "description" }
  ],
  "scoring": {
    "marginScore": "high|medium|low",
    "marginValue": number,
    "riskScore": "high|medium|low",
    "riskValue": number,
    "globalScore": number,
    "explanation": "string"
  },
  "riskFactors": [
    { "category": "string", "description": "string", "severity": "high|medium|low", "impact": "string" }
  ],
  "recommendations": [
    { "type": "cost_reduction|margin_improvement|risk_mitigation|pricing|rate_validation", "title": "string", "description": "string", "estimatedImpact": "string" }
  ],
  "costAnalysis": {
    "materialsRatio": number,
    "engineeringRatio": number,
    "installationRatio": number,
    "subcontractingRatio": number,
    "transportRatio": number,
    "indirectRatio": number,
    "missingCategories": ["string"],
    "rateValidation": [{ "rateName": "string", "applied": number, "expected": number, "deviation": "string" }],
    "alerts": ["string"]
  },
  "pricingStrategies": {
    "costPlus": { "price": number, "margin": number },
    "valueBased": { "price": number, "margin": number, "rationale": "string" },
    "benchmarking": { "price": number, "margin": number, "rationale": "string" }
  },
  "profitabilityControl": {
    "minimumMarginScenario": { "margin": number, "conditions": "string" },
    "riskAdjustedMargin": { "margin": number, "adjustments": "string" },
    "belowThreshold": boolean,
    "correctiveActions": ["string"]
  }
}`;

    const userPrompt = `Analyze this offer and provide complete pricing intelligence:

## Cost Breakdown
${JSON.stringify(costBreakdown, null, 2)}

## Offer Context
${JSON.stringify(offerContext, null, 2)}

${companyContext ? `## Company Context\n${JSON.stringify(companyContext, null, 2)}` : ''}

${companyRates ? `## Company Configured Rates (VALIDATE AGAINST THESE)\n${JSON.stringify(companyRates, null, 2)}` : ''}

${historicalData ? `## Historical Data\n${JSON.stringify(historicalData, null, 2)}` : ''}

Provide your analysis as the specified JSON structure.`;

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
        tools: [{
          type: "function",
          function: {
            name: "offer_analysis",
            description: "Return complete offer analysis with scenarios, scoring, risks and recommendations",
            parameters: {
              type: "object",
              properties: {
                scenarios: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["conservative", "base", "optimized"] },
                      totalCost: { type: "number" },
                      sellingPrice: { type: "number" },
                      marginAmount: { type: "number" },
                      marginPct: { type: "number" },
                      riskLevel: { type: "string", enum: ["high", "medium", "low"] },
                      adjustments: { type: "string" }
                    },
                    required: ["type", "totalCost", "sellingPrice", "marginAmount", "marginPct", "riskLevel"]
                  }
                },
                scoring: {
                  type: "object",
                  properties: {
                    marginScore: { type: "string", enum: ["high", "medium", "low"] },
                    marginValue: { type: "number" },
                    riskScore: { type: "string", enum: ["high", "medium", "low"] },
                    riskValue: { type: "number" },
                    globalScore: { type: "number" },
                    explanation: { type: "string" }
                  },
                  required: ["marginScore", "riskScore", "globalScore", "explanation"]
                },
                riskFactors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      description: { type: "string" },
                      severity: { type: "string", enum: ["high", "medium", "low"] },
                      impact: { type: "string" }
                    },
                    required: ["category", "description", "severity"]
                  }
                },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["cost_reduction", "margin_improvement", "risk_mitigation", "pricing", "rate_validation"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      estimatedImpact: { type: "string" }
                    },
                    required: ["type", "title", "description"]
                  }
                },
                costAnalysis: {
                  type: "object",
                  properties: {
                    materialsRatio: { type: "number" },
                    engineeringRatio: { type: "number" },
                    installationRatio: { type: "number" },
                    subcontractingRatio: { type: "number" },
                    transportRatio: { type: "number" },
                    indirectRatio: { type: "number" },
                    alerts: { type: "array", items: { type: "string" } }
                  }
                },
                pricingStrategies: {
                  type: "object",
                  properties: {
                    costPlus: { type: "object", properties: { price: { type: "number" }, margin: { type: "number" } } },
                    valueBased: { type: "object", properties: { price: { type: "number" }, margin: { type: "number" }, rationale: { type: "string" } } },
                    benchmarking: { type: "object", properties: { price: { type: "number" }, margin: { type: "number" }, rationale: { type: "string" } } }
                  }
                }
              },
              required: ["scenarios", "scoring", "riskFactors", "recommendations"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "offer_analysis" } },
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
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let analysis;
    if (toolCall?.function?.arguments) {
      analysis = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      const content = aiData.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content);
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-offer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
