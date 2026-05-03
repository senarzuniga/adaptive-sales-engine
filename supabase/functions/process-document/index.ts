import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildFallbackExtraction } from "../_shared/documentFallback.ts";
import { CanonicalStorageService, DataEnrichmentService, DocumentIngestionService, PreprocessingService, SectionBasedExtractionService, ValidationService } from "../_shared/canonicalPipeline.ts";
import { buildConceptIntelligence } from "../_shared/conceptIntelligence.ts";
import { normalizeOpportunityStatus, parseFlexibleNumber, persistIngestionArtifacts, runDocumentIngestionPipeline } from "../_shared/ingestionPipeline.ts";

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

async function persistStructuredRecords(supabase: any, doc: any, table: string, extractedData: any) {
  const rawRecords = Array.isArray(extractedData.raw_extracted_records) ? extractedData.raw_extracted_records : [];
  const enrichedRecords = Array.isArray(extractedData.enriched_records) ? extractedData.enriched_records : [];
  const enrichmentLogs = Array.isArray(extractedData.enrichment_logs) ? extractedData.enrichment_logs : [];

  if (rawRecords.length > 0) {
    try {
      await supabase.from("entities_raw_extracted").delete().eq("source_document_id", doc.id);
      await supabase.from("entities_raw_extracted").insert(rawRecords.map((record: any) => ({
        company_id: doc.company_id,
        section: record.section,
        extracted_fields: record.extracted_fields || {},
        confidence_score: Number(record.confidence_score || 0),
        source_document_id: doc.id,
        source_type: record.source_type || "document_upload",
        extraction_timestamp: record.extraction_timestamp || new Date().toISOString(),
        uploaded_section: record.uploaded_section || doc.category,
        completeness_score: Number(record.completeness_score || 0),
        consistency_score: Number(record.consistency_score || 0),
        validation_status: record.validation_status || "raw_extracted",
        validation_issues: record.validation_issues || [],
        version: Number(record.version || 1),
      })));
    } catch (rawError: any) {
      console.warn("Raw extracted persistence degraded:", rawError?.message || rawError);
    }
  }

  if (enrichmentLogs.length > 0) {
    try {
      await supabase.from("enrichment_logs").insert(enrichmentLogs.map((log: any) => ({
        company_id: doc.company_id,
        source_document_id: doc.id,
        entity_table: table,
        entity_id: log.entity_key,
        action: log.action,
        details: log.details || {},
        confidence_after: log.confidence_after,
        created_at: log.created_at || new Date().toISOString(),
      })));
    } catch (logError: any) {
      console.warn("Enrichment log persistence degraded:", logError?.message || logError);
    }
  }

  const validatedRecords = enrichedRecords.filter((record: any) => {
    const status = String(record.validation_status || '').toLowerCase();
    return (status === 'validated' || status === 'enriched') && Number(record.confidence_score || 0) >= 0.75;
  });

  let records = validatedRecords;
  if (table === 'products' && records.length === 0) {
    const permissiveCandidates = [...enrichedRecords, ...rawRecords].filter((record: any) => {
      const fields = record.normalized_fields || record.extracted_fields || {};
      const name = String(fields.name || fields.product || fields.product_name || fields.text || '').trim();
      const valueCandidate = parseFlexibleNumber(fields.selling_price || fields.average_value || fields.price || fields.pvp_cliente || fields.venta || 0);
      return name.length > 0 || valueCandidate > 0;
    });

    records = permissiveCandidates.map((record: any) => ({
      ...record,
      validation_status: record.validation_status || 'validated',
      confidence_score: Number(record.confidence_score || 0.75),
    }));
  }

  if (records.length === 0 || table === "none" || table === "company_info_update") return 0;

  const buildMeta = (record: any) => ({
    company_id: doc.company_id,
    source_document_id: doc.id,
    source_type: record.source_type || "document_upload",
    extraction_timestamp: record.extraction_timestamp || new Date().toISOString(),
    uploaded_section: record.uploaded_section || doc.category,
    confidence_score: Number(record.confidence_score || 0),
    completeness_score: Number(record.completeness_score || 0),
    consistency_score: Number(record.consistency_score || 0),
    validation_status: record.validation_status || "enriched",
    version: Number(record.version || 1),
    data_maturity: record.data_maturity || "enriched",
    ai_insights: record.ai_insights || {},
    relationship_refs: record.linked_entities || {},
    derived_metrics: record.derived_metrics || {},
    historical_tracking: [{ source_document_id: doc.id, processed_at: record.extraction_timestamp || new Date().toISOString() }],
  });

  try {
    await supabase.from(table).delete().eq("company_id", doc.company_id).eq("source_document_id", doc.id);
  } catch {
    // Compatibility path for older schemas.
  }

  if (table === "offers") {
    let insertedCount = 0;

    for (const record of records) {
      const r = record.normalized_fields || record.extracted_fields || {};
      const offerPayload = {
        ...buildMeta(record),
        offer_number: r.offer_number || r.opp_number || r.oppNumber || `OFF-${Date.now()}`,
        title: r.title || r.scope || r.customer_name || r.customerName || "Commercial Offer",
        customer_name: r.customer_name || r.customerName || "",
        project_description: r.description || r.scope || "",
        status: normalizeOpportunityStatus(r.status || (parseFlexibleNumber(r.contract_prob || r.contractProb || r.probability || 0) >= 100 ? "won" : "open")),
        total_value: parseFlexibleNumber(r.total_value || r.est_revenue || r.estRevenue || 0),
        currency: r.currency || "EUR",
        truth_source: "sales_document",
        value_confidence: Number(record.confidence_score || 0),
      };

      const { data: savedOffer, error: offerError } = await supabase.from("offers").insert(offerPayload).select("id").single();
      if (offerError) {
        console.error("Offer insert error:", offerError.message);
        continue;
      }

      insertedCount += 1;
      const items = [...(Array.isArray(r.items) ? r.items : []), ...(Array.isArray(r.products) ? r.products : [])];
      if (savedOffer?.id && items.length > 0) {
        const lineItems = items.map((item: any) => ({
          offer_id: savedOffer.id,
          product_id: item.product_id || null,
          external_product_name: item.name || item.product_name || item.description || "Unnamed item",
          manufacturer_name: item.manufacturer || item.brand || "external",
          line_type: item.type || "product",
          quantity: parseFlexibleNumber(item.quantity || 1) || 1,
          unit_price: parseFlexibleNumber(item.unit_price || item.price || 0),
          total_price: parseFlexibleNumber(item.total_price || item.total || item.price || 0),
          notes: item.notes || "",
        }));
        const { error: lineItemError } = await supabase.from("offer_products").insert(lineItems);
        if (lineItemError) console.error("Offer line insert error:", lineItemError.message);
      }
    }

    return insertedCount;
  }

  const cleanRecords = records.map((record: any) => {
    const r = record.normalized_fields || record.extracted_fields || {};
    const clean: any = buildMeta(record);

    if (table === "orders") {
      clean.po_date = r.po_date || r.poDate || "";
      clean.customer_name = r.customer_name || r.customerName || "";
      clean.product_family = r.product_family || r.productFamily || "";
      clean.region = r.region || "";
      clean.country = r.country || "";
      clean.segment = r.segment || "";
      clean.selling_price = parseFlexibleNumber(r.selling_price || r.sellingPrice || 0);
      clean.margin = parseFlexibleNumber(r.margin || 0);
      clean.kam = r.kam || "";
      clean.purchasing_year = r.purchasing_year || r.purchasingYear || "";
      clean.purchasing_quarter = r.purchasing_quarter || r.purchasingQuarter || "";
      clean.scope = r.scope || "";
      clean.truth_source = "sales_document";
    } else if (table === "strategy") {
      clean.product_family = r.product_family || r.productFamily || "";
      clean.number_of_segment = r.number_of_segment || r.numberOfSegment || "";
      clean.region = r.region || "";
      clean.est_purchasing_quarter = r.est_purchasing_quarter || "";
      clean.est_revenue = parseFlexibleNumber(r.est_revenue || r.estRevenue || 0);
      clean.margin = parseFlexibleNumber(r.margin || 0);
      clean.kam = r.kam || "";
    } else if (table === "products") {
      clean.name = r.name || r.product_name || r.product || r.text || "";
      clean.sku = r.sku || r.code || r.codigo || r.ref || null;
      clean.category = r.category || r.categoria || null;
      clean.subcategory = r.subcategory || r.subcategoria || null;
      clean.brand = r.brand || r.marca || null;
      clean.description = r.description || r.descripcion || null;
      clean.currency = r.currency || "EUR";
      clean.list_price = parseFlexibleNumber(r.list_price || r.selling_price || r.price || r.value || 0);
      clean.unit_cost = parseFlexibleNumber(r.unit_cost || r.cost || r.usd_purchase || 0);
      clean.selling_price = parseFlexibleNumber(r.selling_price || r.sale_price || r.pvp_cliente || r.venta || r.price || r.value || 0);
      clean.average_value = parseFlexibleNumber(r.average_value || r.pvp_in || r.selling_price || r.price || r.value || 0);
      clean.average_margin = parseFlexibleNumber(r.average_margin || r.margin || r.margin_kam || 0);
      clean.stock_quantity = parseFlexibleNumber(r.stock_quantity || r.qty || r.cantidad || 0);
      clean.stock_unit = r.stock_unit || r.unit || r.unidad || null;
      clean.lead_time_days = parseFlexibleNumber(r.lead_time_days || r.lead_time || r.plazo || 0) || null;
      clean.moq = parseFlexibleNumber(r.moq || r.minimum_order_quantity || 0) || null;
      clean.packaging = r.packaging || r.empaque || null;
      clean.attributes = r.attributes || { kam: r.kam || null };
      clean.tags = Array.isArray(r.tags) ? r.tags : [];
      clean.markets = Array.isArray(r.markets) ? r.markets : [];
      clean.type = r.type || r.lifecycle || "Core";
      clean.lifecycle_stage = r.lifecycle_stage || r.lifecycle || r.type || 'core';
      clean.status = r.status || 'active';
      clean.is_active = r.is_active ?? true;
      clean.comments = r.comments || r.notes || "";
      clean.source_document = doc.file_name || '';
      clean.source_sheet = r.source_sheet || r.__sheet_name || null;
      clean.source_row = parseFlexibleNumber(r.source_row || r.__row_number || 0) || null;
      clean.confidence_score = parseFlexibleNumber(r.confidence || record.confidence_score || 0.75);
      clean.last_seen_at = new Date().toISOString();
    } else if (table === "company_contacts") {
      clean.name = r.name || r.lead_name || "";
      clean.email = r.email || "";
      clean.role = r.role || r.job_title || "";
      clean.department = r.department || "";
      clean.notes = r.notes || r.phone || r.status || r.source || "";
    } else if (table === "customers") {
      clean.customer_name = r.customer_name || r.customerName || r.name || "";
      clean.account_tier = r.account_tier || r.tier || "";
      clean.strategic_importance = parseFlexibleNumber(r.strategic_importance || r.importance || 0);
      clean.growth_potential = parseFlexibleNumber(r.growth_potential || r.growth || 0);
      clean.relationship_strength = parseFlexibleNumber(r.relationship_strength || r.relationship || 0);
      clean.operating_region = r.region || r.operating_region || "";
      clean.sector = r.sector || r.segment || "";
      clean.notes = r.notes || "";
    } else if (table === "competitors") {
      clean.competitor_name = r.competitor_name || r.name || "";
      clean.product_family = r.product_family || r.productFamily || "";
      clean.positioning = r.positioning || "";
      clean.price_positioning = r.price_positioning || r.pricePositioning || "";
      clean.value_proposition = r.value_proposition || r.valueProposition || "";
      clean.strengths = r.strengths || [];
      clean.weaknesses = r.weaknesses || [];
      clean.evidence = r.evidence || {};
    }

    return clean;
  });

  const { error } = await supabase.from(table).insert(cleanRecords);
  if (error) {
    console.error("Structured record insert error:", error.message);
    return 0;
  }

  return cleanRecords.length;
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

    await supabase.from("company_documents").update({ processing_status: "processing" }).eq("id", documentId);

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

    const targetTable = CanonicalStorageService.tableForCategory(doc.category) || categoryTableMapping[doc.category] || "none";
    const { textContent, rawContent } = await readDocumentText(fileData, doc.mime_type || "", doc.file_name || "", doc.file_size || 0);
    const trimmedText = textContent.length > 100000 ? `${textContent.slice(0, 100000)}\n[TRUNCATED]` : textContent;
    const preprocessed = PreprocessingService.run(trimmedText);
    const preparedText = preprocessed.cleanedText || trimmedText;

    try {
      await supabase.from("documents_raw").upsert(DocumentIngestionService.buildRawDocumentRecord({
        documentId: doc.id,
        companyId: doc.company_id,
        filePath: doc.file_path,
        uploadSection: doc.category,
        uploadedBy: doc.uploaded_by || null,
        metadata: {
          file_name: doc.file_name,
          mime_type: doc.mime_type,
          file_size: doc.file_size,
          language: preprocessed.language,
          duplicate_lines_removed: preprocessed.duplicateLinesRemoved,
        },
      }));
    } catch (rawDocError: any) {
      console.warn("Raw document store degraded:", rawDocError?.message || rawDocError);
    }

    const legacyFallback = buildFallbackExtraction({ category: doc.category, fileName: doc.file_name || "document", targetTable }, rawContent || preparedText);
    const rawExtractedRecords = SectionBasedExtractionService.extract({
      category: doc.category,
      documentId: doc.id,
      uploadSection: doc.category,
      rows: legacyFallback.extracted_records || [],
      sourceType: "document_upload",
    });
    const validationResult = ValidationService.validate(doc.category, rawExtractedRecords);
    const enrichmentResult = DataEnrichmentService.enrich(doc.category, validationResult.validated);
    const conceptIntelligence = buildConceptIntelligence({
      category: doc.category,
      text: preparedText,
      sourceDocumentId: doc.id,
      validatedRecords: validationResult.validated.map((record: any) => record.extracted_fields || {}),
    });

    let pipelineResult = await runDocumentIngestionPipeline({
      docId: doc.id,
      companyId: doc.company_id,
      category: doc.category,
      fileName: doc.file_name || "document",
      mimeType: doc.mime_type || "",
      textContent: preparedText,
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
        textContent: preparedText,
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
      record_count: rawExtractedRecords.length,
      confidence_score: Math.round(pipelineResult.qualityGate.score * 100),
      data_quality_notes: unique([
        ...(legacyFallback.data_quality_notes || []),
        ...pipelineResult.qualityGate.issues,
        ...validationResult.rejected.flatMap((record: any) => record.validation_issues || []),
      ]),
      target_table: targetTable,
      canonical_table: targetTable,
      semantic_counts: semanticSummary,
      parsed_structure: pipelineResult.parsed.sections.map((section) => ({ heading: section.heading, type: section.kind, level: section.level })),
      agent_audit: pipelineResult.agentAudit,
      quality_gate: pipelineResult.qualityGate,
      concept_intelligence: conceptIntelligence,
      preprocessing: {
        language: preprocessed.language,
        duplicate_lines_removed: preprocessed.duplicateLinesRemoved,
      },
      raw_extracted_records: [...validationResult.validated, ...validationResult.rejected],
      validation_report: {
        ...validationResult.report,
        accepted: validationResult.validated.length,
        rejected: validationResult.rejected.length,
      },
      rejected_records: validationResult.rejected,
      enriched_records: enrichmentResult.records,
      enrichment_logs: enrichmentResult.logs,
      processed_at: new Date().toISOString(),
    };

    const canonicalWriteBlocked = !pipelineResult.qualityGate.accepted || enrichmentResult.records.length === 0;
    const documentStatus = canonicalWriteBlocked ? "flagged" : "completed";
    const documentSummaryData = {
      summary: extractedData.summary,
      record_count: extractedData.record_count,
      confidence_score: extractedData.confidence_score,
      data_quality_notes: extractedData.data_quality_notes,
      target_table: extractedData.target_table,
      canonical_table: extractedData.canonical_table,
      semantic_counts: extractedData.semantic_counts,
      parsed_structure: extractedData.parsed_structure,
      agent_audit: extractedData.agent_audit,
      quality_gate: extractedData.quality_gate,
      concept_intelligence: extractedData.concept_intelligence,
      preprocessing: extractedData.preprocessing,
      validation_report: extractedData.validation_report,
      processed_at: extractedData.processed_at,
    };

    const documentUpdatePayload = {
      extracted_data: documentSummaryData,
      raw_text: trimmedText,
      cleaned_text: preparedText,
      parsed_structure: extractedData.parsed_structure,
      semantic_summary: {
        ...semanticSummary,
        language: preprocessed.language,
        validated_records: validationResult.validated.length,
        rejected_records: validationResult.rejected.length,
        concepts_detected: conceptIntelligence.conceptsDetected,
        primary_concept: conceptIntelligence.primaryConcept,
      },
      quality_score: extractedData.confidence_score,
      processing_trace: {
        audit: pipelineResult.agentAudit,
        qualityGate: pipelineResult.qualityGate,
        conceptIntelligence,
        validationReport: extractedData.validation_report,
        preprocessing: extractedData.preprocessing,
        processedAt: extractedData.processed_at,
      },
    };

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
        legacyExtraction: documentSummaryData,
      });
    } catch (storageError: any) {
      semanticStorageMode = "document-only";
      extractedData.data_quality_notes = unique([
        ...(extractedData.data_quality_notes || []),
        `Semantic knowledge tables unavailable: ${storageError?.message || "unknown error"}`,
      ]);
      console.warn("Semantic persistence degraded:", storageError?.message || storageError);
    }

    const insertedCount = await persistStructuredRecords(supabase, doc, targetTable, extractedData);
    await persistCompanyUpdates(supabase, doc, extractedData);
    await supabase.from("company_documents").update({
      ...documentUpdatePayload,
      extracted_data: { ...documentSummaryData, semantic_storage_mode: semanticStorageMode },
      processing_status: insertedCount > 0 ? "completed" : documentStatus,
    }).eq("id", documentId);

    return new Response(JSON.stringify({
      success: insertedCount > 0,
      status: insertedCount > 0 ? "completed" : documentStatus,
      summary: pipelineResult.summary,
      recordCount: insertedCount,
      confidence: extractedData.confidence_score,
      dataQualityNotes: extractedData.data_quality_notes,
      semanticCounts: semanticSummary,
      validationReport: extractedData.validation_report,
      blockedFromCanonical: insertedCount === 0,
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
        await supabase.from("company_documents").update({ processing_status: transient ? "pending" : "failed" }).eq("id", documentId);
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
