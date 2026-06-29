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

    const { customerEmail, customerName, emailSubject, emailBody, companyProfile, companyContacts, productsData } = await req.json();

    const contactsInfo = (companyContacts || []).map((c: any) =>
      `- ${c.name} | ${c.role} | ${c.department} | ${c.email}${c.is_default_handler ? ' [DEFAULT HANDLER]' : ''}`
    ).join('\n');

    const systemPrompt = `You are an intelligent commercial email assistant (cobot) for ${companyProfile?.company_name || "the company"}. You handle incoming customer emails on behalf of the company.

Your role:
1. Analyze the incoming email to understand the customer's request
2. If you CAN answer (product info, general inquiries, pricing guidance, availability, technical specs based on available data): Draft a professional, helpful response AND include a note that the assigned sales representative will be available for further support
3. If you CANNOT answer (complex negotiations, custom pricing, complaints, legal, unknown topics): Draft an acknowledgment email stating the request has been received and forwarded to the appropriate team member
4. Always identify the best person/department from the team directory to handle or be copied on this email
5. Be warm, professional, and brand-aligned

COMPANY INFO:
- Name: ${companyProfile?.company_name || "Unknown"}
- Industry: ${companyProfile?.industry || "Unknown"}
- Products: ${companyProfile?.main_products || "Not specified"}
- Customer Segments: ${companyProfile?.main_customer_segments || ""}

PRODUCT CATALOG:
${productsData || "No product data available"}

TEAM DIRECTORY:
${contactsInfo || "No contacts configured"}

Use the tool to return the structured response.`;

    const userPrompt = `Process this incoming customer email:

FROM: ${customerName || "Unknown"} <${customerEmail || "unknown@email.com"}>
SUBJECT: ${emailSubject || "No subject"}

BODY:
${emailBody || "No content"}

Draft the best possible response. Determine if you can answer directly or need to escalate. Identify the right team member to CC.`;

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
              name: "draft_email_response",
              description: "Draft a response to an incoming customer email",
              parameters: {
                type: "object",
                properties: {
                  canAnswer: { type: "boolean", description: "Whether the bot can directly answer the query" },
                  confidence: { type: "number", description: "Confidence level 0-100 in the response quality" },
                  responseSubject: { type: "string", description: "Email response subject line" },
                  responseBody: { type: "string", description: "Full email response body in HTML format" },
                  internalNote: { type: "string", description: "Internal note for the sales rep about this email" },
                  suggestedCcName: { type: "string", description: "Name of the team member to CC" },
                  suggestedCcEmail: { type: "string", description: "Email of the team member to CC" },
                  suggestedCcReason: { type: "string", description: "Why this person should be CC'd" },
                  category: { type: "string", enum: ["product_inquiry", "pricing_request", "technical_support", "complaint", "general_info", "partnership", "other"], description: "Category of the incoming email" },
                  urgency: { type: "string", enum: ["low", "medium", "high"], description: "Urgency level of the request" },
                  suggestedFollowUp: { type: "string", description: "Suggested follow-up action for the sales rep" },
                },
                required: ["canAnswer", "confidence", "responseSubject", "responseBody", "internalNote", "suggestedCcName", "suggestedCcEmail", "suggestedCcReason", "category", "urgency", "suggestedFollowUp"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "draft_email_response" } },
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
    console.error("email-cobot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
