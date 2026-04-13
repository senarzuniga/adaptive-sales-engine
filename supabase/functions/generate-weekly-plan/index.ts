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

    const { companyProfile, ordersData, opportunitiesData, strategyData, productsData, existingTasks, weekNotes, budgetGapAnalysis } = await req.json();

    const systemPrompt = `You are an expert B2B sales consultant and augmented sales planner. Your PRIMARY OBJECTIVE is to maximize budget achievement — closing the gap between actual revenue and strategic targets.

## CORE PRIORITIZATION PRINCIPLE
Every task you generate must be evaluated against: "How much does this contribute to closing the budget gap?"

The budget gap analysis below shows EXACTLY where revenue is missing — by product family, region, and KAM. 
Tasks that address the LARGEST GAPS with the HIGHEST probability of closing must be ranked HIGHEST.

## PRIORITIZATION HIERARCHY (strict order)
1. **CRITICAL**: Actions targeting segments with >30% budget gap AND high-value pipeline opportunities
2. **HIGH**: Actions targeting segments with >15% budget gap OR high-probability deals in underperforming areas
3. **MEDIUM**: Actions maintaining momentum in on-track segments or building future pipeline
4. **LOW**: Administrative, data collection, or long-term strategic actions

## BUDGET-DRIVEN TASK WEIGHTING
- Each task MUST include a "budgetImpactScore" (0-100) indicating how much it contributes to closing the budget gap
- Each task MUST include "targetSegment" identifying which product_family / region / KAM gap it addresses
- Each task MUST include "estimatedRevenueImpact" — the € value this task could influence

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

Output JSON via the tool call with an array of 10-15 tasks, sorted by budgetImpactScore descending.`;

    const userPrompt = `Generate a weekly action plan for this company, DRIVEN BY BUDGET ACHIEVEMENT:

COMPANY PROFILE:
- Name: ${companyProfile?.company_name || "Unknown"}
- Industry: ${companyProfile?.industry || "Unknown"}
- Challenges: ${companyProfile?.current_challenges || "Not specified"}
- Strategic Goals: ${companyProfile?.strategic_goals || "Not specified"}
- Sales Channels: ${companyProfile?.sales_channels || ""}
- Customer Segments: ${companyProfile?.main_customer_segments || ""}
- Products: ${companyProfile?.main_products || ""}

═══════════════════════════════════════════════
BUDGET GAP ANALYSIS (PRIMARY DECISION DRIVER)
═══════════════════════════════════════════════
${budgetGapAnalysis || "No budget gap data available — use pipeline and strategy data to infer gaps."}

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

INSTRUCTIONS:
1. FIRST analyze the budget gaps — which product families, regions, and KAMs are furthest from target
2. THEN generate 10-15 tasks that MAXIMIZE budget gap closure
3. At least 50% of tasks must directly target the top 3 underperforming segments
4. Each task must quantify its expected revenue impact
5. Cover ALL 7 pillars (p0-p6) — at least 1 task per pillar
6. Sort tasks by budgetImpactScore descending
7. Set realistic due dates (within the next 7 days from today: ${new Date().toISOString().split('T')[0]})`;

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
              description: "Generate a budget-achievement-driven weekly action plan",
              parameters: {
                type: "object",
                properties: {
                  weekSummary: { type: "string", description: "Brief analysis of the budget situation — overall achievement %, top gaps, and strategic priorities for the week" },
                  overallBudgetAchievement: { type: "number", description: "Current overall budget achievement percentage" },
                  topGaps: {
                    type: "array",
                    description: "Top 5 budget gaps driving task prioritization",
                    items: {
                      type: "object",
                      properties: {
                        segment: { type: "string", description: "Product family, region, or KAM name" },
                        segmentType: { type: "string", enum: ["product_family", "region", "kam"] },
                        targetRevenue: { type: "number" },
                        actualRevenue: { type: "number" },
                        gapAmount: { type: "number" },
                        gapPct: { type: "number" },
                        pipelineCoverage: { type: "number", description: "Pipeline value available to close this gap" },
                      },
                      required: ["segment", "segmentType", "gapAmount", "gapPct"],
                      additionalProperties: false,
                    },
                  },
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
                        rationale: { type: "string", description: "Why this task matters for budget achievement" },
                        budgetImpactScore: { type: "number", description: "0-100 score of how much this task contributes to closing budget gaps" },
                        targetSegment: { type: "string", description: "Which product_family / region / KAM gap this addresses" },
                        estimatedRevenueImpact: { type: "number", description: "Estimated € revenue this task could influence" },
                      },
                      required: ["title", "description", "pillar", "priority", "category", "dueDate", "rationale", "budgetImpactScore", "targetSegment", "estimatedRevenueImpact"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["weekSummary", "overallBudgetAchievement", "topGaps", "tasks"],
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
