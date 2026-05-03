import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REGENERATION_REASON = "regeneration_after_protocol_upgrade";
const CONTRADICTION_WAIT_TIMEOUT_MS = 60 * 60 * 1000;
const SAFE_MAX_WAIT_MS = 115 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function inferPurgeMode() {
  const env = String(Deno.env.get("APP_ENV") || Deno.env.get("NODE_ENV") || "").toLowerCase();
  return env === "production" || env === "prod" ? "soft" : "hard";
}

function toArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

async function fetchRows(supabase: any, table: string, companyIds: string[]) {
  let query = supabase.from(table).select("*");
  if (companyIds.length > 0) query = query.in("company_id", companyIds);
  const { data, error } = await query;
  if (error) {
    return [];
  }
  return data || [];
}

async function invokeFunction(supabaseUrl: string, serviceRoleKey: string, functionName: string, body: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `${functionName} failed with status ${response.status}`);
  }
  return payload;
}

async function countDocuments(supabase: any, companyIds: string[]) {
  let query = supabase.from("company_documents").select("id", { count: "exact", head: true });
  if (companyIds.length > 0) query = query.in("company_id", companyIds);
  const { count } = await query;
  return Number(count || 0);
}

async function countEntities(supabase: any, companyIds: string[]) {
  let query = supabase.from("knowledge_entities").select("id", { count: "exact", head: true });
  if (companyIds.length > 0) {
    const { data: docRows } = await supabase.from("company_documents").select("id").in("company_id", companyIds);
    const docIds = (docRows || []).map((row: any) => row.id);
    if (docIds.length === 0) return 0;
    query = query.in("document_id", docIds);
  }
  const { count } = await query;
  return Number(count || 0);
}

async function createBackupSnapshot(supabase: any, regenerationId: string, companyIds: string[]) {
  const tables = [
    "company_documents",
    "document_ingestion_runs",
    "document_sections",
    "document_chunks",
    "knowledge_entities",
    "knowledge_relationships",
    "knowledge_insights",
    "knowledge_data_points",
    "entities_raw_extracted",
    "ingestion_contradictions",
    "field_history",
    "actions",
    "insights",
    "business_intelligence_reports",
    "orders",
    "opportunities",
    "products",
    "strategy",
    "customers",
    "company_contacts",
    "offers",
    "offer_products",
    "competitors",
  ];

  const snapshot: Record<string, unknown> = {};
  const companyDocuments = await fetchRows(supabase, "company_documents", companyIds);
  snapshot.company_documents = companyDocuments;
  const docIds = (companyDocuments as any[]).map((doc: any) => doc.id);

  for (const table of tables) {
    if (table === "company_documents") continue;

    if (["document_ingestion_runs", "document_sections", "document_chunks", "knowledge_entities", "knowledge_relationships", "knowledge_insights", "knowledge_data_points"].includes(table)) {
      if (docIds.length === 0) {
        snapshot[table] = [];
        continue;
      }
      const { data } = await supabase.from(table).select("*").in("document_id", docIds);
      snapshot[table] = data || [];
      continue;
    }

    if (table === "offer_products") {
      if (companyIds.length === 0) {
        const { data } = await supabase.from("offer_products").select("*");
        snapshot.offer_products = data || [];
      } else {
        const { data: offers } = await supabase.from("offers").select("id").in("company_id", companyIds);
        const offerIds = (offers || []).map((row: any) => row.id);
        if (offerIds.length === 0) {
          snapshot.offer_products = [];
        } else {
          const { data } = await supabase.from("offer_products").select("*").in("offer_id", offerIds);
          snapshot.offer_products = data || [];
        }
      }
      continue;
    }

    snapshot[table] = await fetchRows(supabase, table, companyIds);
  }

  await supabase.from("regeneration_backups").insert({
    regeneration_id: regenerationId,
    company_id: companyIds.length === 1 ? companyIds[0] : null,
    backup_tag: "pre_regeneration_backup",
    snapshot,
  });

  return { snapshot, sourceDocs: companyDocuments as any[] };
}

async function runRegeneration(params: {
  supabase: any;
  supabaseUrl: string;
  serviceRoleKey: string;
  companyId?: string;
  keepTemplates: boolean;
  initiatedBy?: string;
  reason?: string;
  dryRun?: boolean;
}) {
  const { supabase, supabaseUrl, serviceRoleKey, companyId, keepTemplates, initiatedBy, dryRun } = params;
  const reason = params.reason || REGENERATION_REASON;
  const purgeMode = inferPurgeMode();

  let companyIds: string[] = [];
  if (companyId) {
    companyIds = [companyId];
  } else {
    const { data: allCompanies } = await supabase.from("companies").select("id");
    companyIds = (allCompanies || []).map((row: any) => row.id);
  }

  const preDocumentCount = await countDocuments(supabase, companyIds);
  const preEntityCount = await countEntities(supabase, companyIds);
  const executionLog: Array<Record<string, unknown>> = [];
  const agentsExecuted: Array<Record<string, unknown>> = [];

  const { data: created, error: createError } = await supabase
    .from("regeneration_logs")
    .insert({
      company_id: companyIds.length === 1 ? companyIds[0] : null,
      initiated_by: initiatedBy || null,
      reason,
      status: dryRun ? "dry_run" : "running",
      keep_templates: keepTemplates,
      dry_run: !!dryRun,
      purge_mode: purgeMode,
      pre_entity_count: preEntityCount,
      pre_document_count: preDocumentCount,
      execution_log: executionLog,
      agents_executed: agentsExecuted,
      metadata: { timeout_ms: CONTRADICTION_WAIT_TIMEOUT_MS },
    })
    .select("id, started_at")
    .single();

  if (createError || !created) {
    throw new Error(createError?.message || "Could not create regeneration log");
  }

  const regenerationId = created.id as string;
  const startedAt = String(created.started_at);

  if (dryRun) {
    return {
      regenerationId,
      status: "dry_run",
      preDocumentCount,
      preEntityCount,
    };
  }

  executionLog.push({ step: "backup", at: new Date().toISOString(), status: "started" });
  const { sourceDocs } = await createBackupSnapshot(supabase, regenerationId, companyIds);
  executionLog.push({ step: "backup", at: new Date().toISOString(), status: "completed" });

  const docIds = sourceDocs.map((doc) => doc.id);

  executionLog.push({ step: "purge", at: new Date().toISOString(), status: "started" });

  if (docIds.length > 0) {
    await Promise.all([
      supabase.from("knowledge_relationships").delete().in("document_id", docIds),
      supabase.from("knowledge_insights").delete().in("document_id", docIds),
      supabase.from("knowledge_data_points").delete().in("document_id", docIds),
      supabase.from("knowledge_entities").delete().in("document_id", docIds),
      supabase.from("document_chunks").delete().in("document_id", docIds),
      supabase.from("document_sections").delete().in("document_id", docIds),
      supabase.from("document_ingestion_runs").delete().in("document_id", docIds),
    ]);
  }

  if (companyIds.length > 0) {
    const { data: offerRows } = await supabase.from("offers").select("id").in("company_id", companyIds);
    const offerIds = (offerRows || []).map((row: any) => row.id);
    if (offerIds.length > 0) {
      await supabase.from("offer_products").delete().in("offer_id", offerIds);
    }

    await Promise.all([
      supabase.from("entities_raw_extracted").delete().in("company_id", companyIds),
      supabase.from("ingestion_contradictions").delete().in("company_id", companyIds),
      supabase.from("actions").delete().in("company_id", companyIds),
      supabase.from("insights").delete().in("company_id", companyIds),
      supabase.from("business_intelligence_reports").delete().in("company_id", companyIds),
      supabase.from("orders").delete().in("company_id", companyIds),
      supabase.from("opportunities").delete().in("company_id", companyIds),
      supabase.from("products").delete().in("company_id", companyIds),
      supabase.from("strategy").delete().in("company_id", companyIds),
      supabase.from("customers").delete().in("company_id", companyIds),
      supabase.from("company_contacts").delete().in("company_id", companyIds),
      supabase.from("offers").delete().in("company_id", companyIds),
      supabase.from("competitors").delete().in("company_id", companyIds),
    ]);
  }

  await supabase.from("field_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  if (purgeMode === "hard") {
    if (docIds.length > 0) await supabase.from("company_documents").delete().in("id", docIds);
  } else {
    if (docIds.length > 0) {
      await supabase
        .from("company_documents")
        .update({
          processing_status: "pending",
          extracted_data: {},
          parsed_structure: {},
          semantic_summary: {},
          quality_score: null,
          processing_trace: {
            reset_at: new Date().toISOString(),
            reason,
          },
        })
        .in("id", docIds);
    }
  }

  executionLog.push({ step: "purge", at: new Date().toISOString(), status: "completed", mode: purgeMode });

  if (purgeMode === "hard" && sourceDocs.length > 0) {
    executionLog.push({ step: "restore_document_rows", at: new Date().toISOString(), status: "started" });
    const restoredRows = sourceDocs.map((doc) => ({
      ...doc,
      processing_status: "pending",
      extracted_data: {},
      parsed_structure: {},
      semantic_summary: {},
      quality_score: null,
    }));
    await supabase.from("company_documents").upsert(restoredRows);
    executionLog.push({ step: "restore_document_rows", at: new Date().toISOString(), status: "completed", count: restoredRows.length });
  }

  let ingestionDocs = sourceDocs;
  if (companyIds.length > 0) {
    const { data: docs } = await supabase.from("company_documents").select("id, company_id, file_name").in("company_id", companyIds).order("created_at", { ascending: true });
    ingestionDocs = docs || [];
  }

  executionLog.push({ step: "ingestion", at: new Date().toISOString(), status: "started", count: ingestionDocs.length });

  const batchSize = 5;
  let processedDocuments = 0;
  for (let i = 0; i < ingestionDocs.length; i += batchSize) {
    const batch = ingestionDocs.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (doc: any) => {
        try {
          await invokeFunction(supabaseUrl, serviceRoleKey, "process-document", { documentId: doc.id });
          processedDocuments += 1;
        } catch (error: any) {
          executionLog.push({
            step: "ingestion",
            at: new Date().toISOString(),
            document_id: doc.id,
            status: "failed",
            error: error?.message || String(error),
          });
        }
      }),
    );
  }

  executionLog.push({ step: "ingestion", at: new Date().toISOString(), status: "completed", processed: processedDocuments });

  executionLog.push({ step: "wait_for_contradictions", at: new Date().toISOString(), status: "started" });

  const requestedDeadline = Date.now() + CONTRADICTION_WAIT_TIMEOUT_MS;
  const safeDeadline = Date.now() + SAFE_MAX_WAIT_MS;
  let unresolvedCount = 0;

  while (Date.now() < requestedDeadline && Date.now() < safeDeadline) {
    let query = supabase
      .from("ingestion_contradictions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (companyIds.length > 0) query = query.in("company_id", companyIds);
    const { count } = await query;
    unresolvedCount = Number(count || 0);
    if (unresolvedCount === 0) break;

    await sleep(5000);
  }

  if (unresolvedCount > 0) {
    executionLog.push({
      step: "wait_for_contradictions",
      at: new Date().toISOString(),
      status: "manual_required",
      unresolved: unresolvedCount,
    });

    await supabase
      .from("regeneration_logs")
      .update({
        status: "waiting_manual_resolution",
        unresolved_contradictions: unresolvedCount,
        documents_processed: processedDocuments,
        execution_log: executionLog,
      })
      .eq("id", regenerationId);

    return {
      regenerationId,
      status: "waiting_manual_resolution",
      unresolvedContradictions: unresolvedCount,
      startedAt,
    };
  }

  executionLog.push({ step: "wait_for_contradictions", at: new Date().toISOString(), status: "completed" });

  for (const currentCompanyId of companyIds) {
    const { data: company } = await supabase.from("companies").select("*").eq("id", currentCompanyId).single();
    const { data: orders } = await supabase.from("orders").select("*").eq("company_id", currentCompanyId);
    const { data: opportunities } = await supabase.from("opportunities").select("*").eq("company_id", currentCompanyId);
    const { data: strategy } = await supabase.from("strategy").select("*").eq("company_id", currentCompanyId);
    const { data: products } = await supabase.from("products").select("*").eq("company_id", currentCompanyId);
    const { data: tasks } = await supabase.from("tasks").select("*").eq("company_id", currentCompanyId);

    const ordersData = JSON.stringify(orders || []);
    const opportunitiesData = JSON.stringify(opportunities || []);
    const strategyData = JSON.stringify(strategy || []);

    agentsExecuted.push({ agent: "portfolio_analysis", at: new Date().toISOString(), company_id: currentCompanyId, stage: "start" });
    const portfolioResult = await invokeFunction(supabaseUrl, serviceRoleKey, "analyze-portfolio", {
      companyProfile: company,
      ordersData,
      opportunitiesData,
      strategyData,
      analysisType: "comprehensive",
    });
    agentsExecuted.push({ agent: "portfolio_analysis", at: new Date().toISOString(), company_id: currentCompanyId, stage: "done" });

    agentsExecuted.push({ agent: "analysis_360", at: new Date().toISOString(), company_id: currentCompanyId, stage: "start" });
    const analysis360Result = await invokeFunction(supabaseUrl, serviceRoleKey, "analyze-360", {
      companyProfile: company,
      ordersSummary: orders || [],
      strategySummary: strategy || [],
      opportunitiesSummary: opportunities || [],
      productsSummary: products || [],
    });
    agentsExecuted.push({ agent: "analysis_360", at: new Date().toISOString(), company_id: currentCompanyId, stage: "done" });

    agentsExecuted.push({ agent: "proposal_generator", at: new Date().toISOString(), company_id: currentCompanyId, stage: "start" });
    const actionPool = await invokeFunction(supabaseUrl, serviceRoleKey, "generate-action-pool", {
      companyProfile: company,
      opportunities: opportunities || [],
      orders: orders || [],
      strategy: strategy || [],
      tasks: tasks || [],
      teamMembers: [],
    });

    const generatedActions = toArray(actionPool.actions).slice(0, 100).map((action: any) => ({
      company_id: currentCompanyId,
      title: String(action.title || "Generated action"),
      description: String(action.description || ""),
      priority: String(action.priority || "medium"),
      expected_impact: Number(action.estimatedRevenue || 0),
      required_effort: Number(action.estimatedHours || 0) > 6 ? "high" : Number(action.estimatedHours || 0) > 2 ? "medium" : "low",
      source_module: "regeneration_orchestrator",
      due_date: action.dueDate || null,
      metadata: {
        category: action.category || "analysis",
        rationale: action.rationale || null,
        action_content: action.actionContent || {},
      },
    }));

    if (generatedActions.length > 0) {
      await supabase.from("actions").insert(generatedActions);
    }
    agentsExecuted.push({ agent: "proposal_generator", at: new Date().toISOString(), company_id: currentCompanyId, stage: "done", actions: generatedActions.length });

    agentsExecuted.push({ agent: "content_generation", at: new Date().toISOString(), company_id: currentCompanyId, stage: "start" });
    await invokeFunction(supabaseUrl, serviceRoleKey, "generate-content", {
      contentType: "post",
      topic: `Regenerated strategic update for ${company?.company_name || "company"}`,
      companyProfile: company,
      productsData: JSON.stringify(products || []),
      targetPlatform: "linkedin",
      additionalContext: "Regeneration pipeline execution report",
      ordersContext: ordersData,
      opportunitiesContext: opportunitiesData,
      strategyContext: strategyData,
    });
    agentsExecuted.push({ agent: "content_generation", at: new Date().toISOString(), company_id: currentCompanyId, stage: "done" });

    agentsExecuted.push({ agent: "monitoring_forecasting", at: new Date().toISOString(), company_id: currentCompanyId, stage: "start" });
    await invokeFunction(supabaseUrl, serviceRoleKey, "business-intelligence", {
      reportId: crypto.randomUUID(),
      targetCompanyName: company?.company_name || "Company",
      targetCompanyWebsite: company?.website_url || null,
      companyId: currentCompanyId,
      analysisType: "regeneration_refresh",
      targetSubjectType: "company",
      analysisBrief: "Recompute monitoring and forecasting signals after full data regeneration",
    }).catch((error: any) => {
      executionLog.push({ step: "business_intelligence", at: new Date().toISOString(), status: "failed", error: error?.message || String(error) });
    });
    agentsExecuted.push({ agent: "monitoring_forecasting", at: new Date().toISOString(), company_id: currentCompanyId, stage: "done" });

    const reportRows = [
      {
        company_id: currentCompanyId,
        insight_type: "portfolio_regeneration",
        title: "Portfolio analysis regenerated",
        summary: JSON.stringify(portfolioResult).slice(0, 4000),
        source_module: "portfolio_analysis",
        metadata: { regeneration_id: regenerationId },
      },
      {
        company_id: currentCompanyId,
        insight_type: "analysis360_regeneration",
        title: "360 analysis regenerated",
        summary: JSON.stringify(analysis360Result).slice(0, 4000),
        source_module: "analysis_360",
        metadata: { regeneration_id: regenerationId },
      },
    ];
    await supabase.from("insights").insert(reportRows);
  }

  const postDocumentCount = await countDocuments(supabase, companyIds);
  const postEntityCount = await countEntities(supabase, companyIds);

  let staleQuery = supabase
    .from("knowledge_entities")
    .select("id", { count: "exact", head: true })
    .lt("created_at", startedAt);

  if (companyIds.length > 0) {
    const { data: companyDocs } = await supabase.from("company_documents").select("id").in("company_id", companyIds);
    const companyDocIds = (companyDocs || []).map((row: any) => row.id);
    if (companyDocIds.length > 0) staleQuery = staleQuery.in("document_id", companyDocIds);
  }
  const { count: staleCount } = await staleQuery;

  executionLog.push({
    step: "integrity_check",
    at: new Date().toISOString(),
    stale_entities: Number(staleCount || 0),
    pre_entities: preEntityCount,
    post_entities: postEntityCount,
    pre_documents: preDocumentCount,
    post_documents: postDocumentCount,
  });

  await supabase
    .from("regeneration_logs")
    .update({
      completed_at: new Date().toISOString(),
      status: "completed",
      documents_processed: processedDocuments,
      entities_processed: postEntityCount,
      pre_entity_count: preEntityCount,
      post_entity_count: postEntityCount,
      pre_document_count: preDocumentCount,
      post_document_count: postDocumentCount,
      contradictions_found: 0,
      contradictions_resolved_automatically: 0,
      unresolved_contradictions: 0,
      agents_executed: agentsExecuted,
      execution_log: executionLog,
      metadata: {
        stale_entity_count: Number(staleCount || 0),
        keep_templates: keepTemplates,
      },
    })
    .eq("id", regenerationId);

  return {
    regenerationId,
    status: "completed",
    preEntityCount,
    postEntityCount,
    preDocumentCount,
    postDocumentCount,
  };
}

async function rollbackRegeneration(supabase: any, regenerationId: string) {
  const { data: backupRow, error: backupError } = await supabase
    .from("regeneration_backups")
    .select("*")
    .eq("regeneration_id", regenerationId)
    .eq("backup_tag", "pre_regeneration_backup")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (backupError || !backupRow) {
    throw new Error(backupError?.message || "Backup snapshot not found");
  }

  const snapshot = (backupRow.snapshot || {}) as Record<string, any[]>;
  const companyIds = unique(toArray(snapshot.company_documents).map((row: any) => row.company_id).filter(Boolean));
  const docIds = toArray(snapshot.company_documents).map((row: any) => row.id);

  if (docIds.length > 0) {
    await Promise.all([
      supabase.from("knowledge_relationships").delete().in("document_id", docIds),
      supabase.from("knowledge_insights").delete().in("document_id", docIds),
      supabase.from("knowledge_data_points").delete().in("document_id", docIds),
      supabase.from("knowledge_entities").delete().in("document_id", docIds),
      supabase.from("document_chunks").delete().in("document_id", docIds),
      supabase.from("document_sections").delete().in("document_id", docIds),
      supabase.from("document_ingestion_runs").delete().in("document_id", docIds),
      supabase.from("company_documents").delete().in("id", docIds),
    ]);
  }

  if (companyIds.length > 0) {
    const { data: offerRows } = await supabase.from("offers").select("id").in("company_id", companyIds);
    const offerIds = (offerRows || []).map((row: any) => row.id);
    if (offerIds.length > 0) {
      await supabase.from("offer_products").delete().in("offer_id", offerIds);
    }
    await Promise.all([
      supabase.from("entities_raw_extracted").delete().in("company_id", companyIds),
      supabase.from("ingestion_contradictions").delete().in("company_id", companyIds),
      supabase.from("actions").delete().in("company_id", companyIds),
      supabase.from("insights").delete().in("company_id", companyIds),
      supabase.from("business_intelligence_reports").delete().in("company_id", companyIds),
      supabase.from("orders").delete().in("company_id", companyIds),
      supabase.from("opportunities").delete().in("company_id", companyIds),
      supabase.from("products").delete().in("company_id", companyIds),
      supabase.from("strategy").delete().in("company_id", companyIds),
      supabase.from("customers").delete().in("company_id", companyIds),
      supabase.from("company_contacts").delete().in("company_id", companyIds),
      supabase.from("offers").delete().in("company_id", companyIds),
      supabase.from("competitors").delete().in("company_id", companyIds),
    ]);
  }

  const restoreOrder = [
    "company_documents",
    "document_ingestion_runs",
    "document_sections",
    "document_chunks",
    "knowledge_entities",
    "knowledge_relationships",
    "knowledge_insights",
    "knowledge_data_points",
    "entities_raw_extracted",
    "ingestion_contradictions",
    "field_history",
    "orders",
    "opportunities",
    "products",
    "strategy",
    "customers",
    "company_contacts",
    "offers",
    "offer_products",
    "competitors",
    "actions",
    "insights",
    "business_intelligence_reports",
  ];

  for (const table of restoreOrder) {
    const rows = toArray(snapshot[table]);
    if (rows.length === 0) continue;
    const { error } = await supabase.from(table).upsert(rows);
    if (error) {
      throw new Error(`Could not restore table ${table}: ${error.message}`);
    }
  }

  await supabase.from("regeneration_logs").update({ status: "rolled_back", completed_at: new Date().toISOString() }).eq("id", regenerationId);

  return {
    regenerationId,
    status: "rolled_back",
    restoredTables: restoreOrder,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const companyId = url.searchParams.get("companyId") || body.companyId;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (url.pathname.endsWith("/documents/status")) {
      let query = supabase.from("documents_status").select("*").order("created_at", { ascending: false });
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse({ documents: data || [] });
    }

    if (url.pathname.endsWith("/data/validation-report")) {
      let query = supabase.from("data_validation_report").select("*").order("section");
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse({ validation_report: data || [] });
    }

    if (url.pathname.endsWith("/data/enrichment-status")) {
      let query = supabase.from("data_enrichment_status").select("*").order("entity_table");
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse({ enrichment_status: data || [] });
    }

    if (url.pathname.endsWith("/data/conflicts")) {
      let query = supabase.from("data_conflicts").select("*").order("created_at", { ascending: false });
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse({ conflicts: data || [] });
    }

    if (req.method === "POST" && (url.pathname.endsWith("/api/admin/regenerate/start") || body.action === "admin.regenerate.start")) {
      const result = await runRegeneration({
        supabase,
        supabaseUrl,
        serviceRoleKey,
        companyId: companyId || undefined,
        keepTemplates: Boolean(body.keepTemplates),
        initiatedBy: body.userId || null,
        reason: body.reason || REGENERATION_REASON,
        dryRun: Boolean(body.dryRun),
      });
      return jsonResponse(result);
    }

    if (req.method === "GET" && (url.pathname.endsWith("/api/admin/regenerate/status") || url.searchParams.get("action") === "admin.regenerate.status")) {
      const requestedRegenId = url.searchParams.get("regenerationId");
      let query = supabase.from("regeneration_logs").select("*").order("started_at", { ascending: false }).limit(1);

      if (requestedRegenId) query = supabase.from("regeneration_logs").select("*").eq("id", requestedRegenId).limit(1);
      if (!requestedRegenId && companyId) query = query.eq("company_id", companyId);

      const { data, error } = await query;
      if (error) throw error;

      const log = (data || [])[0] || null;
      let pendingContradictions: any[] = [];
      if (log) {
        let contradictionQuery = supabase
          .from("ingestion_contradictions")
          .select("id, entity_hash, entity_name, field_name, value_a, value_b, source_a, source_b, status, confidence_score, low_confidence, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(100);
        if (log.company_id) contradictionQuery = contradictionQuery.eq("company_id", log.company_id);
        const { data: contradictions } = await contradictionQuery;
        pendingContradictions = contradictions || [];
      }

      return jsonResponse({ log, pendingContradictions });
    }

    if (req.method === "POST" && (url.pathname.endsWith("/api/admin/regenerate/rollback") || body.action === "admin.regenerate.rollback")) {
      const regenerationId = String(body.regenerationId || "").trim();
      if (!regenerationId) {
        return jsonResponse({ error: "regenerationId is required" }, 400);
      }
      const result = await rollbackRegeneration(supabase, regenerationId);
      return jsonResponse(result);
    }

    return jsonResponse({
      error: "Unknown endpoint",
      available: [
        "/documents/status",
        "/data/validation-report",
        "/data/enrichment-status",
        "/data/conflicts",
        "/api/admin/regenerate/start",
        "/api/admin/regenerate/status",
        "/api/admin/regenerate/rollback",
      ],
    }, 404);
  } catch (err: any) {
    console.error("data-api error:", err);
    return jsonResponse({ error: err?.message || "Unexpected API error" }, 500);
  }
});
