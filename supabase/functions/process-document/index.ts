import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildFallbackExtraction } from "../_shared/documentFallback.ts";
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
  const records = extractedData.extracted_records || [];
  if (records.length === 0 || table === "none" || table === "company_info_update") return 0;

  if (table === "offers") {
    let insertedCount = 0;

    for (const r of records) {
      const offerPayload = {
        company_id: doc.company_id,
        offer_number: r.offer_number || r.opp_number || r.oppNumber || `OFF-${Date.now()}`,
        title: r.title || r.scope || r.customer_name || r.customerName || "Commercial Offer",
        customer_name: r.customer_name || r.customerName || "",
        project_description: r.description || r.scope || "",
        status: normalizeOpportunityStatus(r.status || (parseFlexibleNumber(r.contract_prob || r.contractProb || 0) >= 100 ? "won" : "open")),
        total_value: parseFlexibleNumber(r.total_value || r.est_revenue || r.estRevenue || 0),
        currency: r.currency || "EUR",
        truth_source: "sales_document",
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

  const cleanRecords = records.map((r: any) => {
    const clean: any = { company_id: doc.company_id };

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
    } else if (table === "opportunities") {
      clean.opp_number = r.opp_number || r.oppNumber || "";
      clean.status = normalizeOpportunityStatus(r.status || "open");
      clean.customer_name = r.customer_name || r.customerName || "";
      clean.product_family = r.product_family || r.productFamily || "";
      clean.region = r.region || "";
      clean.est_revenue = parseFlexibleNumber(r.est_revenue || r.estRevenue || 0);
      clean.contract_prob = parseFlexibleNumber(r.contract_prob || r.contractProb || 0);
      clean.margin = parseFlexibleNumber(r.margin || 0);
      clean.kam = r.kam || "";
      clean.est_purchasing_year = r.est_purchasing_year || "";
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
      clean.name = r.name || "";
      clean.average_value = parseFlexibleNumber(r.average_value || r.averageValue || 0);
      clean.type = r.type || "";
      clean.comments = r.comments || "";
    } else if (table === "company_contacts") {
      clean.name = r.name || "";
      clean.email = r.email || "";
      clean.role = r.role || r.job_title || "";
      clean.department = r.department || "";
      clean.notes = r.notes || r.phone || "";
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

    const targetTable = categoryTableMapping[doc.category] || "none";
    const { textContent, rawContent } = await readDocumentText(fileData, doc.mime_type || "", doc.file_name || "", doc.file_size || 0);
    const trimmedText = textContent.length > 100000 ? `${textContent.slice(0, 100000)}\n[TRUNCATED]` : textContent;

    const legacyFallback = buildFallbackExtraction({ category: doc.category, fileName: doc.file_name || "document", targetTable }, rawContent || trimmedText);

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
      record_count: (legacyFallback.extracted_records || []).length,
      confidence_score: Math.round(pipelineResult.qualityGate.score * 100),
      data_quality_notes: unique([...(legacyFallback.data_quality_notes || []), ...pipelineResult.qualityGate.issues]),
      target_table: targetTable,
      semantic_counts: semanticSummary,
      parsed_structure: pipelineResult.parsed.sections.map((section) => ({ heading: section.heading, type: section.kind, level: section.level })),
      agent_audit: pipelineResult.agentAudit,
      quality_gate: pipelineResult.qualityGate,
      processed_at: new Date().toISOString(),
    };

    const documentUpdatePayload = {
      extracted_data: extractedData,
      raw_text: trimmedText,
      cleaned_text: trimmedText,
      parsed_structure: extractedData.parsed_structure,
      semantic_summary: semanticSummary,
      quality_score: extractedData.confidence_score,
      processing_trace: {
        audit: pipelineResult.agentAudit,
        qualityGate: pipelineResult.qualityGate,
        processedAt: extractedData.processed_at,
      },
    };

    if (!pipelineResult.qualityGate.accepted) {
      await supabase.from("company_documents").update({ ...documentUpdatePayload, processing_status: "failed" }).eq("id", documentId);

      return new Response(JSON.stringify({
        success: false,
        summary: pipelineResult.summary,
        confidence: extractedData.confidence_score,
        dataQualityNotes: extractedData.data_quality_notes,
        error: pipelineResult.qualityGate.issues.join(" "),
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const insertedCount = await persistStructuredRecords(supabase, doc, targetTable, extractedData);
    await persistCompanyUpdates(supabase, doc, extractedData);
    await supabase.from("company_documents").update({
      ...documentUpdatePayload,
      extracted_data: { ...extractedData, semantic_storage_mode: semanticStorageMode },
      processing_status: "completed",
    }).eq("id", documentId);

    return new Response(JSON.stringify({
      success: true,
      summary: pipelineResult.summary,
      recordCount: insertedCount,
      confidence: extractedData.confidence_score,
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
