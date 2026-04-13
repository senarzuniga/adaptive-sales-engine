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

You receive pre-aggregated data summaries. Your job is to:
1. Identify the TOP 5-7 critical insights from the data
2. Provide an executive summary (2-3 paragraphs)
3. Detect patterns, risks, and opportunities
4. Give prioritized strategic recommendations
5. Assign a strategic health score (0-100)

Be direct, actionable, and specific. No filler. Reference actual numbers from the data.
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
