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

    const { type, task, companyProfile, contextData } = await req.json();

    // type: "generate" | "analyze"
    let systemPrompt = "";
    let userPrompt = "";

    if (type === "generate") {
      systemPrompt = `You are an expert B2B sales consultant and augmented sales assistant. You help sales representatives prepare for commercial actions with maximum effectiveness.

Your role:
- Generate highly specific, personalized content for sales actions
- Align all content with the company's commercial strategy and pillar objectives
- Use the company profile, customer data, and strategic context to personalize everything
- Be practical, actionable, and professional
- Always consider the specific pillar strategy when generating content

Output JSON with these fields:
{
  "goal": "A clear, measurable action objective with success criteria",
  "callScript": "A complete call/conversation script with opening, talking points, objection handling, and closing",
  "emailTemplate": "A professional email with subject, body, and CTA personalized to the context",
  "presentationNotes": "Meeting agenda, key slides outline, materials to prepare, and talking points"
}`;

      const pillarContext: Record<string, string> = {
        general: "General commercial activity",
        p0: "360º Analysis: Focus on comprehensive results analysis, patterns, portfolio risk, and strategic alignment",
        p1: "Sales Architecture: Focus on scalable sales structures, segmentation, channels, pricing, opportunity management",
        p2: "Key Account Management: Focus on strategic account mapping, stakeholder analysis, value creation plans",
        p3: "After-Sales Engine: Focus on service contracts, spare parts, lifecycle revenue, predictive maintenance",
        p4: "AI-Augmented Sales: Focus on AI-supported research, qualification, forecasting, activity prioritization",
        p5: "Behavioral Transformation: Focus on transforming reactive teams to proactive, coaching, incentives, cultural change",
        p6: "Product Strategy: Focus on product lifecycle positioning, innovation vs commodity, market fit analysis",
      };

      userPrompt = `Generate action content for the following task:

TASK DETAILS:
- Title: ${task.title}
- Description: ${task.description}
- Category: ${task.category}
- Pillar: ${task.pillar} — ${pillarContext[task.pillar] || "General"}
- Priority: ${task.priority}
- Assignee: ${task.assignee || "Not assigned"}

COMPANY PROFILE:
- Company: ${companyProfile?.company_name || "Unknown"}
- Industry: ${companyProfile?.industry || "Unknown"}
- Sub-sector: ${companyProfile?.sub_sector || ""}
- Headquarters: ${companyProfile?.headquarters || ""}
- Operating Regions: ${companyProfile?.operating_regions || ""}
- Annual Revenue: ${companyProfile?.annual_revenue || ""}
- Main Products: ${companyProfile?.main_products || ""}
- Customer Segments: ${companyProfile?.main_customer_segments || ""}
- Competitors: ${companyProfile?.main_competitors || ""}
- Sales Channels: ${companyProfile?.sales_channels || ""}
- Current Challenges: ${companyProfile?.current_challenges || ""}
- Strategic Goals: ${companyProfile?.strategic_goals || ""}

CONSULTANT INSIGHTS (PRIMARY SOURCE — highest reliability):
- Business Description: ${companyProfile?.business_description || "Not provided"}
- Strategy Context: ${companyProfile?.strategy_context || "Not provided"}
- Market Context: ${companyProfile?.market_context || "Not provided"}
- Objectives: ${companyProfile?.objectives || "Not provided"}
- Additional Notes: ${companyProfile?.additional_notes || "Not provided"}

CONTEXTUAL DATA:
${contextData?.topCustomers ? `Top Customers by Revenue: ${contextData.topCustomers}` : ""}
${contextData?.topProducts ? `Top Product Families: ${contextData.topProducts}` : ""}
${contextData?.pipelineValue ? `Pipeline Value: ${contextData.pipelineValue}` : ""}
${contextData?.strategyTargets ? `Strategy Targets: ${contextData.strategyTargets}` : ""}

Generate highly specific, personalized content. Do NOT use generic placeholders — fill in with real data from the context provided.`;

    } else if (type === "analyze") {
      systemPrompt = `You are an expert B2B sales strategy analyst and augmented sales advisor. You analyze the results of commercial actions and provide strategic recommendations.

Your role:
- Evaluate action outcomes against the defined goals and strategic objectives
- Assess alignment with the company's commercial strategy and pillar priorities
- Identify gaps, risks, and opportunities from the result
- Provide specific, actionable next-step recommendations
- Consider urgency, strategic importance, and customer relationship dynamics

Output JSON with these fields:
{
  "aiAnalysis": "A detailed analysis of the result vs the goal and strategy (2-4 sentences)",
  "alignmentScore": <number 0-100 representing strategic alignment>,
  "recommendations": ["Array of 3-5 specific, actionable next-step recommendations"]
}`;

      userPrompt = `Analyze this action result:

TASK: ${task.title}
CATEGORY: ${task.category}
PILLAR: ${task.pillar}
PRIORITY: ${task.priority}

DEFINED GOAL:
${task.actionContent?.goal || "No goal defined"}

ACTION RESULT:
${task.resultText}

COMPANY CONTEXT:
- Company: ${companyProfile?.company_name || "Unknown"}
- Industry: ${companyProfile?.industry || "Unknown"}
- Strategic Goals: ${companyProfile?.strategic_goals || "Not defined"}
- Current Challenges: ${companyProfile?.current_challenges || "Not defined"}

Provide a thorough analysis considering the strategic context, urgency based on priority, and alignment with the ${task.pillar} pillar objectives.`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        tools: [
          {
            type: "function",
            function: {
              name: type === "generate" ? "generate_content" : "analyze_result",
              description: type === "generate"
                ? "Generate action content for a sales task"
                : "Analyze the result of a sales action",
              parameters: type === "generate"
                ? {
                    type: "object",
                    properties: {
                      goal: { type: "string" },
                      callScript: { type: "string" },
                      emailTemplate: { type: "string" },
                      presentationNotes: { type: "string" },
                    },
                    required: ["goal", "callScript", "emailTemplate", "presentationNotes"],
                    additionalProperties: false,
                  }
                : {
                    type: "object",
                    properties: {
                      aiAnalysis: { type: "string" },
                      alignmentScore: { type: "number" },
                      recommendations: { type: "array", items: { type: "string" } },
                    },
                    required: ["aiAnalysis", "alignmentScore", "recommendations"],
                    additionalProperties: false,
                  },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: type === "generate" ? "generate_content" : "analyze_result" },
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    console.error("generate-action-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
