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

    const { companyProfile, ordersData, opportunitiesData, strategyData, productsData, existingTasks, weekNotes } = await req.json();

    const systemPrompt = `You are an expert B2B sales consultant and augmented sales planner. You analyze company data, strategy gaps, customer patterns, and pillar priorities to generate a weekly action plan.

You MUST cover ALL 7 transformation pillars in your recommendations:
- p0: 360º Analysis — results analysis, patterns, portfolio risk, strategic alignment
- p1: Sales Architecture — scalable structures, segmentation, channels, pricing, opportunity management
- p2: Key Account Management — strategic account mapping, stakeholder analysis, value creation
- p3: After-Sales Engine — service contracts, spare parts, lifecycle revenue, predictive maintenance
- p4: AI-Augmented Sales — AI-supported research, qualification, forecasting, activity prioritization
- p5: Behavioral Transformation — transform reactive to proactive teams, coaching, incentives
- p6: Product Strategy — product lifecycle positioning, innovation vs commodity, market fit

For each task you generate, choose the most appropriate category:
- loyalty: Customer retention calls, relationship nurturing
- cross_sell: Cross-selling or upselling opportunities
- follow_up: Follow-up on pending deals, quotes, or conversations
- analysis: Data analysis, market research, competitive intelligence
- strategy: Strategic planning, roadmap alignment, goal review
- meeting: Scheduled meetings, presentations, demos
- report: Reporting, documentation, dashboards
- data: Data collection, cleanup, CRM updates

Output JSON via the tool call with an array of 10-15 tasks, each covering different pillars and priorities.`;

    const userPrompt = `Generate a weekly action plan for this company:

COMPANY PROFILE:
- Name: ${companyProfile?.company_name || "Unknown"}
- Industry: ${companyProfile?.industry || "Unknown"}
- Challenges: ${companyProfile?.current_challenges || "Not specified"}
- Strategic Goals: ${companyProfile?.strategic_goals || "Not specified"}
- Sales Channels: ${companyProfile?.sales_channels || ""}
- Customer Segments: ${companyProfile?.main_customer_segments || ""}
- Products: ${companyProfile?.main_products || ""}

SALES DATA SUMMARY:
${ordersData || "No orders data available"}

PIPELINE SUMMARY:
${opportunitiesData || "No pipeline data available"}

STRATEGY TARGETS:
${strategyData || "No strategy targets defined"}

PRODUCT PORTFOLIO:
${productsData || "No product data available"}

EXISTING TASKS (avoid duplicates):
${existingTasks || "No existing tasks"}

CONSULTANT NOTES FOR THIS WEEK:
${weekNotes || "No additional notes"}

Generate 10-15 specific, actionable tasks that:
1. Cover ALL 7 pillars (p0-p6) — at least 1 task per pillar
2. Prioritize based on urgency and strategic impact
3. Include loyalty calls to top customers at risk
4. Identify cross-selling opportunities from data patterns
5. Address strategy gaps between targets and actuals
6. Include follow-ups on high-value opportunities
7. Plan proactive actions for each pillar
8. Set realistic due dates (within the next 7 days from today: ${new Date().toISOString().split('T')[0]})`;

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
              name: "generate_weekly_plan",
              description: "Generate a weekly action plan with tasks across all pillars",
              parameters: {
                type: "object",
                properties: {
                  weekSummary: { type: "string", description: "Brief analysis of the current situation and priorities for the week" },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        pillar: { type: "string", enum: ["p0", "p1", "p2", "p3", "p4", "p5", "p6"] },
                        priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        category: { type: "string", enum: ["analysis", "follow_up", "loyalty", "cross_sell", "strategy", "data", "meeting", "report"] },
                        dueDate: { type: "string", description: "ISO date string" },
                        rationale: { type: "string", description: "Why this task matters strategically" },
                      },
                      required: ["title", "description", "pillar", "priority", "category", "dueDate", "rationale"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["weekSummary", "tasks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_weekly_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
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
    console.error("generate-weekly-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
