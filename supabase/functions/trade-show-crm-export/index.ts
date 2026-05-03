import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/g).filter(Boolean);
  if (parts.length <= 1) return { firstName: fullName.trim() || "Trade Show", lastName: "Lead" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) || "Lead",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const provider = body.provider as "hubspot" | "salesforce" | undefined;
    const leads = Array.isArray(body.leads) ? body.leads : [];
    const event = body.event || {};

    if (!provider || leads.length === 0) {
      return json({ error: "Missing provider or leads" }, 400);
    }

    if (provider === "hubspot") {
      const token = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
      const endpoint = Deno.env.get("HUBSPOT_EXPORT_URL") || "https://api.hubapi.com/crm/v3/objects/contacts/batch/create";

      if (!token) {
        return json({
          provider,
          status: "not_configured",
          exported_count: 0,
          source: "fallback",
          message: "HUBSPOT_ACCESS_TOKEN is not configured.",
          last_exported_at: new Date().toISOString(),
          external_ids: [],
        });
      }

      const payload = {
        inputs: leads.map((lead: any) => {
          const { firstName, lastName } = splitName(String(lead.name || "Trade Show Lead"));
          return {
            properties: {
              firstname: firstName,
              lastname: lastName,
              company: String(lead.company || "Unknown Company"),
              jobtitle: String(lead.role || "Trade Show Contact"),
              hs_lead_status: lead.interest_level === "A" ? "OPEN" : "NEW",
              lifecyclestage: "lead",
              notes_last_contacted: String(lead.notes || ""),
              trade_show_event: String(event.trade_show_id || event.id || "trade_show"),
            },
          };
        }),
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(`HubSpot export failed (${response.status}): ${JSON.stringify(result)}`);
      }

      return json({
        provider,
        status: "exported",
        exported_count: leads.length,
        source: "remote",
        message: `Exported ${leads.length} lead(s) to HubSpot.`,
        last_exported_at: new Date().toISOString(),
        external_ids: Array.isArray(result.results) ? result.results.map((entry: any) => String(entry.id)).filter(Boolean) : [],
      });
    }

    if (provider === "salesforce") {
      const token = Deno.env.get("SALESFORCE_ACCESS_TOKEN");
      const instanceUrl = Deno.env.get("SALESFORCE_INSTANCE_URL");
      const apiVersion = Deno.env.get("SALESFORCE_API_VERSION") || "v61.0";

      if (!token || !instanceUrl) {
        return json({
          provider,
          status: "not_configured",
          exported_count: 0,
          source: "fallback",
          message: "SALESFORCE_ACCESS_TOKEN or SALESFORCE_INSTANCE_URL is not configured.",
          last_exported_at: new Date().toISOString(),
          external_ids: [],
        });
      }

      const response = await fetch(`${instanceUrl}/services/data/${apiVersion}/composite/sobjects`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allOrNone: false,
          records: leads.map((lead: any) => {
            const { lastName } = splitName(String(lead.name || "Trade Show Lead"));
            return {
              attributes: { type: "Lead" },
              LastName: lastName,
              Company: String(lead.company || "Unknown Company"),
              Title: String(lead.role || "Trade Show Contact"),
              Description: String(lead.notes || "") || `Captured during ${String(event.trade_show_id || event.id || "trade show")}.`,
              LeadSource: `Trade Show - ${String(event.trade_show_id || event.id || "Event")}`,
            };
          }),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(`Salesforce export failed (${response.status}): ${JSON.stringify(result)}`);
      }

      return json({
        provider,
        status: "exported",
        exported_count: leads.length,
        source: "remote",
        message: `Exported ${leads.length} lead(s) to Salesforce.`,
        last_exported_at: new Date().toISOString(),
        external_ids: Array.isArray(result) ? result.map((entry: any) => String(entry.id)).filter(Boolean) : [],
      });
    }

    return json({ error: "Unsupported provider" }, 400);
  } catch (error) {
    console.error("trade-show-crm-export error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected CRM export error" }, 500);
  }
});