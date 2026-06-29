import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { companyProfile, ordersData, opportunitiesData, strategyData, analysisType } = await req.json();

    const systemPrompt = `You are an expert commercial portfolio analyst for ${companyProfile?.company_name || "the company"}.
You analyze customer portfolios, identify concentration risks, segment customers, and provide strategic insights.

CRITICAL: The "Consultant Insights" below are manually entered by a senior consultant and are the MOST RELIABLE source. Use them as the primary benchmark for all analysis.

COMPANY CONTEXT:
- Name: ${companyProfile?.company_name || "Unknown"}
- Industry: ${companyProfile?.industry || "Unknown"}
- Sub-sector: ${companyProfile?.sub_sector || "Not specified"}
- Products: ${companyProfile?.main_products || "Not specified"}
- Customer Segments: ${companyProfile?.main_customer_segments || ""}
- Operating Regions: ${companyProfile?.operating_regions || ""}
- Strategic Goals: ${companyProfile?.strategic_goals || ""}
- Challenges: ${companyProfile?.current_challenges || ""}
- Annual Revenue: ${companyProfile?.annual_revenue || "Not specified"}
- Sales Channels: ${companyProfile?.sales_channels || "Not specified"}

CONSULTANT INSIGHTS (PRIMARY SOURCE):
- Business Description: ${companyProfile?.business_description || "Not provided"}
- Strategy Context: ${companyProfile?.strategy_context || "Not provided"}
- Market Context: ${companyProfile?.market_context || "Not provided"}
- Objectives: ${companyProfile?.objectives || "Not provided"}
- Additional Notes: ${companyProfile?.additional_notes || "Not provided"}

ORDERS DATA (Sales History):
${ordersData || "No order data available"}

PIPELINE DATA:
${opportunitiesData || "No pipeline data available"}

STRATEGY TARGETS:
${strategyData || "No strategy data available"}

Use the tool to return structured analysis.`;

    const userPrompt = analysisType === 'segmentation'
      ? `Perform a deep customer segmentation analysis. Classify customers into strategic segments based on:
1. Revenue contribution (top, mid, tail)
2. Geographic scope (global vs local/regional)
3. Growth trajectory (growing, stable, declining based on year-over-year data)
4. Product diversity (single-product vs multi-product buyers)
5. Strategic alignment with company goals

For GLOBAL customers: analyze how they adapt business across regions, identify cross-region patterns.
For LOCAL customers: identify country-specific insights and business drivers.

Provide actionable recommendations for each segment.`
      : analysisType === 'risk'
      ? `Perform a portfolio risk analysis focusing on:
1. Revenue concentration - Pareto analysis (what % of customers drive 80% of revenue)
2. Risk level assessment (high/medium/low) based on concentration
3. Customer dependency risks
4. Geographic concentration risks
5. Product family concentration risks
6. Recommendations for risk mitigation and portfolio diversification`
      : `Provide comprehensive portfolio insights including:
1. Key customer trends and patterns
2. Revenue distribution analysis
3. Growth opportunities by segment and region
4. Strategic gaps and recommendations
5. Priority actions for portfolio optimization`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "portfolio_analysis",
              description: "Return structured portfolio analysis results",
              parameters: {
                type: "object",
                properties: {
                  riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Overall portfolio risk level" },
                  riskScore: { type: "number", description: "Risk score 0-100 (100 = highest risk)" },
                  concentrationSummary: { type: "string", description: "Summary of revenue concentration" },
                  paretoInsight: { type: "string", description: "Key insight from Pareto analysis (e.g., '5 customers = 78% revenue')" },
                  segments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Segment name" },
                        description: { type: "string", description: "Segment description" },
                        customerCount: { type: "number" },
                        revenueShare: { type: "string", description: "% of total revenue" },
                        riskLevel: { type: "string", enum: ["low", "medium", "high"] },
                        trend: { type: "string", enum: ["growing", "stable", "declining"] },
                        recommendations: { type: "array", items: { type: "string" } },
                      },
                      required: ["name", "description", "customerCount", "revenueShare", "riskLevel", "trend", "recommendations"],
                      additionalProperties: false,
                    },
                  },
                  globalCustomerInsights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        customerName: { type: "string" },
                        regions: { type: "array", items: { type: "string" } },
                        insight: { type: "string" },
                        opportunity: { type: "string" },
                      },
                      required: ["customerName", "regions", "insight", "opportunity"],
                      additionalProperties: false,
                    },
                  },
                  localMarketInsights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        country: { type: "string" },
                        keyDrivers: { type: "string" },
                        topCustomers: { type: "array", items: { type: "string" } },
                        recommendation: { type: "string" },
                      },
                      required: ["country", "keyDrivers", "topCustomers", "recommendation"],
                      additionalProperties: false,
                    },
                  },
                  strategicRecommendations: { type: "array", items: { type: "string" } },
                  priorityActions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        impact: { type: "string" },
                        timeline: { type: "string" },
                      },
                      required: ["action", "priority", "impact", "timeline"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["riskLevel", "riskScore", "concentrationSummary", "paretoInsight", "segments", "globalCustomerInsights", "localMarketInsights", "strategicRecommendations", "priorityActions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "portfolio_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-portfolio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
