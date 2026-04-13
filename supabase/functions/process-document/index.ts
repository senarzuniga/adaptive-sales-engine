import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId } = await req.json();
    if (!documentId) throw new Error("documentId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get document metadata
    const { data: doc, error: docErr } = await supabase
      .from("company_documents")
      .select("*")
      .eq("id", documentId)
      .single();
    if (docErr || !doc) throw new Error("Document not found");

    // Update status to processing
    await supabase.from("company_documents").update({ processing_status: "processing" }).eq("id", documentId);

    // Download file from storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("company-documents")
      .download(doc.file_path);
    if (dlErr || !fileData) throw new Error("Failed to download file: " + (dlErr?.message || "unknown"));

    // Extract text content based on file type
    let textContent = "";
    const mime = doc.mime_type || "";
    const fileName = doc.file_name || "";

    if (mime.includes("text") || fileName.endsWith(".csv") || fileName.endsWith(".txt") || fileName.endsWith(".md")) {
      textContent = await fileData.text();
    } else if (mime.includes("json")) {
      textContent = await fileData.text();
    } else if (mime.includes("spreadsheet") || mime.includes("excel") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      // For Excel files, read as base64 and let AI interpret the raw data
      const buffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Try to extract CSV-like text from the binary
      textContent = `[Binary Excel file: ${fileName}, size: ${doc.file_size} bytes. The file content is provided as base64 for interpretation.]\n`;
      textContent += btoa(String.fromCharCode(...bytes)).substring(0, 50000); // Limit to ~50KB of base64
    } else {
      // For PDFs, images, and other binary formats - send as base64
      const buffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      textContent = `[Binary file: ${fileName}, type: ${mime}, size: ${doc.file_size} bytes]\n`;
      // For very large files, truncate
      const b64 = btoa(String.fromCharCode(...bytes.slice(0, 100000)));
      textContent += b64;
    }

    // Truncate if too long
    if (textContent.length > 80000) {
      textContent = textContent.substring(0, 80000) + "\n[TRUNCATED - file too large for full processing]";
    }

    // Get existing company context
    const { data: company } = await supabase
      .from("companies")
      .select("company_name, industry, main_products, business_description")
      .eq("id", doc.company_id)
      .single();

    const companyContext = company
      ? `Company: ${company.company_name}. Industry: ${company.industry || "unknown"}. Products: ${company.main_products || "unknown"}. Description: ${company.business_description || "N/A"}.`
      : "No company context available.";

    // Build category-specific extraction instructions
    const categoryInstructions: Record<string, string> = {
      contacts: `Extract contact information: names, emails, phone numbers, job titles, departments, company affiliations. Structure as an array of contact objects.`,
      leads: `Extract lead/prospect data: company names, contact persons, potential value, status, source, interest level, next actions. Structure as lead objects.`,
      customers: `Extract customer/account data: company names, account IDs, contract values, relationship status, key contacts, purchase history. Structure as customer objects.`,
      sales: `Extract sales data: dates, amounts, customers, products/services sold, regions, sales reps, margins. Structure as sales transaction objects.`,
      offers: `Extract offer/proposal data: offer numbers, customer names, items/services, pricing, validity dates, status, terms. Structure as offer objects.`,
      strategy: `Extract strategic data: targets by product/region/KAM, budget allocations, growth goals, market priorities, timeline. Structure as strategy entries.`,
      products: `Extract product/service data: names, categories, pricing, specifications, innovation level (innovation/commodity/decline), market positioning. Structure as product objects.`,
      reports: `Extract key findings, KPIs, metrics, conclusions, and recommendations from this report. Structure as a report summary with key_metrics array and findings array.`,
      hierarchy: `Extract organizational hierarchy: departments, reporting lines, roles, team sizes, location mapping. Structure as hierarchy nodes.`,
      employees: `Extract employee data: names, roles, departments, contact info, responsibilities, seniority. Structure as employee objects.`,
      finance: `Extract financial data: revenue figures, costs, margins, EBITDA, growth rates, debt levels, cash flow. Structure as financial_metrics with period labels.`,
      market: `Extract market intelligence: market size, growth rates, trends, segments, opportunities, threats. Structure as market_data object.`,
      competitors: `Extract competitor information: names, market share, strengths, weaknesses, pricing, positioning, recent moves. Structure as competitor objects.`,
      operations: `Extract operational data: processes, KPIs, efficiency metrics, bottlenecks, improvement areas. Structure as operations object.`,
      contracts: `Extract contract data: parties, values, terms, dates, obligations, SLAs, renewal conditions. Structure as contract objects.`,
      logistics: `Extract supply chain data: suppliers, lead times, costs, routes, warehouses, inventory levels. Structure as logistics objects.`,
      compliance: `Extract compliance/legal data: regulations, certifications, pending issues, risk areas, audit findings. Structure as compliance objects.`,
      investments: `Extract investment/asset data: asset names, values, returns, acquisition dates, depreciation, locations. Structure as asset objects.`,
      general: `Extract all meaningful structured data from this document. Identify the type of information and organize it logically.`,
    };

    const categoryInstruction = categoryInstructions[doc.category] || categoryInstructions.general;

    // Determine which database tables this category maps to
    const categoryTableMapping: Record<string, string> = {
      contacts: "company_contacts",
      leads: "company_contacts", 
      customers: "company_contacts",
      sales: "orders",
      offers: "opportunities",
      strategy: "strategy",
      products: "products",
      employees: "company_contacts",
      finance: "company_info_update",
      market: "company_info_update",
      competitors: "company_info_update",
    };

    const targetTable = categoryTableMapping[doc.category] || "none";

    const systemPrompt = `You are a Senior Data Interpretation Agent specialized in extracting, normalizing, and structuring business data from unstructured documents.

COMPANY CONTEXT: ${companyContext}

DOCUMENT CATEGORY: ${doc.category}
FILE NAME: ${fileName}

YOUR MISSION:
1. Analyze the document content thoroughly
2. ${categoryInstruction}
3. Normalize all data (consistent date formats YYYY-MM-DD, numbers without currency symbols, clean text)
4. Flag any data quality issues or ambiguities
5. Provide a confidence score (0-100) for the extraction quality

TARGET DATABASE TABLE: ${targetTable}
If the target table is "orders", structure extracted sales data with fields: po_date, customer_name, product_family, region, country, segment, selling_price, margin, kam, purchasing_year, purchasing_quarter.
If the target table is "opportunities", structure with: opp_number, status, customer_name, product_family, region, est_revenue, contract_prob, margin, kam, est_purchasing_year.
If the target table is "strategy", structure with: product_family, number_of_segment, region, est_purchasing_quarter, est_revenue, margin, kam.
If the target table is "products", structure with: name, average_value, type (innovation/commodity/decline), comments.
If the target table is "company_contacts", structure with: name, email, role, department, notes.
If the target table is "company_info_update", provide a JSON with fields that should be updated on the companies table (industry, main_competitors, annual_revenue, etc).

You MUST respond with a valid JSON object using this exact structure:
{
  "extracted_records": [...],  // Array of structured records ready for DB insertion
  "summary": "Brief summary of what was extracted",
  "record_count": 0,
  "confidence_score": 0,
  "data_quality_notes": ["any issues found"],
  "target_table": "${targetTable}",
  "company_info_updates": {}  // Only if category suggests company-level info updates
}`;

    // Call AI for interpretation
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Process this document content and extract structured data:\n\n${textContent}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        await supabase.from("company_documents").update({ processing_status: "failed" }).eq("id", documentId);
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        await supabase.from("company_documents").update({ processing_status: "failed" }).eq("id", documentId);
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;
    if (!content) throw new Error("No AI response content");

    let extractedData: any;
    try {
      extractedData = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    // Save extracted data to the document record
    await supabase.from("company_documents").update({
      processing_status: "completed",
      extracted_data: extractedData,
    }).eq("id", documentId);

    // Auto-insert extracted records into target tables
    const records = extractedData.extracted_records || [];
    const table = extractedData.target_table || targetTable;
    let insertedCount = 0;

    if (records.length > 0 && table !== "none" && table !== "company_info_update") {
      const dbRecords = records.map((r: any) => ({ ...r, company_id: doc.company_id }));
      
      // Clean records: remove fields that don't exist in target table
      const cleanRecords = dbRecords.map((r: any) => {
        const clean: any = { company_id: doc.company_id };
        if (table === "orders") {
          clean.po_date = r.po_date || r.poDate || "";
          clean.customer_name = r.customer_name || r.customerName || "";
          clean.product_family = r.product_family || r.productFamily || "";
          clean.region = r.region || "";
          clean.country = r.country || "";
          clean.segment = r.segment || "";
          clean.selling_price = parseFloat(r.selling_price || r.sellingPrice || 0);
          clean.margin = parseFloat(r.margin || 0);
          clean.kam = r.kam || "";
          clean.purchasing_year = r.purchasing_year || r.purchasingYear || "";
          clean.purchasing_quarter = r.purchasing_quarter || r.purchasingQuarter || "";
          clean.scope = r.scope || "";
        } else if (table === "opportunities") {
          clean.opp_number = r.opp_number || r.oppNumber || "";
          clean.status = r.status || "open";
          clean.customer_name = r.customer_name || r.customerName || "";
          clean.product_family = r.product_family || r.productFamily || "";
          clean.region = r.region || "";
          clean.est_revenue = parseFloat(r.est_revenue || r.estRevenue || 0);
          clean.contract_prob = parseFloat(r.contract_prob || r.contractProb || 0);
          clean.margin = parseFloat(r.margin || 0);
          clean.kam = r.kam || "";
          clean.est_purchasing_year = r.est_purchasing_year || "";
        } else if (table === "strategy") {
          clean.product_family = r.product_family || r.productFamily || "";
          clean.number_of_segment = r.number_of_segment || r.numberOfSegment || "";
          clean.region = r.region || "";
          clean.est_purchasing_quarter = r.est_purchasing_quarter || "";
          clean.est_revenue = parseFloat(r.est_revenue || r.estRevenue || 0);
          clean.margin = parseFloat(r.margin || 0);
          clean.kam = r.kam || "";
        } else if (table === "products") {
          clean.name = r.name || "";
          clean.average_value = parseFloat(r.average_value || r.averageValue || 0);
          clean.type = r.type || "";
          clean.comments = r.comments || "";
        } else if (table === "company_contacts") {
          clean.name = r.name || "";
          clean.email = r.email || "";
          clean.role = r.role || r.job_title || "";
          clean.department = r.department || "";
          clean.notes = r.notes || r.phone || "";
        }
        return clean;
      });

      const { error: insertErr } = await supabase.from(table).insert(cleanRecords);
      if (!insertErr) insertedCount = cleanRecords.length;
      else console.error("Insert error:", insertErr.message);
    }

    // Update company-level info if applicable
    if (extractedData.company_info_updates && Object.keys(extractedData.company_info_updates).length > 0) {
      const updates = extractedData.company_info_updates;
      const allowedFields = [
        "industry", "sub_sector", "annual_revenue", "employee_count", "main_products",
        "main_competitors", "main_customer_segments", "operating_regions", "headquarters",
        "sales_channels", "current_challenges", "strategic_goals", "business_description",
        "market_context", "strategy_context", "objectives",
      ];
      const safeUpdates: any = {};
      for (const [k, v] of Object.entries(updates)) {
        if (allowedFields.includes(k) && v) safeUpdates[k] = v;
      }
      if (Object.keys(safeUpdates).length > 0) {
        await supabase.from("companies").update(safeUpdates).eq("id", doc.company_id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      summary: extractedData.summary,
      recordCount: insertedCount,
      confidence: extractedData.confidence_score,
      dataQualityNotes: extractedData.data_quality_notes,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("process-document error:", err);
    // Try to update status to failed
    try {
      const { documentId } = await req.clone().json();
      if (documentId) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("company_documents").update({ processing_status: "failed" }).eq("id", documentId);
      }
    } catch { /* ignore cleanup errors */ }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
