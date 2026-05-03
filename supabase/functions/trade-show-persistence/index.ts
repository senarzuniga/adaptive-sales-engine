import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const companyId = body.companyId as string | undefined;

    if (!action) return json({ error: "Missing action" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "load") {
      if (!companyId) return json({ error: "Missing companyId" }, 400);

      const [{ data: events, error: eventsError }, { data: leads, error: leadsError }, { data: history, error: historyError }] = await Promise.all([
        supabase.from("trade_show_events").select("*").eq("company_id", companyId).order("event_date", { ascending: false }),
        supabase.from("trade_show_leads").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("trade_show_history").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(200),
      ]);

      if (eventsError) throw eventsError;
      if (leadsError) throw leadsError;
      if (historyError) throw historyError;

      return json({ events: events || [], leads: leads || [], history: history || [] });
    }

    if (action === "upsert_event") {
      const event = body.event;
      if (!companyId || !event?.id) return json({ error: "Missing companyId or event.id" }, 400);

      const payload = {
        id: String(event.id),
        company_id: companyId,
        trade_show_id: String(event.trade_show_id || ""),
        status: String(event.status || "confirmed"),
        stand_size: String(event.stand_size || "medium"),
        location_within_event: String(event.location_within_event || "Main hall"),
        event_date: event.event_date || null,
        venue: event.venue || null,
        objectives: Array.isArray(event.objectives) ? event.objectives : [],
        key_messages: Array.isArray(event.key_messages) ? event.key_messages : [],
        target_accounts: Array.isArray(event.target_accounts) ? event.target_accounts : [],
        assigned_team: Array.isArray(event.assigned_team) ? event.assigned_team : [],
        costs: event.costs || {},
        roi: event.roi || {},
        crm_export: event.crm_export || null,
        linkedin_intelligence: event.linkedin_intelligence || null,
        travel_context: event.travel_context || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("trade_show_events")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

      if (error) throw error;
      return json({ event: data });
    }

    if (action === "insert_lead") {
      const eventId = body.eventId as string | undefined;
      const lead = body.lead;
      if (!companyId || !eventId || !lead?.id) return json({ error: "Missing companyId, eventId, or lead.id" }, 400);

      const payload = {
        id: String(lead.id),
        company_id: companyId,
        event_id: eventId,
        name: String(lead.name || ""),
        company: String(lead.company || ""),
        role: String(lead.role || ""),
        interest_level: ["A", "B", "C"].includes(lead.interest_level) ? lead.interest_level : "B",
        notes: String(lead.notes || ""),
        next_action: String(lead.next_action || ""),
        created_at: lead.created_at || new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("trade_show_leads")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

      if (error) throw error;
      return json({ lead: data });
    }

    if (action === "append_history") {
      const eventId = body.eventId as string | undefined;
      if (!companyId || !eventId) return json({ error: "Missing companyId or eventId" }, 400);

      const payload = {
        id: body.id || `history_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        company_id: companyId,
        event_id: eventId,
        action_type: String(body.actionType || "unknown"),
        actor: String(body.actor || "system"),
        payload: body.payload || {},
      };

      const { data, error } = await supabase
        .from("trade_show_history")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;
      return json({ historyEntry: data });
    }

    return json({ error: "Unknown action" }, 404);
  } catch (error) {
    console.error("trade-show-persistence error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected persistence error" }, 500);
  }
});