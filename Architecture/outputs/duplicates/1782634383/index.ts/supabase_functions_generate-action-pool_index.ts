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

    const { companyProfile, opportunities, orders, strategy, tasks, teamMembers } = await req.json();

    const existingTitles = (tasks || []).map((t: any) => t.title).join("; ");
    
    const oppSummary = (opportunities || []).map((o: any) => 
      `${o.customerName || 'Unknown'}: ${o.productFamily || ''}, €${o.estRevenue || 0}, prob=${o.contractProb || 0}%, margin=${o.margin || 0}%, status=${o.status || ''}, KAM=${o.kam || ''}, region=${o.region || ''}`
    ).join("\n");

    const orderSummary = (orders || []).slice(0, 30).map((o: any) =>
      `${o.customerName || 'Unknown'}: ${o.productFamily || ''}, €${o.sellingPrice || 0}, margin=${o.margin || 0}%, ${o.purchasingYear || ''}-${o.purchasingQuarter || ''}, KAM=${o.kam || ''}`
    ).join("\n");

    const strategySummary = (strategy || []).map((s: any) =>
      `${s.productFamily || ''} in ${s.region || ''}: target €${s.estRevenue || 0}, margin=${s.margin || 0}%, KAM=${s.kam || ''}, Q=${s.estPurchasingQuarter || ''}`
    ).join("\n");

    const teamList = (teamMembers || []).map((m: any) => `${m.name} (${m.role}, ${m.department})`).join(", ");

    const systemPrompt = `You are an expert B2B sales operations strategist and commercial action planner for industrial companies. Your job is to analyze ALL available data and generate a comprehensive pool of commercial actions that will maximize revenue, protect existing business, and ensure strategic targets are met.

CRITICAL RULES:
1. Every action must be specific — name real customers, products, regions, and KAMs from the data
2. Prioritize by impact: don't lose high-probability deals first, then strategic alignment, then growth
3. ALWAYS include actions for these categories:
   - OFFER_FOLLOW_UP: Follow up on pending offers and negotiations (highest urgency)
   - ACTIVE_SELLING: Push deals forward, close negotiations, submit new offers
   - NEW_ACCOUNT: Prospect new customers in strategic segments/regions
   - LOYALTY_RETENTION: Protect existing high-value customers, prevent churn
   - AFTER_SALES: Service contract renewals, spare parts upsell, maintenance visits
   - CROSS_SELL: Sell additional product families to existing customers
   - STRATEGY_ALIGNMENT: Actions to close gaps between pipeline and strategy targets
4. After-sales and loyalty actions with existing customers are MORE PROFITABLE — prioritize them
5. Flag neglected/unattended opportunities as CRITICAL priority
6. Consider team capacity — if team members are provided, suggest assignments
7. Generate 15-25 actions covering ALL categories above
8. Operate as a goal-driven multi-agent system:
   - Stateful memory (use historical + current context)
   - Context-aware decisions
   - Iterative loop: plan → act → evaluate → improve
   - Event-driven activation (new lead, low health score, contract expiring, complaint)
9. Every action must include explicit score and effort to support capacity-based filtering
10. Ensure cross-agent orchestration:
   - Sales Agent closes deals
   - Customer Success Agent protects retention
   - Growth Agent drives upsell/cross-sell
   - RevOps Agent analyzes and recalculates
   - Orchestrator Agent coordinates next best action

IMPORTANT — EACH ACTION MUST INCLUDE FULL SUPPORTIVE CONTENT:
For EVERY action you generate, you MUST provide complete supportive material so the person executing the action has everything they need to succeed:

- "goal": A clear, measurable objective with success criteria and expected outcome. Include what metrics define success.
- "callScript": A complete, ready-to-use call/conversation script with:
  * Opening line (personalized to the customer/context)
  * Key talking points with specific data references (prices, products, dates)
  * Anticipated objections and responses
  * Closing technique and next-step request
  * If the action doesn't require a call, provide meeting talking points or conversation guidelines instead.
- "emailTemplate": A complete, ready-to-send email with:
  * Subject line
  * Professional body personalized with customer name, product references, and specific value propositions
  * Clear call-to-action
  * If the action doesn't require an email, provide a brief follow-up message template instead.
- "presentationNotes": Supporting information for the action owner including:
  * Key data points and figures to reference
  * Customer history highlights
  * Competitive positioning notes
  * Internal preparation checklist
  * Meeting agenda if applicable

Use REAL customer names, product families, revenue figures, and dates from the provided data. Never use generic placeholders like [Customer Name].

Output JSON with this structure:
{
  "actions": [
    {
      "title": "Short action title with customer name",
      "description": "Detailed description of what to do, why, and expected outcome",
      "category": "follow_up|loyalty|cross_sell|strategy|analysis|meeting|report|data",
      "pillar": "general|p0|p1|p2|p3|p4|p5|p6",
      "priority": "critical|high|medium|low",
      "assignee": "Suggested KAM/person or empty",
      "dueDate": "ISO date string (within next 2 weeks for critical, 4 weeks for high, 6 weeks for medium)",
      "rationale": "Why this action matters for strategy achievement",
      "estimatedRevenue": 0,
      "importanceScore": 0,
      "strategyAlignmentScore": 0,
      "estimatedHours": 0,
      "riskIfNotDone": "What happens if this action is not executed",
      "actionContent": {
        "goal": "Clear measurable objective with success criteria",
        "callScript": "Complete call/conversation script ready to use",
        "emailTemplate": "Complete email with subject, body, and CTA",
        "presentationNotes": "Supporting data, preparation checklist, key figures"
      }
    }
  ],
  "summary": {
    "totalActions": 0,
    "criticalCount": 0,
    "estimatedPipelineProtected": 0,
    "estimatedNewRevenue": 0,
    "coverageGaps": ["List of strategic gaps not addressed by current pipeline"]
  }
}`;

    const userPrompt = `Generate a comprehensive action pool for this company:

COMPANY PROFILE:
- Name: ${companyProfile?.company_name || "Unknown"}
- Industry: ${companyProfile?.industry || "Unknown"}
- Annual Revenue: ${companyProfile?.annual_revenue || "Unknown"}
- Strategic Goals: ${companyProfile?.strategic_goals || "Not defined"}
- Current Challenges: ${companyProfile?.current_challenges || "Not defined"}
- Business Description: ${companyProfile?.business_description || "Not provided"}
- Strategy Context: ${companyProfile?.strategy_context || "Not provided"}
- Market Context: ${companyProfile?.market_context || "Not provided"}
- Objectives: ${companyProfile?.objectives || "Not provided"}
- Additional Notes: ${companyProfile?.additional_notes || "Not provided"}
- Sales Team Size: ${companyProfile?.sales_team_size || "Unknown"}
- KAM Count: ${companyProfile?.kam_count || "Unknown"}
- Sales Channels: ${companyProfile?.sales_channels || "Unknown"}
- Main Products: ${companyProfile?.main_products || "Unknown"}
- Customer Segments: ${companyProfile?.main_customer_segments || "Unknown"}

STRATEGY TARGETS:
${strategySummary || "No strategy data available"}

PIPELINE OPPORTUNITIES (${(opportunities || []).length} total):
${oppSummary || "No pipeline data"}

RECENT ORDERS (last ${(orders || []).slice(0, 30).length}):
${orderSummary || "No order history"}

TEAM MEMBERS:
${teamList || "No team data — leave assignee suggestions based on KAM field in data"}

EXISTING TASKS (avoid duplicates):
${existingTitles || "No existing tasks"}

TODAY: ${new Date().toISOString().split('T')[0]}

Generate the action pool now. Be specific with customer names, products, and amounts from the data. Prioritize: (1) Don't lose any good opportunity, (2) Strategic alignment, (3) After-sales profitability, (4) New business development.

REMEMBER: Each action MUST include complete "actionContent" with goal, callScript, emailTemplate, and presentationNotes — all personalized with real data. The person executing the action should be able to pick up the phone or send the email immediately.

AGENT ENGINE REQUIREMENTS:
- Include proactive event-driven actions for: new lead, low health score, contract expiring, and customer complaint.
- Include actions that explicitly support iterative reasoning cycle: context understanding, planning, execution, evaluation, memory update, next best action selection.
- Include at least one action where RevOps recalculates global priorities after new inputs/events.
- Use structured-data intelligence (CRM + historical + external signals + model scores) in rationales.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_action_pool",
            description: "Generate a prioritized pool of commercial actions with full supportive content",
            parameters: {
              type: "object",
              properties: {
                actions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      category: { type: "string" },
                      pillar: { type: "string" },
                      priority: { type: "string" },
                      assignee: { type: "string" },
                      dueDate: { type: "string" },
                      rationale: { type: "string" },
                      estimatedRevenue: { type: "number" },
                      importanceScore: { type: "number" },
                      strategyAlignmentScore: { type: "number" },
                      estimatedHours: { type: "number" },
                      riskIfNotDone: { type: "string" },
                      actionContent: {
                        type: "object",
                        properties: {
                          goal: { type: "string" },
                          callScript: { type: "string" },
                          emailTemplate: { type: "string" },
                          presentationNotes: { type: "string" },
                        },
                        required: ["goal", "callScript", "emailTemplate", "presentationNotes"],
                      },
                    },
                    required: ["title", "description", "category", "pillar", "priority", "actionContent", "importanceScore", "strategyAlignmentScore", "estimatedHours"],
                  },
                },
                summary: {
                  type: "object",
                  properties: {
                    totalActions: { type: "number" },
                    criticalCount: { type: "number" },
                    estimatedPipelineProtected: { type: "number" },
                    estimatedNewRevenue: { type: "number" },
                    coverageGaps: { type: "array", items: { type: "string" } },
                  },
                  required: ["totalActions", "criticalCount", "estimatedPipelineProtected", "estimatedNewRevenue", "coverageGaps"],
                },
              },
              required: ["actions", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_action_pool" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
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

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-action-pool error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
