import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { companyId } = await req.json();
    if (!companyId) throw new Error("companyId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current company data
    const { data: company, error: compErr } = await supabase.from("companies").select("*").eq("id", companyId).single();
    if (compErr || !company) throw new Error("Company not found");

    await supabase.from("companies").update({ enrichment_status: "enriching" }).eq("id", companyId);

    const systemPrompt = `You are a Senior Business Intelligence Analyst. Your task is to analyze a company and enrich its profile with comprehensive, accurate information.

## COMPANY TO ANALYZE
- Name: ${company.company_name}
- Website: ${company.website_url || 'Not provided'}
- LinkedIn: ${company.linkedin_url || 'Not provided'}
- Current description: ${company.business_description || 'None'}
- Current industry: ${company.industry || 'Unknown'}

## YOUR MISSION
Based on publicly available information, company name, website, and LinkedIn URL, gather and return structured intelligence about this company. Use your training knowledge and reasoning to provide the most accurate and complete picture possible.

## HYPOTHESIS ENGINE
For every data point, consider multiple possibilities and select the most likely one. Mark confidence levels.

## RULES
- Be specific — real numbers, real product names, real market data
- If estimating, mark as "estimated"
- Prioritize actionable intelligence
- Think like a McKinsey/Bain consultant
- If website/LinkedIn are provided, use them as primary identifiers
- All text fields should be concise but informative (2-4 sentences each)`;

    const userPrompt = `Analyze "${company.company_name}" and provide a comprehensive company profile enrichment. Fill in ALL fields with the best available intelligence.`;

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
            name: "submit_enrichment",
            description: "Submit the enriched company profile data",
            parameters: {
              type: "object",
              properties: {
                industry: { type: "string", description: "Primary industry sector" },
                sub_sector: { type: "string", description: "Specific sub-sector within the industry" },
                headquarters: { type: "string", description: "HQ city/country" },
                operating_regions: { type: "string", description: "Regions where the company operates" },
                employee_count: { type: "string", description: "Estimated number of employees" },
                annual_revenue: { type: "string", description: "Estimated annual revenue with currency" },
                main_products: { type: "string", description: "Key products and services offered" },
                main_customer_segments: { type: "string", description: "Primary customer segments and markets" },
                main_competitors: { type: "string", description: "Key competitors in the market" },
                business_description: { type: "string", description: "Comprehensive business description" },
                objectives: { type: "string", description: "Inferred strategic objectives based on public signals" },
                strategy_context: { type: "string", description: "Strategic context — market position, growth trajectory, key initiatives" },
                market_context: { type: "string", description: "Market dynamics — size, growth, trends, competitive landscape" },
                current_challenges: { type: "string", description: "Current challenges and risks facing the company" },
                strategic_goals: { type: "string", description: "Inferred strategic goals and priorities" },
              },
              required: ["industry", "business_description", "main_products"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_enrichment" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let enrichment: any = {};

    if (toolCall?.function?.arguments) {
      enrichment = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    }

    // Only update fields that are currently empty — don't overwrite user's manual input
    const updates: any = { enrichment_status: "completed" };
    const fieldsToEnrich = [
      'industry', 'sub_sector', 'headquarters', 'operating_regions',
      'employee_count', 'annual_revenue', 'main_products', 'main_customer_segments',
      'main_competitors', 'business_description', 'objectives', 'strategy_context',
      'market_context', 'current_challenges', 'strategic_goals',
    ];

    for (const field of fieldsToEnrich) {
      if (!company[field] && enrichment[field]) {
        updates[field] = enrichment[field];
      }
    }

    await supabase.from("companies").update(updates).eq("id", companyId);

    return new Response(JSON.stringify({ success: true, enrichedFields: Object.keys(updates).filter(k => k !== 'enrichment_status') }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Enrichment error:", e);

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
