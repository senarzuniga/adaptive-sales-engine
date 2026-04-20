import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// GET /data-pipeline-report?company_id=...&report=validation|enrichment|conflicts
// Returns validation and enrichment reports for a company

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("company_id");
    const report = url.searchParams.get("report") ?? "all";

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

    const result: Record<string, unknown> = { company_id: companyId };

    if (report === "validation" || report === "all") {
      // Per-section validation summary
      const { data: validationData, error: vErr } = await supabase
        .from("entities_raw_extracted")
        .select("upload_section, validation_status, confidence_score, completeness_score")
        .eq("company_id", companyId);

      if (vErr) throw vErr;

      const sectionMap: Record<string, {
        total: number; validated: number; rejected: number; flagged: number;
        conf: number[]; comp: number[];
      }> = {};

      for (const row of validationData ?? []) {
        const s = row.upload_section ?? "unknown";
        if (!sectionMap[s]) sectionMap[s] = { total: 0, validated: 0, rejected: 0, flagged: 0, conf: [], comp: [] };
        sectionMap[s].total++;
        if (row.validation_status === "validated") sectionMap[s].validated++;
        else if (row.validation_status === "rejected") sectionMap[s].rejected++;
        else sectionMap[s].flagged++;
        sectionMap[s].conf.push(row.confidence_score ?? 0);
        sectionMap[s].comp.push(row.completeness_score ?? 0);
      }

      result.validation_report = Object.entries(sectionMap).map(([section, d]) => ({
        section,
        total_records: d.total,
        validated: d.validated,
        rejected: d.rejected,
        flagged: d.flagged,
        acceptance_rate: d.total > 0 ? Number((d.validated / d.total).toFixed(4)) : 0,
        avg_confidence: d.conf.length > 0 ? Number((d.conf.reduce((a, b) => a + b, 0) / d.conf.length).toFixed(4)) : 0,
        avg_completeness: d.comp.length > 0 ? Number((d.comp.reduce((a, b) => a + b, 0) / d.comp.length).toFixed(4)) : 0,
      }));
    }

    if (report === "enrichment" || report === "all") {
      const { data: enrichmentData, error: eErr } = await supabase
        .from("enrichment_logs")
        .select("entity_table, action, is_ai_generated, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (eErr) throw eErr;

      const actionMap: Record<string, { count: number; last_at: string; ai_count: number }> = {};
      for (const row of enrichmentData ?? []) {
        const key = `${row.entity_table}::${row.action}`;
        if (!actionMap[key]) actionMap[key] = { count: 0, last_at: row.created_at, ai_count: 0 };
        actionMap[key].count++;
        if (row.is_ai_generated) actionMap[key].ai_count++;
        if (row.created_at > actionMap[key].last_at) actionMap[key].last_at = row.created_at;
      }

      result.enrichment_status = Object.entries(actionMap).map(([key, d]) => {
        const [entity_table, action] = key.split("::");
        return { entity_table, action, count: d.count, ai_generated: d.ai_count, last_enriched: d.last_at };
      });
    }

    if (report === "conflicts" || report === "all") {
      // Records with anomalies in the extracted layer
      const { data: conflictData, error: cErr } = await supabase
        .from("entities_raw_extracted")
        .select("id, upload_section, extracted_fields, anomalies, confidence_score, validation_status, extraction_timestamp")
        .eq("company_id", companyId)
        .in("validation_status", ["flagged", "rejected"])
        .order("extraction_timestamp", { ascending: false })
        .limit(100);

      if (cErr) throw cErr;

      result.conflicts = (conflictData ?? []).map((row: any) => ({
        record_id: row.id,
        section: row.upload_section,
        validation_status: row.validation_status,
        confidence_score: row.confidence_score,
        anomalies: row.anomalies ?? [],
        extracted_at: row.extraction_timestamp,
      }));
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("data-pipeline-report error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Failed to generate report" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
