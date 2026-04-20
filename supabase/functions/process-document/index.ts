import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildFallbackExtraction } from "../_shared/documentFallback.ts";
import { normalizeOpportunityStatus, parseFlexibleNumber, persistIngestionArtifacts, runDocumentIngestionPipeline } from "../_shared/ingestionPipeline.ts";
import { getSectionSchema, buildExtractionPrompt, NON_CANONICAL_SECTIONS } from "../_shared/sectionSchemas.ts";
import { validateBatch } from "../_shared/validationEngine.ts";

const categoryTableMapping: Record<string, string> = {
  contacts: "company_contacts",
  leads: "company_contacts",
  customers: "customers",
  sales: "orders",
  offers: "offers",
  strategy: "strategy",
  products: "products",
  employees: "company_contacts",
  finance: "company_info_update",
  market: "company_info_update",
  competitors: "competitors",
};

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Section-constrained AI extraction using the section schema prompt
// ---------------------------------------------------------------------------
async function runSectionExtraction(
  aiKey: string,
  category: string,
  textContent: string,
  companyContext: string,
): Promise<{ records: Record<string, unknown>[]; confidence: number; missing_fields: string[]; anomalies: string[] }> {
  const prompt = buildExtractionPrompt(category, textContent.slice(0, 80000), companyContext);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a strict data extraction agent. Extract only the data belonging to the specified section. Return valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) return { records: [], confidence: 0, missing_fields: [], anomalies: [`AI extraction failed: HTTP ${response.status}`] };

    const json = await response.json();
    const raw = json?.choices?.[0]?.message?.content;
    if (!raw) return { records: [], confidence: 0, missing_fields: [], anomalies: ["AI returned empty response"] };

    const parsed = JSON.parse(raw);
    return {
      records: Array.isArray(parsed.extracted_records) ? parsed.extracted_records : [],
      confidence: typeof parsed.confidence_score === "number" ? Math.min(1, Math.max(0, parsed.confidence_score)) : 0.6,
      missing_fields: Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [],
      anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
    };
  } catch {
    return { records: [], confidence: 0, missing_fields: [], anomalies: ["AI extraction threw an error"] };
  }
}

// ---------------------------------------------------------------------------
// Write extracted + validated records to entities_raw_extracted (Layer 2)
// Returns array of { rawExtractedId, record, validationResult }
// ---------------------------------------------------------------------------
async function persistRawExtracted(
  supabase: any,
  documentId: string,
  companyId: string,
  category: string,
  validatedBatch: ReturnType<typeof validateBatch>,
  aiConfidence: number,
  missingFields: string[],
  anomalies: string[],
): Promise<Array<{ rawExtractedId: string; record: Record<string, unknown> }>> {
  const schema = getSectionSchema(category);
  const schemaVersion = schema?.schemaVersion ?? "1.0";
  const timestamp = nowIso();
  const result: Array<{ rawExtractedId: string; record: Record<string, unknown> }> = [];

  const allRecords = [
    ...validatedBatch.validated.map((r) => ({ ...r, status: "validated" as const })),
    ...validatedBatch.rejected.map((r) => ({ ...r, status: "rejected" as const })),
    ...validatedBatch.flagged.map((r) => ({ ...r, status: "flagged" as const })),
  ];

  for (const item of allRecords) {
    const { data, error } = await supabase.from("entities_raw_extracted").insert({
      document_id: documentId,
      company_id: companyId,
      upload_section: category,
      schema_version: schemaVersion,
      extracted_fields: item.record,
      missing_fields: item.result.errors.map((e) => e.field),
      anomalies: [...item.result.errors.map((e) => e.message), ...item.result.warnings, ...anomalies],
      confidence_score: item.result.confidence_score,
      completeness_score: item.result.completeness_score,
      consistency_score: item.result.consistency_score,
      validation_status: item.status,
      rejection_reason: item.status !== "validated" ? item.result.errors.map((e) => e.message).join("; ") : null,
      extraction_timestamp: timestamp,
      source_type: "document",
    }).select("id").single();

    if (!error && data?.id) {
      result.push({ rawExtractedId: data.id, record: item.record });
    }
  }

  return result;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

async function readDocumentText(fileData: Blob, mime: string, fileName: string, fileSize: number) {
  if (mime.includes("text") || fileName.endsWith(".csv") || fileName.endsWith(".txt") || fileName.endsWith(".md") || fileName.endsWith(".json")) {
    const text = await fileData.text();
    return { textContent: text, rawContent: text };
  }

  if (mime.includes("spreadsheet") || mime.includes("excel") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const buffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return {
      textContent: `[Binary spreadsheet: ${fileName}, size: ${fileSize} bytes]\n${uint8ToBase64(bytes).slice(0, 60000)}`,
      rawContent: buffer,
    };
  }

  const buffer = await fileData.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 100000));
  return {
    textContent: `[Binary document: ${fileName}, type: ${mime}, size: ${fileSize} bytes]\n${uint8ToBase64(bytes)}`,
    rawContent: buffer,
  };
}

// ---------------------------------------------------------------------------
// Build canonical record with universal meta structure
// ---------------------------------------------------------------------------
function buildMetaFields(
  companyId: string,
  documentId: string,
  category: string,
  rawExtractedId: string | undefined,
  validationResult: { confidence_score: number; completeness_score: number; consistency_score: number },
): Record<string, unknown> {
  return {
    company_id: companyId,
    source_document_id: documentId,
    source_type: "document",
    extraction_timestamp: nowIso(),
    uploaded_section: category,
    confidence_score: validationResult.confidence_score,
    completeness_score: validationResult.completeness_score,
    consistency_score: validationResult.consistency_score,
    validation_status: "validated",
    record_version: 1,
    raw_extracted_id: rawExtractedId ?? null,
  };
}

async function persistValidatedCanonicalRecords(
  supabase: any,
  doc: any,
  table: string,
  validatedItems: Array<{ rawExtractedId: string; record: Record<string, unknown>; validationResult: { confidence_score: number; completeness_score: number; consistency_score: number } }>,
): Promise<number> {
  if (validatedItems.length === 0 || table === "none" || table === "company_info_update") return 0;

  let insertedCount = 0;

  for (const { rawExtractedId, record: r, validationResult } of validatedItems) {
    const meta = buildMetaFields(doc.company_id, doc.id, doc.category, rawExtractedId, validationResult);

    try {
      if (table === "offers") {
        const sellingPrice = parseFlexibleNumber(r.total_value ?? r.est_revenue ?? 0);
        const cost = parseFlexibleNumber(r.cost_estimation ?? 0);
        const margin = parseFlexibleNumber(r.expected_margin ?? 0);

        const offerPayload = {
          ...meta,
          offer_number: r.offer_number ?? r.opp_number ?? `OFF-${Date.now()}`,
          title: r.title ?? r.scope ?? r.customer_name ?? "Commercial Offer",
          customer_name: r.customer_name ?? "",
          project_description: r.description ?? r.scope ?? "",
          status: normalizeOpportunityStatus((r.status as string) ?? "open"),
          total_value: sellingPrice,
          currency: r.currency ?? "EUR",
          truth_source: "sales_document",
          margin_percentage: sellingPrice > 0 ? Number(((margin / sellingPrice) * 100).toFixed(4)) : null,
          source_document_id: doc.id,
          uploaded_section: doc.category,
          raw_extracted_id: rawExtractedId,
        };

        const { data: savedOffer, error: offerError } = await supabase.from("offers").insert(offerPayload).select("id").single();
        if (offerError) { console.error("Offer insert error:", offerError.message); continue; }

        insertedCount += 1;
        const items = [...(Array.isArray(r.items) ? r.items : []), ...(Array.isArray(r.products) ? r.products : [])] as any[];
        if (savedOffer?.id && items.length > 0) {
          const lineItems = items.map((item: any) => ({
            offer_id: savedOffer.id,
            external_product_name: item.name ?? item.product_name ?? item.description ?? "Unnamed item",
            manufacturer_name: item.manufacturer ?? item.brand ?? "external",
            line_type: item.type ?? "product",
            quantity: parseFlexibleNumber(item.quantity ?? 1) || 1,
            unit_price: parseFlexibleNumber(item.unit_price ?? item.price ?? 0),
            total_price: parseFlexibleNumber(item.total_price ?? item.total ?? item.price ?? 0),
            notes: item.notes ?? "",
          }));
          const { error: lineItemError } = await supabase.from("offer_products").insert(lineItems);
          if (lineItemError) console.error("Offer line insert error:", lineItemError.message);
        }
        continue;
      }

      const clean: Record<string, unknown> = { ...meta };

      if (table === "orders") {
        const sellingPrice = parseFlexibleNumber(r.selling_price ?? r.sellingPrice ?? 0);
        const margin = parseFlexibleNumber(r.margin ?? 0);
        clean.po_date = r.po_date ?? r.poDate ?? "";
        clean.customer_name = r.customer_name ?? r.customerName ?? "";
        clean.product_family = r.product_family ?? r.productFamily ?? "";
        clean.region = r.region ?? "";
        clean.country = r.country ?? "";
        clean.segment = r.segment ?? "";
        clean.selling_price = sellingPrice;
        clean.margin = margin;
        clean.margin_percentage = sellingPrice > 0 ? Number(((margin / sellingPrice) * 100).toFixed(4)) : null;
        clean.kam = r.kam ?? "";
        clean.purchasing_year = r.purchasing_year ?? r.purchasingYear ?? "";
        clean.purchasing_quarter = r.purchasing_quarter ?? r.purchasingQuarter ?? "";
        clean.scope = r.scope ?? "";
        clean.truth_source = "sales_document";
      } else if (table === "opportunities") {
        const estRevenue = parseFlexibleNumber(r.est_revenue ?? r.estRevenue ?? 0);
        const margin = parseFlexibleNumber(r.margin ?? 0);
        clean.opp_number = r.opp_number ?? r.oppNumber ?? "";
        clean.status = normalizeOpportunityStatus((r.status as string) ?? "open");
        clean.customer_name = r.customer_name ?? r.customerName ?? "";
        clean.product_family = r.product_family ?? r.productFamily ?? "";
        clean.region = r.region ?? "";
        clean.est_revenue = estRevenue;
        clean.contract_prob = parseFlexibleNumber(r.contract_prob ?? r.contractProb ?? r.probability ?? 0);
        clean.margin = margin;
        clean.margin_percentage = estRevenue > 0 ? Number(((margin / estRevenue) * 100).toFixed(4)) : null;
        clean.kam = r.kam ?? "";
        clean.est_purchasing_year = r.est_purchasing_year ?? "";
        clean.truth_source = "sales_document";
      } else if (table === "strategy") {
        clean.product_family = r.product_family ?? r.productFamily ?? "";
        clean.number_of_segment = r.number_of_segment ?? r.numberOfSegment ?? "";
        clean.region = r.region ?? "";
        clean.est_purchasing_quarter = r.est_purchasing_quarter ?? "";
        clean.est_revenue = parseFlexibleNumber(r.est_revenue ?? r.estRevenue ?? 0);
        clean.margin = parseFlexibleNumber(r.margin ?? 0);
        clean.kam = r.kam ?? "";
      } else if (table === "products") {
        clean.name = r.name ?? "";
        clean.average_value = parseFlexibleNumber(r.average_value ?? r.averageValue ?? 0);
        clean.type = r.type ?? "";
        clean.comments = r.comments ?? "";
      } else if (table === "company_contacts") {
        clean.name = (r.name ?? r.lead_name ?? r.leadName ?? "") as string;
        clean.email = r.email ?? "";
        clean.role = r.role ?? r.job_title ?? "";
        clean.department = r.department ?? "";
        clean.notes = r.notes ?? r.phone ?? "";
      } else if (table === "customers") {
        clean.customer_name = r.customer_name ?? r.customerName ?? r.name ?? "";
        clean.account_tier = r.account_tier ?? r.tier ?? "";
        clean.strategic_importance = parseFlexibleNumber(r.strategic_importance ?? r.importance ?? 0);
        clean.growth_potential = parseFlexibleNumber(r.growth_potential ?? r.growth ?? 0);
        clean.relationship_strength = parseFlexibleNumber(r.relationship_strength ?? r.relationship ?? 0);
        clean.operating_region = r.region ?? r.operating_region ?? "";
        clean.sector = r.sector ?? r.segment ?? "";
        clean.notes = r.notes ?? "";
      } else if (table === "competitors") {
        clean.competitor_name = r.competitor_name ?? r.name ?? "";
        clean.product_family = r.product_family ?? r.productFamily ?? "";
        clean.positioning = r.positioning ?? "";
        clean.price_positioning = r.price_positioning ?? r.pricePositioning ?? "";
        clean.value_proposition = r.value_proposition ?? r.valueProposition ?? "";
        clean.strengths = r.strengths ?? [];
        clean.weaknesses = r.weaknesses ?? [];
        clean.evidence = r.evidence ?? {};
      }

      const { error } = await supabase.from(table).insert(clean);
      if (error) {
        console.error(`${table} insert error:`, error.message);
      } else {
        insertedCount += 1;
      }
    } catch (err: any) {
      console.error(`Error inserting to ${table}:`, err?.message ?? err);
    }
  }

  return insertedCount;
}

async function persistCompanyUpdates(supabase: any, doc: any, extractedData: any) {
  if (!extractedData.company_info_updates || Object.keys(extractedData.company_info_updates).length === 0) return;

  const allowedFields = [
    "industry", "sub_sector", "annual_revenue", "employee_count", "main_products",
    "main_competitors", "main_customer_segments", "operating_regions", "headquarters",
    "sales_channels", "current_challenges", "strategic_goals", "business_description",
    "market_context", "strategy_context", "objectives",
  ];

  const safeUpdates: any = {};
  for (const [key, value] of Object.entries(extractedData.company_info_updates)) {
    if (allowedFields.includes(key) && value) safeUpdates[key] = value;
  }

  if (Object.keys(safeUpdates).length > 0) {
    await supabase.from("companies").update(safeUpdates).eq("id", doc.company_id);
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId } = await req.json();
    if (!documentId) throw new Error("documentId is required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";

    const { data: doc, error: docErr } = await supabase
      .from("company_documents")
      .select("*")
      .eq("id", documentId)
      .single();
    if (docErr || !doc) throw new Error("Document not found");

    // Mark pipeline stage: ingested → preprocessing
    await supabase.from("company_documents").update({
      processing_status: "processing",
      pipeline_stage: "preprocessing",
      upload_section: doc.upload_section ?? doc.category,
    }).eq("id", documentId);

    // ── LAYER 1: Raw file download ──────────────────────────────────────────
    const { data: fileData, error: dlErr } = await supabase.storage.from("company-documents").download(doc.file_path);
    if (dlErr || !fileData) throw new Error(`Failed to download file: ${dlErr?.message || "unknown"}`);

    const { data: company } = await supabase
      .from("companies")
      .select("company_name, industry, main_products, business_description")
      .eq("id", doc.company_id)
      .single();

    const companyContext = company
      ? `Company: ${company.company_name}. Industry: ${company.industry || "unknown"}. Products: ${company.main_products || "unknown"}. Description: ${company.business_description || "N/A"}.`
      : "No company context available.";

    const targetTable = categoryTableMapping[doc.category] || "none";
    const { textContent, rawContent } = await readDocumentText(fileData, doc.mime_type || "", doc.file_name || "", doc.file_size || 0);
    const trimmedText = textContent.length > 100000 ? `${textContent.slice(0, 100000)}\n[TRUNCATED]` : textContent;

    // ── LAYER 2: Section-constrained extraction ─────────────────────────────
    await supabase.from("company_documents").update({ pipeline_stage: "extracting" }).eq("id", documentId);

    const sectionSchema = getSectionSchema(doc.category);

    // Run section-constrained AI extraction (new pipeline)
    const sectionExtraction = lovableKey
      ? await runSectionExtraction(lovableKey, doc.category, trimmedText, companyContext)
      : { records: [], confidence: 0, missing_fields: [], anomalies: ["No AI key available — section extraction skipped"] };

    // Legacy fallback extraction (always runs for backward compatibility)
    const legacyFallback = buildFallbackExtraction({ category: doc.category, fileName: doc.file_name || "document", targetTable }, rawContent || trimmedText);

    // Merge: prefer section-extracted records when available, fall back to legacy
    const candidateRecords: Record<string, unknown>[] = sectionExtraction.records.length > 0
      ? sectionExtraction.records
      : (legacyFallback.extracted_records || []);

    // ── VALIDATION GATE ─────────────────────────────────────────────────────
    await supabase.from("company_documents").update({ pipeline_stage: "validating" }).eq("id", documentId);

    const batchResult = sectionSchema
      ? validateBatch(candidateRecords, sectionSchema, sectionExtraction.confidence)
      : { validated: candidateRecords.map((r) => ({ record: r, result: { confidence_score: 0.5, completeness_score: 0.5, consistency_score: 0.5, status: "flagged" as const, valid: false, errors: [], warnings: [] } })), rejected: [], flagged: [], summary: { total: candidateRecords.length, validated_count: candidateRecords.length, rejected_count: 0, flagged_count: 0, avg_confidence: 0.5 } };

    // Write ALL records (validated + rejected + flagged) to Layer 2
    const rawExtractedEntries = await persistRawExtracted(
      supabase,
      doc.id,
      doc.company_id,
      doc.category,
      batchResult,
      sectionExtraction.confidence,
      sectionExtraction.missing_fields,
      sectionExtraction.anomalies,
    );

    // Map rawExtractedId back to validated items
    const validatedWithIds = batchResult.validated.map((item, idx) => ({
      rawExtractedId: rawExtractedEntries[idx]?.rawExtractedId ?? "",
      record: item.record,
      validationResult: item.result,
    }));

    // ── KNOWLEDGE GRAPH pipeline (semantic ingestion) ───────────────────────
    await supabase.from("company_documents").update({ pipeline_stage: "knowledge_extraction" }).eq("id", documentId);

    let pipelineResult = await runDocumentIngestionPipeline({
      docId: doc.id,
      companyId: doc.company_id,
      category: doc.category,
      fileName: doc.file_name || "document",
      mimeType: doc.mime_type || "",
      textContent: trimmedText,
      companyContext,
      aiKey: lovableKey,
      strictMode: false,
    });

    if (!pipelineResult.qualityGate.accepted) {
      pipelineResult = await runDocumentIngestionPipeline({
        docId: doc.id,
        companyId: doc.company_id,
        category: doc.category,
        fileName: doc.file_name || "document",
        mimeType: doc.mime_type || "",
        textContent: trimmedText,
        companyContext,
        aiKey: lovableKey,
        strictMode: true,
      });
    }

    const semanticSummary = {
      sections: pipelineResult.parsed.sections.length,
      chunks: pipelineResult.chunks.length,
      entities: pipelineResult.knowledge.entities.length,
      relationships: pipelineResult.knowledge.relationships.length,
      insights: pipelineResult.knowledge.insights.length,
      dataPoints: pipelineResult.knowledge.dataPoints.length,
    };

    const extractedData = {
      ...legacyFallback,
      summary: pipelineResult.summary,
      record_count: batchResult.summary.validated_count,
      confidence_score: Math.round(batchResult.summary.avg_confidence * 100),
      validation_summary: batchResult.summary,
      data_quality_notes: unique([...(legacyFallback.data_quality_notes || []), ...pipelineResult.qualityGate.issues, ...sectionExtraction.anomalies]),
      target_table: targetTable,
      semantic_counts: semanticSummary,
      parsed_structure: pipelineResult.parsed.sections.map((section) => ({ heading: section.heading, type: section.kind, level: section.level })),
      agent_audit: pipelineResult.agentAudit,
      quality_gate: pipelineResult.qualityGate,
      processed_at: nowIso(),
    };

    const documentUpdatePayload = {
      extracted_data: extractedData,
      raw_text: trimmedText,
      cleaned_text: trimmedText,
      parsed_structure: extractedData.parsed_structure,
      semantic_summary: semanticSummary,
      quality_score: batchResult.summary.avg_confidence,
      processing_trace: {
        audit: pipelineResult.agentAudit,
        qualityGate: pipelineResult.qualityGate,
        validationSummary: batchResult.summary,
        processedAt: extractedData.processed_at,
      },
    };

    // If quality gate failed AND no validated records exist, mark as failed
    if (!pipelineResult.qualityGate.accepted && batchResult.summary.validated_count === 0) {
      await supabase.from("company_documents").update({
        ...documentUpdatePayload,
        processing_status: "failed",
        pipeline_stage: "failed",
      }).eq("id", documentId);

      return new Response(JSON.stringify({
        success: false,
        summary: pipelineResult.summary,
        confidence: extractedData.confidence_score,
        dataQualityNotes: extractedData.data_quality_notes,
        validationSummary: batchResult.summary,
        error: pipelineResult.qualityGate.issues.join(" "),
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Persist knowledge graph artifacts ──────────────────────────────────
    let semanticStorageMode: "full" | "document-only" = "full";
    try {
      await persistIngestionArtifacts(supabase, {
        documentId: doc.id,
        companyId: doc.company_id,
        parsed: pipelineResult.parsed,
        chunks: pipelineResult.chunks,
        knowledge: pipelineResult.knowledge,
        qualityGate: pipelineResult.qualityGate,
        summary: pipelineResult.summary,
        legacyExtraction: extractedData,
      });
    } catch (storageError: any) {
      semanticStorageMode = "document-only";
      extractedData.data_quality_notes = unique([
        ...(extractedData.data_quality_notes || []),
        `Semantic knowledge tables unavailable: ${storageError?.message || "unknown error"}`,
      ]);
      console.warn("Semantic persistence degraded:", storageError?.message || storageError);
    }

    // ── LAYER 3: Write only validated records to canonical tables ──────────
    await supabase.from("company_documents").update({ pipeline_stage: "storing" }).eq("id", documentId);

    const insertedCount = NON_CANONICAL_SECTIONS.has(doc.category)
      ? 0
      : await persistValidatedCanonicalRecords(supabase, doc, targetTable, validatedWithIds);

    await persistCompanyUpdates(supabase, doc, extractedData);

    await supabase.from("company_documents").update({
      ...documentUpdatePayload,
      extracted_data: { ...extractedData, semantic_storage_mode: semanticStorageMode },
      processing_status: "completed",
      pipeline_stage: "completed",
    }).eq("id", documentId);

    return new Response(JSON.stringify({
      success: true,
      summary: pipelineResult.summary,
      recordCount: insertedCount,
      confidence: extractedData.confidence_score,
      validationSummary: batchResult.summary,
      dataQualityNotes: extractedData.data_quality_notes,
      semanticCounts: semanticSummary,
      audit: pipelineResult.agentAudit,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("process-document error:", err);
    const message = err?.message || "Unexpected processing error";
    const transient = /temporary|temporarily|timeout|timed out|failed to fetch|network|rate limit|gateway error: 5/i.test(message);

    try {
      const { documentId } = await req.clone().json();
      if (documentId) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("company_documents").update({ processing_status: transient ? "pending" : "failed", pipeline_stage: "failed" }).eq("id", documentId);
      }
    } catch {
      // Ignore cleanup errors.
    }

    return new Response(JSON.stringify({ error: message, transient }), {
      status: transient ? 503 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
