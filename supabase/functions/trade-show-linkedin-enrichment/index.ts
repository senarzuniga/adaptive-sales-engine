import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const fallbackIntelligence = (body: any) => ({
  source: "fallback",
  summary: `${body.eventName || "Trade show"} intelligence generated locally because the LinkedIn provider is not configured.`,
  attending_companies: (body.targetAccounts || []).slice(0, 5).map((company: string, index: number) => ({
    company,
    relevance: Number((0.9 - index * 0.08).toFixed(2)),
    rationale: `Priority account for ${body.industry || "event"} conversations at ${body.eventName || "the event"}.`,
  })),
  decision_makers: (body.targetAccounts || []).slice(0, 4).map((company: string, index: number) => ({
    company,
    role: index % 2 === 0 ? "Commercial Director" : "Operations Director",
    priority: index < 2 ? "high" : "medium",
    outreach_hint: `Reference ${body.eventName || "the event"} benchmark outcomes and offer a short working session.`,
  })),
  competitor_patterns: [
    {
      company: "Competitor A",
      message: "Deploy faster with lower integration risk.",
      positioning: "Deployment speed",
      keywords: ["speed", "deployment", "integration"],
      campaign_type: "Trade show activation",
    },
    {
      company: "Competitor B",
      message: "Lower operating cost through automation.",
      positioning: "Efficiency",
      keywords: ["efficiency", "automation", "cost"],
      campaign_type: "Thought leadership",
    },
  ],
  counter_messaging: [
    "Lead with quantified business impact and faster time-to-value.",
    "Frame differentiation around lifecycle support and implementation confidence.",
    "Prepare account-specific briefs for the highest-fit companies.",
  ],
  last_updated_at: new Date().toISOString(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get("LINKEDIN_ENRICHMENT_API_KEY");
    const baseUrl = Deno.env.get("LINKEDIN_ENRICHMENT_BASE_URL");

    if (!apiKey || !baseUrl) {
      return json(fallbackIntelligence(body));
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/linkedin/event-enrichment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`LinkedIn enrichment failed (${response.status}): ${JSON.stringify(result)}`);
    }

    return json({
      source: "provider",
      summary: String(result.summary || `${body.eventName || "Trade show"} enrichment completed.`),
      attending_companies: Array.isArray(result.attending_companies) ? result.attending_companies : fallbackIntelligence(body).attending_companies,
      decision_makers: Array.isArray(result.decision_makers) ? result.decision_makers : fallbackIntelligence(body).decision_makers,
      competitor_patterns: Array.isArray(result.competitor_patterns) ? result.competitor_patterns : fallbackIntelligence(body).competitor_patterns,
      counter_messaging: Array.isArray(result.counter_messaging) ? result.counter_messaging : fallbackIntelligence(body).counter_messaging,
      last_updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("trade-show-linkedin-enrichment error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected LinkedIn enrichment error" }, 500);
  }
});