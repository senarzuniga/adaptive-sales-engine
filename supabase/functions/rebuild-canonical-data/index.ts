import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const unique = <T,>(items: T[]) => [...new Set(items)];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { companyId, documentIds } = await req.json().catch(() => ({}));
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let docsQuery = supabase.from("company_documents").select("id, company_id").order("created_at", { ascending: true });
    if (companyId) docsQuery = docsQuery.eq("company_id", companyId);
    if (Array.isArray(documentIds) && documentIds.length > 0) docsQuery = docsQuery.in("id", documentIds);

    const { data: docs, error: docsError } = await docsQuery;
    if (docsError) throw docsError;
    if (!docs || docs.length === 0) {
      return new Response(JSON.stringify({ success: true, reset: 0, reprocessed: 0, message: "No uploaded documents found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyIds = unique(docs.map((doc) => doc.company_id).filter(Boolean));
    const docIds = docs.map((doc) => doc.id);

    const { data: offers } = await supabase.from("offers").select("id").in("company_id", companyIds);
    const offerIds = (offers || []).map((row) => row.id);
    if (offerIds.length > 0) await supabase.from("offer_products").delete().in("offer_id", offerIds);

    await Promise.all([
      supabase.from("enrichment_logs").delete().in("company_id", companyIds),
      supabase.from("entities_raw_extracted").delete().in("company_id", companyIds),
      supabase.from("knowledge_relationships").delete().in("document_id", docIds),
      supabase.from("knowledge_insights").delete().in("document_id", docIds),
      supabase.from("knowledge_data_points").delete().in("document_id", docIds),
      supabase.from("knowledge_entities").delete().in("document_id", docIds),
      supabase.from("document_chunks").delete().in("document_id", docIds),
      supabase.from("document_sections").delete().in("document_id", docIds),
      supabase.from("document_ingestion_runs").delete().in("document_id", docIds),
      supabase.from("actions").delete().in("company_id", companyIds),
      supabase.from("insights").delete().in("company_id", companyIds),
      supabase.from("business_intelligence_reports").delete().in("company_id", companyIds),
      supabase.from("orders").delete().in("company_id", companyIds),
      supabase.from("offers").delete().in("company_id", companyIds),
      supabase.from("customers").delete().in("company_id", companyIds),
      supabase.from("company_contacts").delete().in("company_id", companyIds),
      supabase.from("products").delete().in("company_id", companyIds),
      supabase.from("strategy").delete().in("company_id", companyIds),
      supabase.from("competitors").delete().in("company_id", companyIds),
    ]);

    await supabase.from("company_documents").update({
      processing_status: "pending",
      extracted_data: {},
      parsed_structure: {},
      semantic_summary: {},
      quality_score: null,
      processing_trace: {
        reset_at: new Date().toISOString(),
        reason: "rebuild-canonical-data",
      },
    }).in("id", docIds);

    const reprocessResults = [];
    for (const docId of docIds) {
      const response = await fetch(`${supabaseUrl}/functions/v1/process-document`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentId: docId }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        await supabase.from("company_documents").update({
          processing_status: "flagged",
          processing_trace: {
            flagged_at: new Date().toISOString(),
            reason: result?.message || result?.error || "Document could not be reprocessed within compute limits.",
            action: "kept-as-raw-document",
          },
          extracted_data: {
            summary: "Document preserved for manual review.",
            blocked_from_canonical: true,
            reason: result?.message || result?.error || "Compute-resource limit reached during rebuild.",
          },
        }).eq("id", docId);
      }

      reprocessResults.push({ documentId: docId, ok: response.ok, status: response.ok ? (result?.status || "completed") : "flagged", result });
    }

    for (const currentCompanyId of companyIds) {
      await fetch(`${supabaseUrl}/functions/v1/enrich-company`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId: currentCompanyId }),
      }).catch(() => null);
    }

    return new Response(JSON.stringify({
      success: true,
      reset: docIds.length,
      reprocessed: reprocessResults.filter((item) => item.ok).length,
      results: reprocessResults,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("rebuild-canonical-data error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unexpected rebuild error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
