import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// GET /documents/status?company_id=...&document_id=...
// Returns pipeline status for one or all documents of a company

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("company_id");
    const documentId = url.searchParams.get("document_id");

    if (!companyId) {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabase
      .from("document_pipeline_status")
      .select("*")
      .eq("company_id", companyId)
      .order("ingested_at", { ascending: false });

    if (documentId) {
      query = query.eq("document_id", documentId);
    }

    const { data, error } = await query.limit(200);
    if (error) throw error;

    return new Response(JSON.stringify({ documents: data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("document-status error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Failed to fetch document status" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
