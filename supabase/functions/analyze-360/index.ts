import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { companyProfile, ordersSummary, strategySummary, opportunitiesSummary, productsSummary } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a senior strategic business consultant (McKinsey/Bain level) generating an executive insight report for a company's 360º analysis.

## CRITICAL: CONSULTANT INSIGHTS ARE THE PRIMARY SOURCE OF TRUTH
The Company Profile section contains manually entered insights from a senior consultant who has worked directly with this company. These insights (business_description, strategic_goals, objectives, strategy_context, market_context, additional_notes, current_challenges) are the MOST RELIABLE data source.

You MUST:
- Cross-reference ALL quantitative data against the consultant's qualitative insights
- Use the consultant's stated revenue targets, business model descriptions, and strategic priorities as the benchmark
- Flag any discrepancies between the data and the consultant's notes (e.g., if pipeline data contradicts stated revenue targets)
- Incorporate the consultant's understanding of competitive positioning, market dynamics, and transformation goals into every recommendation
- Reference specific consultant insights when making recommendations

You receive pre-aggregated data summaries. Your job is to:
1. Build a 4-layer assessment: fact base → current state → target state → bridge plan
2. Identify the TOP 5-7 critical insights, anchored to the consultant's strategic context
3. Provide an executive summary (2-3 paragraphs) that reflects the company's stated transformation goals
4. Detect patterns, risks, and opportunities — especially gaps between current state and the consultant's target state
5. Diagnose root causes across revenue, margin, product mix, customer concentration, and commercial execution
6. Give prioritized strategic recommendations aligned with the stated objectives
7. Assign a strategic health score (0-100) measuring progress toward the consultant's defined goals

CRITICAL METRIC RULES:
- Strategy achievement means current confirmed performance versus target, not pipeline alone
- Weighted pipeline is only coverage potential and must be reported separately
- Never state that the strategy is achieved if actual sales are materially below the stated target
- Evaluate whether the current product mix and proposed commercial actions are sufficient to close the gap

Be direct, actionable, and specific. No filler. Reference actual numbers AND consultant insights.
All monetary values are in EUR unless stated otherwise.`;

    const userPrompt = `Analyze this company's 360º data and generate executive insights:

## Company Profile
${JSON.stringify(companyProfile, null, 2)}

## Orders Summary (aggregated)
${JSON.stringify(ordersSummary, null, 2)}

## Strategy Summary
${JSON.stringify(strategySummary, null, 2)}

## Pipeline/Opportunities Summary
${JSON.stringify(opportunitiesSummary, null, 2)}

## Products Summary
${JSON.stringify(productsSummary, null, 2)}

Generate a comprehensive executive insight report.`;

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
            name: "submit_executive_insights",
            description: "Submit the executive insight report",
            parameters: {
              type: "object",
              properties: {
                executive_summary: {
                  type: "string",
                  description: "2-3 paragraph executive summary with key findings"
                },
                health_score: {
                  type: "number",
                  description: "Overall strategic health score 0-100"
                },
                health_label: {
                  type: "string",
                  enum: ["Critical", "Weak", "Fair", "Good", "Strong", "Excellent"]
                },
                critical_insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      type: { type: "string", enum: ["risk", "opportunity", "pattern", "warning", "strength"] },
                      severity: { type: "string", enum: ["high", "medium", "low"] },
                      description: { type: "string" },
                      data_point: { type: "string", description: "Key number or metric supporting this insight" },
                    },
                    required: ["title", "type", "severity", "description"]
                  }
                },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      priority: { type: "string", enum: ["immediate", "short_term", "medium_term"] },
                      action: { type: "string" },
                      expected_impact: { type: "string" },
                      effort: { type: "string", enum: ["low", "medium", "high"] },
                    },
                    required: ["priority", "action", "expected_impact"]
                  }
                },
                portfolio_diagnosis: {
                  type: "string",
                  description: "Brief diagnosis of portfolio health and concentration"
                },
                growth_outlook: {
                  type: "string",
                  description: "Assessment of growth trajectory"
                },
                key_risks: {
                  type: "array",
                  items: { type: "string" }
                },
              },
              required: ["executive_summary", "health_score", "health_label", "critical_insights", "recommendations"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_executive_insights" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let insights: any = {};

    if (toolCall?.function?.arguments) {
      insights = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    }

    return new Response(JSON.stringify({ success: true, insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("360-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
