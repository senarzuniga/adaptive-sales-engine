import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { reportId, targetCompanyName, targetCompanyWebsite, companyId, analysisType, targetSubjectType, analysisBrief } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company context
    const { data: company } = await supabase.from("companies").select("*").eq("id", companyId).single();

    // Update status to generating
    await supabase.from("business_intelligence_reports").update({ status: "generating" }).eq("id", reportId);

    const systemPrompt = `You are a senior Strategic Business Intelligence Analyst operating at McKinsey/Bain consulting level.

## YOUR MISSION
Generate a comprehensive business intelligence report for the target subject "${targetCompanyName}" ${targetCompanyWebsite ? `(source: ${targetCompanyWebsite})` : ''}.
The target subject type is "${targetSubjectType || 'company'}".
This subject may be a company, geographical region, industry sector, product domain, production process, trade show, or another strategic topic.

## HYPOTHESIS ENGINE (MANDATORY)
For EVERY section of analysis, you MUST:
1. Generate 2-3 alternative hypotheses
2. Evaluate each against data quality, relevance, recency, and source reliability
3. Select the best-supported hypothesis
4. Briefly justify your choice
NEVER return a single conclusion without exploring alternatives.

## ANALYSIS CONTEXT
You are analyzing this subject from the perspective of "${company?.company_name || 'our company'}" which operates in ${company?.industry || 'industrial'} sector.
Adapt the report sections to the subject. For non-company topics, use the "company_profile" block as a generic subject profile and interpret valuation / sale propensity as strategic attractiveness and commercial potential.

## OUTPUT FORMAT
Return a JSON object with these exact keys:

{
  "executive_summary": "2-3 paragraph strategic overview with key findings and actionable conclusions",
  "company_profile": {
    "sector": "", "sub_sector": "", "company_type": "", "founded_year": "",
    "size_category": "", "employee_estimate": "", "headquarters": "",
    "locations": [], "org_structure_notes": "",
    "products_services": [], "market_positioning": "",
    "confidence_level": "HIGH|MEDIUM|LOW"
  },
  "financial_analysis": {
    "revenue_estimate": "", "revenue_currency": "EUR",
    "ebitda_estimate": "", "net_profit_estimate": "",
    "growth_rate": "", "margin_estimate": "",
    "debt_level": "", "financial_health": "",
    "data_sources": [], "confidence_level": "HIGH|MEDIUM|LOW",
    "hypotheses_explored": []
  },
  "product_analysis": {
    "products": [{"name":"","classification":"innovation|commodity|declining","differentiation":"","margin_estimate":"","lifecycle_stage":""}],
    "price_dependency": "", "overall_assessment": ""
  },
  "market_analysis": {
    "market_size": "", "market_growth": "", "trends": [],
    "entry_barriers": "", "regulatory_risks": "",
    "market_attractiveness": "HIGH|MEDIUM|LOW",
    "competition_level": "HIGH|MEDIUM|LOW",
    "opportunities": []
  },
  "competitive_analysis": {
    "competitors": [{"name":"","positioning":"","strengths":[],"weaknesses":[]}],
    "competitive_advantages": [], "competitive_risks": [],
    "competitive_map_summary": ""
  },
  "strategic_analysis": {
    "swot": {"strengths":[],"weaknesses":[],"opportunities":[],"threats":[]},
    "current_situation": "", "trajectory": "", "key_risks": [],
    "diagnosis": ""
  },
  "valuation": {
    "estimated_value": "", "value_range_min": "", "value_range_max": "",
    "valuation_currency": "EUR",
    "methods_used": [],
    "multiples_applied": {},
    "confidence_level": "HIGH|MEDIUM|LOW",
    "valuation_notes": ""
  },
  "sale_propensity": {
    "probability": "HIGH|MEDIUM|LOW",
    "financial_signals": [], "strategic_signals": [],
    "organizational_signals": [], "contextual_signals": [],
    "main_sale_drivers": [],
    "potential_buyer_types": [],
    "recommendation": "sell_now|prepare_sale|do_not_sell",
    "reasoning": ""
  },
  "future_scenarios": {
    "five_year": {"best_case":"","worst_case":"","most_probable":""},
    "ten_year": {"best_case":"","worst_case":"","most_probable":""}
  },
  "recommendations": [
    {"type":"strategic|commercial|operational","priority":"high|medium|low","action":"","rationale":"","timeline":""}
  ],
  "data_sources": [{"source":"","type":"","reliability":"HIGH|MEDIUM|LOW","date":""}],
  "hypothesis_log": [{"section":"","hypotheses":[],"selected":"","justification":""}]
}

## CRITICAL RULES
- NEVER ignore indirect signals
- ALWAYS include confidence levels
- If data is estimated, mark it clearly
- Prioritize official/public sources
- Be specific with numbers and estimates
- Think like a strategic consultant — actionable, direct, no filler
- All monetary values should include currency
- Explore ALL sections thoroughly`;

    const userPrompt = analysisType === 'full'
      ? `Generate a COMPLETE business intelligence report for the ${targetSubjectType || 'company'} "${targetCompanyName}". Cover ALL sections: profile, financial or value logic, products/processes, market, competition, strategy (SWOT), attractiveness, future scenarios, and actionable recommendations. Use the hypothesis engine for every section.${analysisBrief ? ` Additional brief: ${analysisBrief}` : ''}`
      : `Generate a focused ${analysisType} analysis for the ${targetSubjectType || 'company'} "${targetCompanyName}". Apply the hypothesis engine and provide detailed, actionable insights.${analysisBrief ? ` Additional brief: ${analysisBrief}` : ''}`;

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
            name: "submit_intelligence_report",
            description: "Submit the complete business intelligence report",
            parameters: {
              type: "object",
              properties: {
                executive_summary: { type: "string" },
                company_profile: { type: "object" },
                financial_analysis: { type: "object" },
                product_analysis: { type: "object" },
                market_analysis: { type: "object" },
                competitive_analysis: { type: "object" },
                strategic_analysis: { type: "object" },
                valuation: { type: "object" },
                sale_propensity: { type: "object" },
                future_scenarios: { type: "object" },
                recommendations: { type: "array" },
                data_sources: { type: "array" },
                hypothesis_log: { type: "array" },
              },
              required: ["executive_summary", "company_profile", "financial_analysis", "strategic_analysis", "valuation", "sale_propensity", "recommendations"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_intelligence_report" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        await supabase.from("business_intelligence_reports").update({ status: "failed" }).eq("id", reportId);
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        await supabase.from("business_intelligence_reports").update({ status: "failed" }).eq("id", reportId);
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let report: any = {};

    if (toolCall?.function?.arguments) {
      report = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    }

    // Update the report in DB
    await supabase.from("business_intelligence_reports").update({
      status: "completed",
      executive_summary: report.executive_summary || "",
      company_profile: report.company_profile || {},
      financial_analysis: report.financial_analysis || {},
      product_analysis: report.product_analysis || {},
      market_analysis: report.market_analysis || {},
      competitive_analysis: report.competitive_analysis || {},
      strategic_analysis: report.strategic_analysis || {},
      valuation: report.valuation || {},
      sale_propensity: report.sale_propensity || {},
      future_scenarios: report.future_scenarios || {},
      recommendations: report.recommendations || [],
      data_sources: report.data_sources || [],
      hypothesis_log: report.hypothesis_log || [],
    }).eq("id", reportId);

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("BI error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
