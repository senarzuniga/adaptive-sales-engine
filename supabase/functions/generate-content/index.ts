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

    const { contentType, topic, companyProfile, productsData, targetPlatform, brandGuidelines, additionalContext,
            ordersContext, opportunitiesContext, strategyContext } = await req.json();

    const platformGuidance: Record<string, string> = {
      linkedin: "LinkedIn post format: professional tone, 1300 chars max, use relevant hashtags, include a call-to-action. Can include emojis sparingly.",
      twitter: "Twitter/X post format: concise, max 280 chars, use hashtags, engaging hook. Thread format if needed (max 5 tweets).",
      instagram: "Instagram caption: engaging, use emojis, 2200 chars max, include 20-30 relevant hashtags at end.",
      facebook: "Facebook post: conversational tone, can be longer, include a question or CTA to drive engagement.",
      newsletter: "Newsletter format: professional HTML email body. Include a compelling subject line, clear sections with headers, key insights, and a closing CTA. 500-800 words.",
    };

    const systemPrompt = `You are a commercial content creation AI for ${companyProfile?.company_name || "the company"}.
You create engaging, professional content for commercial and marketing purposes.
Your content should position the company as a thought leader and drive commercial results.

COMPANY CONTEXT:
- Name: ${companyProfile?.company_name || "Unknown"}
- Industry: ${companyProfile?.industry || "Unknown"}
- Sub-sector: ${companyProfile?.sub_sector || ""}
- Headquarters: ${companyProfile?.headquarters || ""}
- Operating Regions: ${companyProfile?.operating_regions || ""}
- Products: ${companyProfile?.main_products || "Not specified"}
- Customer Segments: ${companyProfile?.main_customer_segments || ""}
- Competitors: ${companyProfile?.main_competitors || ""}
- Strategic Goals: ${companyProfile?.strategic_goals || ""}
- Current Challenges: ${companyProfile?.current_challenges || ""}
- Sales Channels: ${companyProfile?.sales_channels || ""}

CONSULTANT INSIGHTS (PRIMARY SOURCE — highest reliability):
- Business Description: ${companyProfile?.business_description || "Not provided"}
- Strategy Context: ${companyProfile?.strategy_context || "Not provided"}
- Market Context: ${companyProfile?.market_context || "Not provided"}
- Objectives: ${companyProfile?.objectives || "Not provided"}
- Additional Notes: ${companyProfile?.additional_notes || "Not provided"}

${productsData ? `PRODUCT PORTFOLIO:\n${productsData}` : ""}

${ordersContext ? `RECENT COMMERCIAL ACTIVITY (orders/wins):\n${ordersContext}` : ""}

${opportunitiesContext ? `ACTIVE PIPELINE & OPPORTUNITIES:\n${opportunitiesContext}` : ""}

${strategyContext ? `COMMERCIAL STRATEGY TARGETS:\n${strategyContext}` : ""}

${brandGuidelines ? `BRAND GUIDELINES:\n${brandGuidelines}` : ""}

PLATFORM: ${targetPlatform || "general"}
${platformGuidance[targetPlatform] || "General content format."}

IMPORTANT RULES:
- Content must be authentic and based on real company data — never fabricate achievements or metrics
- Position the company as a knowledgeable player in its industry
- Reference real products, markets, and capabilities from the data
- Make content commercially useful: attract prospects, reinforce relationships, demonstrate expertise
- Adapt tone to the platform but maintain professionalism
- Include relevant industry-specific hashtags

Use the tool to return the structured content.`;

    const userPrompt = `Create ${contentType || "a post"} about: ${topic || "company update"}

${additionalContext ? `Additional context:\n${additionalContext}` : ""}

Generate compelling, on-brand content ready to publish. Use real data from the company context to make it specific and credible.`;

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
              name: "create_content",
              description: "Create social media or newsletter content",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Content title or headline" },
                  body: { type: "string", description: "Main content body (HTML for newsletters, plain text for social)" },
                  summary: { type: "string", description: "Short summary (1-2 sentences)" },
                  hashtags: { type: "array", items: { type: "string" }, description: "Relevant hashtags" },
                  callToAction: { type: "string", description: "Suggested call to action" },
                  suggestedImageDescription: { type: "string", description: "Description for an AI-generated image to accompany the post" },
                  platform: { type: "string", description: "Target platform" },
                  contentType: { type: "string", description: "Type of content created" },
                  alternativeVersions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        platform: { type: "string" },
                        body: { type: "string" },
                      },
                      required: ["platform", "body"],
                    },
                    description: "Adapted versions for other platforms",
                  },
                },
                required: ["title", "body", "summary", "hashtags", "callToAction", "platform", "contentType"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_content" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
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
    console.error("generate-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
