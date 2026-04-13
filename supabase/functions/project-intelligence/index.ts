import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectInput, analysisType, projectData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a Senior Industrial Project Manager with 15+ years of experience in machinery, automation, and B2B technical projects.

Your mission is to transform any project input (contracts, emails, notes, annexes) into a fully structured and controlled execution plan.

STEP 1 — Extract and Structure Information
Identify:
- Scope of supply and exclusions
- Deliverables
- Contract value
- Payment terms and milestones
- Technical complexity
- Deadlines and constraints
- Risks and uncertainties
If information is missing, clearly state assumptions.

STEP 2 — Classify the Project
Define:
- Project type (machine, line, service, retrofit, software)
- Complexity (low/medium/high)
- Risk level (low/medium/high)
- Estimated duration (short <3mo / medium 3-9mo / long >9mo)

STEP 3 — Build Execution Plan
Structure the project into 10 phases:
1. Project Kick-off (Internal handover Sales→PM, Contract review, Risk identification)
2. Engineering Phase (Basic/Detailed engineering, Design approvals)
3. Procurement Phase (Supplier selection, POs, Critical components tracking)
4. Manufacturing / Execution (Assembly/fabrication, Internal quality checks)
5. Testing Phase (Internal testing, Pre-Acceptance Test / FAT)
6. Logistics (Packing, Shipping, Documentation)
7. Installation / Commissioning (Site installation, Start-up)
8. Fine Tuning / Optimization (Adjustments, Performance validation)
9. Final Acceptance / SAT (Customer sign-off)
10. Financial Closure (Final invoicing, Payment follow-up, Margin validation)

For each phase include: Key tasks, Responsible roles, Risks, Control points, Budget allocation %

STEP 4 — Define Milestones (contract, technical, payment)

STEP 5 — Financial Control
Provide: Cost structure (engineering, purchasing, labor, travel, etc.), Invoicing plan linked to milestones, Cash flow estimation

STEP 6 — Define Control Gates (G0-G6)
G0: Contract validation | G1: Engineering approval | G2: Procurement readiness | G3: FAT readiness | G4: Shipment approval | G5: SAT/Acceptance | G6: Financial closure
Each gate: Required inputs, Outputs, Risks if not met

STEP 7 — Risk Analysis (Top 5-10 risks with probability, impact, mitigation)

STEP 8 — Project Health Score (0-100) based on: schedule adherence, cost control, risk exposure, scope clarity

Return structured JSON with ALL sections. Be specific with numbers, dates, and actionable items.`;

    let userPrompt = '';

    if (analysisType === 'initial_analysis') {
      userPrompt = `Analyze this project input and generate a complete execution plan:

## Project Input
${projectInput || "No input provided"}

Return JSON with:
{
  "classification": {
    "projectType": "machine|line|service|retrofit|software",
    "complexity": "low|medium|high",
    "riskLevel": "low|medium|high",
    "durationCategory": "short|medium|long",
    "estimatedDurationMonths": number,
    "customizationLevel": "standard|moderate|heavy"
  },
  "scopeExtraction": {
    "scopeOfSupply": "string",
    "deliverables": ["string"],
    "exclusions": ["string"],
    "contractValue": number,
    "currency": "EUR",
    "paymentTerms": "string",
    "incoterms": "string",
    "warrantyTerms": "string",
    "penaltiesLDs": "string",
    "assumptions": ["string"]
  },
  "phases": [
    {
      "phaseNumber": number,
      "phaseName": "string",
      "description": "string",
      "durationWeeks": number,
      "responsible": "string",
      "budgetPct": number,
      "keyTasks": ["string"],
      "controlPoints": ["string"],
      "risks": ["string"]
    }
  ],
  "milestones": [
    {
      "type": "contract|technical|payment",
      "title": "string",
      "description": "string",
      "weekFromStart": number,
      "paymentAmount": number,
      "paymentPct": number,
      "dependencies": "string",
      "gateId": "string"
    }
  ],
  "gates": [
    {
      "gateNumber": "G0|G1|G2|G3|G4|G5|G6",
      "gateName": "string",
      "description": "string",
      "weekFromStart": number,
      "requiredInputs": ["string"],
      "requiredOutputs": ["string"],
      "responsible": "string",
      "risksIfNotPassed": "string"
    }
  ],
  "financialPlan": {
    "costBreakdown": [
      { "category": "engineering|procurement|labor|travel|subcontracting|overhead|contingency", "lineItem": "string", "budgetAmount": number, "budgetPct": number }
    ],
    "invoicingSchedule": [
      { "milestone": "string", "amount": number, "pct": number, "expectedWeek": number }
    ],
    "marginTarget": number,
    "contingencyPct": number
  },
  "risks": [
    {
      "title": "string",
      "description": "string",
      "category": "technical|commercial|operational|supply-chain|customer",
      "probability": "low|medium|high",
      "impact": "low|medium|high",
      "riskScore": number,
      "mitigationAction": "string",
      "contingencyPlan": "string",
      "owner": "string"
    }
  ],
  "healthScore": number,
  "executiveSummary": "string",
  "criticalPath": ["string"],
  "changeManagementNotes": "string"
}`;
    } else if (analysisType === 'health_check') {
      userPrompt = `Perform a health check on this active project:

## Project Data
${JSON.stringify(projectData || {}, null, 2)}

Analyze schedule adherence, cost deviations, risk exposure, and gate compliance.

Return JSON with:
{
  "healthScore": number,
  "scoreBreakdown": {
    "scheduleAdherence": number,
    "costControl": number,
    "riskExposure": number,
    "scopeClarity": number,
    "gateCompliance": number
  },
  "alerts": [
    { "severity": "critical|warning|info", "area": "string", "message": "string", "recommendedAction": "string" }
  ],
  "marginDeviation": { "targetMargin": number, "projectedMargin": number, "deviationPct": number, "rootCauses": ["string"] },
  "delayRisk": { "currentDelay": number, "projectedDelay": number, "impactedMilestones": ["string"], "recoveryActions": ["string"] },
  "recommendations": ["string"],
  "executiveSummary": "string"
}`;
    } else {
      userPrompt = `Simulate the impact of a change order on this project:

## Project Data
${JSON.stringify(projectData || {}, null, 2)}

## Change Request
${projectInput || "No change specified"}

Return JSON with:
{
  "changeImpact": {
    "scheduleImpactWeeks": number,
    "costImpact": number,
    "marginImpact": number,
    "riskImpactDelta": number,
    "affectedPhases": ["string"],
    "affectedMilestones": ["string"]
  },
  "recommendation": "approve|reject|negotiate",
  "rationale": "string",
  "mitigationIfApproved": ["string"],
  "revisedTimeline": "string",
  "revisedBudget": number
}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI analysis failed");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let analysis;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content);
    } catch {
      analysis = { executiveSummary: content, error: "Could not parse structured response" };
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("project-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
