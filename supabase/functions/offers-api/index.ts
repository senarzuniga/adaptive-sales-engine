import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateAtStart(value?: string) {
  const date = value ? new Date(value) : new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + Math.max(0, days) * MS_IN_DAY);
}

function sameUtcDay(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

function buildTimeline(startDate: Date, days = 180) {
  return Array.from({ length: days + 1 }, (_, index) => addDays(startDate, index));
}

function estimateFinancingCost(maxFinancingNeeded: number) {
  const annualRate = 0.08;
  const horizonDays = 180;
  return Number(((maxFinancingNeeded * annualRate * horizonDays) / 365).toFixed(2));
}

function generateCashFlow(
  clientMilestones: any[],
  supplierPayments: any[],
  offerTotal: number,
  contractStartDateIso?: string,
) {
  const startDate = toDateAtStart(contractStartDateIso);
  const timeline = buildTimeline(startDate, 180);

  const inflowMilestones = clientMilestones.map((milestone) => ({
    day: toNumber(milestone.expected_days_after_contract, 0),
    amount: Number(((offerTotal * toNumber(milestone.percentage, 0)) / 100).toFixed(2)),
  }));

  const outflowMilestones = supplierPayments.map((payment) => ({
    day: toNumber(payment.expected_days_after_contract, 0),
    amount: Number(toNumber(payment.amount, 0).toFixed(2)),
  }));

  let cumulativeInflow = 0;
  let cumulativeOutflow = 0;
  let cashBalance = 0;

  const cashFlow = timeline.map((dayDate) => {
    let dailyInflow = 0;
    let dailyOutflow = 0;

    inflowMilestones.forEach((milestone) => {
      const targetDay = addDays(startDate, milestone.day);
      if (sameUtcDay(dayDate, targetDay)) dailyInflow += milestone.amount;
    });

    outflowMilestones.forEach((payment) => {
      const targetDay = addDays(startDate, payment.day);
      if (sameUtcDay(dayDate, targetDay)) dailyOutflow += payment.amount;
    });

    const net = dailyInflow - dailyOutflow;
    cumulativeInflow += dailyInflow;
    cumulativeOutflow += dailyOutflow;
    cashBalance += net;

    return {
      date: dayDate.toISOString(),
      day_index: Math.round((dayDate.getTime() - startDate.getTime()) / MS_IN_DAY),
      client_inflow: Number(dailyInflow.toFixed(2)),
      supplier_outflow: Number(dailyOutflow.toFixed(2)),
      net_cash_flow: Number(net.toFixed(2)),
      cumulative_inflow: Number(cumulativeInflow.toFixed(2)),
      cumulative_outflow: Number(cumulativeOutflow.toFixed(2)),
      cash_balance: Number(cashBalance.toFixed(2)),
    };
  });

  const minPoint = cashFlow.reduce((worst, current) =>
    current.cash_balance < worst.cash_balance ? current : worst,
  cashFlow[0]);
  const breakEven = cashFlow.find((item) => item.cash_balance >= 0 && item.day_index > 0);

  const metrics = {
    max_negative_balance: Number(minPoint.cash_balance.toFixed(2)),
    max_financing_needed: Number(Math.abs(minPoint.cash_balance).toFixed(2)),
    break_even_day: breakEven ? breakEven.day_index : -1,
    total_financing_cost: estimateFinancingCost(Math.abs(minPoint.cash_balance)),
    peak_negative_day: minPoint.date,
  };

  return { cashFlow, metrics };
}

function generateOptimizationScenarios(current: ReturnType<typeof generateCashFlow>) {
  const baselinePeak = current.metrics.max_financing_needed;

  const templates = [
    {
      id: 'front-load-client-payments',
      name: 'Front-Load Client Payments',
      icon: '💰',
      impact: 'positive',
      description: 'Increase early client collection and defer tail-end settlement to reduce financing needs.',
      changes: [
        'H1 Contract Signature: +15%',
        'H2 Material Delivery: +5%',
        'H3 Installation: -5%',
        'H4 Final Acceptance: -15%',
      ],
      factor: 0.72,
      breakEvenDelta: -20,
      implementation_ease: 'high',
      requires_negotiation: 'medium',
      confidence_score: 0.84,
    },
    {
      id: 'payment-alignment-strategy',
      name: 'Payment Alignment Strategy',
      icon: '🔄',
      impact: 'positive',
      description: 'Align supplier payment dates with client collection milestones to smooth cash outflow.',
      changes: [
        'Shift supplier due dates +20 days on average',
        'Negotiate net-60 for high-cost material suppliers',
        'Link engineering milestones to client approval checkpoints',
      ],
      factor: 0.81,
      breakEvenDelta: -12,
      implementation_ease: 'medium',
      requires_negotiation: 'high',
      confidence_score: 0.76,
    },
    {
      id: 'milestone-consolidation',
      name: 'Milestone Consolidation',
      icon: '📊',
      impact: 'positive',
      description: 'Reduce milestone fragmentation and prioritize early-value milestones to reduce working capital stress.',
      changes: [
        'Merge H2 + H3 into one larger operational milestone',
        'Reduce end-loaded settlement concentration',
        'Add early trigger tied to long-lead procurement',
      ],
      factor: 0.67,
      breakEvenDelta: -25,
      implementation_ease: 'high',
      requires_negotiation: 'low',
      confidence_score: 0.82,
    },
    {
      id: 'early-payment-discount-program',
      name: 'Early Payment Discount Program',
      icon: '🏷️',
      impact: 'positive',
      description: 'Offer controlled discounts for accelerated payment events to reduce financing needs.',
      changes: [
        'Offer 2% discount for H2 payment within 15 days',
        'Offer 1% discount for on-time H3 payment',
        'Protect margin by capping discount coverage by concept',
      ],
      factor: 0.62,
      breakEvenDelta: -30,
      implementation_ease: 'medium',
      requires_negotiation: 'low',
      confidence_score: 0.71,
    },
    {
      id: 'supplier-financing-program',
      name: 'Supplier Financing Program',
      icon: '🏦',
      impact: 'positive',
      description: 'Leverage supplier credit and structured payment products to reduce internal cash pressure.',
      changes: [
        'Move material suppliers to net-60 where possible',
        'Use factoring for milestone-linked engineering invoices',
        'Negotiate escrow releases against client acceptance gates',
      ],
      factor: 0.56,
      breakEvenDelta: -35,
      implementation_ease: 'low',
      requires_negotiation: 'high',
      confidence_score: 0.65,
    },
  ];

  return templates
    .map((template) => {
      const projectedPeak = Number((baselinePeak * template.factor).toFixed(2));
      const financingSaved = Number((baselinePeak - projectedPeak).toFixed(2));
      return {
        ...template,
        projected_peak_negative: projectedPeak,
        projected_break_even: Math.max(0, current.metrics.break_even_day + template.breakEvenDelta),
        financing_saved: financingSaved,
      };
    })
    .sort((a, b) => b.financing_saved - a.financing_saved);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    if (action === 'offers.generate-serial') {
      const { data, error } = await supabase.rpc('get_next_offer_serial');
      if (error) throw error;
      return json({ serial: data });
    }

    if (action === 'offers.create') {
      const payload = body.payload || {};
      const { data: serial, error: serialError } = await supabase.rpc('get_next_offer_serial');
      if (serialError) throw serialError;

      const versionGroupId = crypto.randomUUID();

      const { data: offer, error } = await supabase
        .from('offers')
        .insert({
          company_id: payload.company_id,
          serial_number: serial,
          offer_number: serial,
          version: 1,
          version_group_id: versionGroupId,
          title: payload.title || 'Untitled Offer',
          customer_name: payload.customer_name || '',
          status: 'draft',
          total_amount: Number(payload.total_amount || 0),
          total_value: Number(payload.total_amount || 0),
          currency: payload.currency || 'EUR',
          valid_until: payload.valid_until || null,
          offer_data: payload.offer_data || {},
          template_type: payload.template_type || 'machine_selling',
          created_by: payload.created_by || null,
          last_modified_by: payload.last_modified_by || null,
          client_entity_id: payload.client_entity_id || null,
          client_entity_hash: payload.client_entity_hash || null,
        })
        .select('id, serial_number, version, version_group_id, status')
        .single();

      if (error) throw error;

      await supabase.from('offer_versions').insert({
        offer_id: offer.id,
        version_number: 1,
        changes_summary: 'Initial draft',
        created_by: payload.created_by || null,
      });

      return json({ offerId: offer.id, serialNumber: offer.serial_number, offer });
    }

    if (action === 'offers.versions') {
      const offerId = String(body.offerId || '');
      const { data, error } = await supabase
        .from('offer_versions')
        .select('*')
        .eq('offer_id', offerId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return json({ versions: data || [] });
    }

    if (action === 'offers.overwrite') {
      const offerId = String(body.offerId || '');
      const editedData = body.editedData || {};

      const { error } = await supabase
        .from('offers')
        .update({
          ...editedData,
          offer_data: editedData.offer_data || {},
          last_modified_by: body.changedBy || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', offerId);

      if (error) throw error;

      await supabase.from('offer_versions').insert({
        offer_id: offerId,
        version_number: Number(editedData.version || 1),
        changes_summary: 'Overwrite current offer',
        created_by: body.changedBy || null,
      });

      return json({ success: true, offerId });
    }

    if (action === 'offers.create-version') {
      const offerId = String(body.offerId || '');
      const versionNumber = Number(body.versionNumber || 2);
      const serialNumber = String(body.serialNumber || '');
      const editedData = body.editedData || {};

      if (versionNumber > 20) {
        return json({ error: 'Maximum 20 versions reached. Archive old versions first.' }, 400);
      }

      const { data: baseOffer, error: baseError } = await supabase
        .from('offers')
        .select('*')
        .eq('id', offerId)
        .single();

      if (baseError || !baseOffer) throw baseError || new Error('Base offer not found.');

      const { data: created, error: createError } = await supabase
        .from('offers')
        .insert({
          company_id: baseOffer.company_id,
          serial_number: serialNumber,
          offer_number: serialNumber,
          version: versionNumber,
          original_offer_id: baseOffer.original_offer_id || baseOffer.id,
          version_group_id: baseOffer.version_group_id,
          title: editedData.title || baseOffer.title,
          customer_name: editedData.customer_name || baseOffer.customer_name,
          status: 'draft',
          total_amount: Number(editedData.total_amount || 0),
          total_value: Number(editedData.total_amount || 0),
          currency: editedData.currency || baseOffer.currency,
          valid_until: editedData.valid_until || baseOffer.valid_until,
          offer_data: editedData.offer_data || baseOffer.offer_data || {},
          template_type: editedData.template_type || baseOffer.template_type,
          created_by: body.changedBy || baseOffer.created_by,
          last_modified_by: body.changedBy || baseOffer.last_modified_by,
          client_entity_id: baseOffer.client_entity_id || null,
          client_entity_hash: baseOffer.client_entity_hash || null,
        })
        .select('id')
        .single();

      if (createError || !created) throw createError || new Error('Could not create offer version.');

      await supabase.from('offer_versions').insert({
        offer_id: created.id,
        version_number: versionNumber,
        changes_summary: `Created version V${versionNumber}`,
        created_by: body.changedBy || null,
      });

      return json({ newVersionId: created.id, serialNumber, version: versionNumber });
    }

    if (action === 'offers.finalize') {
      const offerId = String(body.offerId || '');
      const finalizedAt = new Date().toISOString();

      const { error } = await supabase
        .from('offers')
        .update({ status: 'finalized', finalized_at: finalizedAt })
        .eq('id', offerId);

      if (error) throw error;
      return json({ finalizedAt });
    }

    if (action === 'offers.payment-milestones.list') {
      const offerId = String(body.offerId || '');
      const { data, error } = await supabase
        .from('offer_payment_milestones')
        .select('*')
        .eq('offer_id', offerId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('milestone_number', { ascending: true });
      if (error) throw error;
      return json({ milestones: data || [] });
    }

    if (action === 'offers.payment-milestones.replace') {
      const offerId = String(body.offerId || '');
      const milestones = Array.isArray(body.milestones) ? body.milestones : [];

      await supabase.from('offer_payment_milestones').delete().eq('offer_id', offerId);

      if (milestones.length > 0) {
        const rows = milestones.map((milestone: any, idx: number) => ({
          offer_id: offerId,
          milestone_number: Number(milestone.milestone_number || idx + 1),
          milestone_title: String(milestone.milestone_title || milestone.title || `Milestone ${idx + 1}`),
          percentage: toNumber(milestone.percentage, 0),
          expected_days_after_contract: milestone.expected_days_after_contract ?? milestone.expected_days ?? null,
          description: milestone.description || '',
          sort_order: milestone.sort_order ?? idx + 1,
        }));
        const { error } = await supabase.from('offer_payment_milestones').insert(rows);
        if (error) throw error;
      }

      const { data, error } = await supabase
        .from('offer_payment_milestones')
        .select('*')
        .eq('offer_id', offerId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('milestone_number', { ascending: true });
      if (error) throw error;

      return json({ milestones: data || [] });
    }

    if (action === 'offers.payment-milestones.update') {
      const offerId = String(body.offerId || '');
      const milestoneId = String(body.milestoneId || '');
      const patch = body.patch || {};

      const { data, error } = await supabase
        .from('offer_payment_milestones')
        .update({
          milestone_title: patch.milestone_title,
          percentage: patch.percentage,
          expected_days_after_contract: patch.expected_days_after_contract,
          description: patch.description,
          sort_order: patch.sort_order,
        })
        .eq('id', milestoneId)
        .eq('offer_id', offerId)
        .select('*')
        .single();
      if (error) throw error;
      return json({ milestone: data });
    }

    if (action === 'offers.payment-milestones.delete') {
      const offerId = String(body.offerId || '');
      const milestoneId = String(body.milestoneId || '');
      const { error } = await supabase
        .from('offer_payment_milestones')
        .delete()
        .eq('id', milestoneId)
        .eq('offer_id', offerId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'offers.cost-concepts.list') {
      const offerId = String(body.offerId || '');

      const [{ data: concepts, error: conceptsError }, { data: payments, error: paymentsError }] = await Promise.all([
        supabase
          .from('offer_cost_concepts')
          .select('*')
          .eq('offer_id', offerId)
          .order('created_at', { ascending: true }),
        supabase
          .from('offer_supplier_payments')
          .select('*')
          .eq('offer_id', offerId)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('milestone_number', { ascending: true }),
      ]);

      if (conceptsError) throw conceptsError;
      if (paymentsError) throw paymentsError;

      const mapped = (concepts || []).map((concept: any) => ({
        ...concept,
        supplier_payments: (payments || []).filter((payment: any) => payment.cost_concept_id === concept.id),
      }));

      return json({ concepts: mapped });
    }

    if (action === 'offers.cost-concepts.create') {
      const offerId = String(body.offerId || '');
      const payload = body.payload || {};

      const { data, error } = await supabase
        .from('offer_cost_concepts')
        .insert({
          offer_id: offerId,
          concept_name: payload.concept_name || 'New Concept',
          total_cost: toNumber(payload.total_cost, 0),
          cost_type: payload.cost_type || 'direct',
          supplier_id: payload.supplier_id || null,
          notes: payload.notes || '',
        })
        .select('*')
        .single();
      if (error) throw error;
      return json({ concept: { ...data, supplier_payments: [] } });
    }

    if (action === 'offers.cost-concepts.update') {
      const offerId = String(body.offerId || '');
      const conceptId = String(body.conceptId || '');
      const patch = body.patch || {};

      const { data, error } = await supabase
        .from('offer_cost_concepts')
        .update({
          concept_name: patch.concept_name,
          total_cost: patch.total_cost,
          cost_type: patch.cost_type,
          supplier_id: patch.supplier_id,
          notes: patch.notes,
        })
        .eq('id', conceptId)
        .eq('offer_id', offerId)
        .select('*')
        .single();
      if (error) throw error;
      return json({ concept: data });
    }

    if (action === 'offers.cost-concepts.delete') {
      const offerId = String(body.offerId || '');
      const conceptId = String(body.conceptId || '');

      await supabase.from('offer_supplier_payments').delete().eq('cost_concept_id', conceptId).eq('offer_id', offerId);
      const { error } = await supabase.from('offer_cost_concepts').delete().eq('id', conceptId).eq('offer_id', offerId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'offers.cost-concepts.replace') {
      const offerId = String(body.offerId || '');
      const concepts = Array.isArray(body.concepts) ? body.concepts : [];

      await supabase.from('offer_supplier_payments').delete().eq('offer_id', offerId);
      await supabase.from('offer_cost_concepts').delete().eq('offer_id', offerId);

      for (let conceptIndex = 0; conceptIndex < concepts.length; conceptIndex += 1) {
        const concept = concepts[conceptIndex];
        const { data: conceptRow, error: conceptError } = await supabase
          .from('offer_cost_concepts')
          .insert({
            offer_id: offerId,
            concept_name: concept.concept_name || `Concept ${conceptIndex + 1}`,
            total_cost: toNumber(concept.total_cost, 0),
            cost_type: concept.cost_type || 'direct',
            supplier_id: concept.supplier_id || null,
            notes: concept.notes || '',
          })
          .select('*')
          .single();
        if (conceptError || !conceptRow) throw conceptError || new Error('Concept creation failed');

        const payments = Array.isArray(concept.supplier_payments) ? concept.supplier_payments : [];
        if (payments.length > 0) {
          const rows = payments.map((payment: any, paymentIndex: number) => ({
            offer_id: offerId,
            cost_concept_id: conceptRow.id,
            milestone_number: Number(payment.milestone_number || paymentIndex + 1),
            milestone_title: String(payment.milestone_title || payment.title || `Payment ${paymentIndex + 1}`),
            percentage_of_concept: toNumber(payment.percentage_of_concept ?? payment.percentage, 0),
            amount: Number((toNumber(conceptRow.total_cost, 0) * toNumber(payment.percentage_of_concept ?? payment.percentage, 0) / 100).toFixed(2)),
            expected_days_after_contract: payment.expected_days_after_contract ?? payment.expected_days ?? null,
            supplier_name: payment.supplier_name || payment.supplier || null,
            payment_terms: payment.payment_terms || null,
            description: payment.description || '',
            sort_order: payment.sort_order ?? paymentIndex + 1,
          }));
          const { error: paymentsError } = await supabase.from('offer_supplier_payments').insert(rows);
          if (paymentsError) throw paymentsError;
        }
      }

      return json({ success: true });
    }

    if (action === 'offers.supplier-payments.create') {
      const offerId = String(body.offerId || '');
      const conceptId = String(body.conceptId || '');
      const payload = body.payload || {};

      const { data: concept, error: conceptError } = await supabase
        .from('offer_cost_concepts')
        .select('id, total_cost')
        .eq('id', conceptId)
        .eq('offer_id', offerId)
        .single();
      if (conceptError || !concept) throw conceptError || new Error('Concept not found');

      const percentage = toNumber(payload.percentage_of_concept ?? payload.percentage, 0);
      const amount = Number((toNumber(concept.total_cost, 0) * percentage / 100).toFixed(2));

      const { data, error } = await supabase
        .from('offer_supplier_payments')
        .insert({
          offer_id: offerId,
          cost_concept_id: conceptId,
          milestone_number: Number(payload.milestone_number || 1),
          milestone_title: payload.milestone_title || payload.title || 'Payment Milestone',
          percentage_of_concept: percentage,
          amount,
          expected_days_after_contract: payload.expected_days_after_contract ?? payload.expected_days ?? null,
          supplier_name: payload.supplier_name || payload.supplier || null,
          payment_terms: payload.payment_terms || null,
          description: payload.description || '',
          sort_order: payload.sort_order || payload.milestone_number || 1,
        })
        .select('*')
        .single();
      if (error) throw error;
      return json({ payment: data });
    }

    if (action === 'offers.supplier-payments.update') {
      const offerId = String(body.offerId || '');
      const paymentId = String(body.paymentId || '');
      const patch = body.patch || {};

      const { data: existing, error: existingError } = await supabase
        .from('offer_supplier_payments')
        .select('id, cost_concept_id')
        .eq('id', paymentId)
        .eq('offer_id', offerId)
        .single();
      if (existingError || !existing) throw existingError || new Error('Payment not found');

      const { data: concept, error: conceptError } = await supabase
        .from('offer_cost_concepts')
        .select('total_cost')
        .eq('id', existing.cost_concept_id)
        .single();
      if (conceptError || !concept) throw conceptError || new Error('Concept not found');

      const percentage = patch.percentage_of_concept ?? patch.percentage;
      const amount = percentage == null ? patch.amount : Number((toNumber(concept.total_cost, 0) * toNumber(percentage, 0) / 100).toFixed(2));

      const { data, error } = await supabase
        .from('offer_supplier_payments')
        .update({
          milestone_number: patch.milestone_number,
          milestone_title: patch.milestone_title ?? patch.title,
          percentage_of_concept: percentage,
          amount,
          expected_days_after_contract: patch.expected_days_after_contract ?? patch.expected_days,
          supplier_name: patch.supplier_name ?? patch.supplier,
          payment_terms: patch.payment_terms,
          description: patch.description,
          sort_order: patch.sort_order,
        })
        .eq('id', paymentId)
        .eq('offer_id', offerId)
        .select('*')
        .single();
      if (error) throw error;
      return json({ payment: data });
    }

    if (action === 'offers.supplier-payments.delete') {
      const offerId = String(body.offerId || '');
      const paymentId = String(body.paymentId || '');
      const { error } = await supabase
        .from('offer_supplier_payments')
        .delete()
        .eq('id', paymentId)
        .eq('offer_id', offerId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'offers.cash-flow.generate' || action === 'offers.cash-flow.optimize' || action === 'offers.cash-flow.export') {
      const offerId = String(body.offerId || '');
      const contractStartDate = body.contractStartDate ? String(body.contractStartDate) : undefined;

      const [{ data: offerRow, error: offerError }, { data: milestones, error: milestonesError }, { data: payments, error: paymentsError }] = await Promise.all([
        supabase.from('offers').select('id, total_amount').eq('id', offerId).single(),
        supabase.from('offer_payment_milestones').select('*').eq('offer_id', offerId),
        supabase.from('offer_supplier_payments').select('*').eq('offer_id', offerId),
      ]);

      if (offerError || !offerRow) throw offerError || new Error('Offer not found');
      if (milestonesError) throw milestonesError;
      if (paymentsError) throw paymentsError;

      const cashFlowData = generateCashFlow(milestones || [], payments || [], toNumber(offerRow.total_amount, 0), contractStartDate);

      if (action === 'offers.cash-flow.generate') {
        return json(cashFlowData);
      }

      if (action === 'offers.cash-flow.optimize') {
        return json({ scenarios: generateOptimizationScenarios(cashFlowData) });
      }

      const csvLines = [
        'date,day_index,client_inflow,supplier_outflow,net_cash_flow,cumulative_inflow,cumulative_outflow,cash_balance',
        ...cashFlowData.cashFlow.map((row) => [
          row.date,
          row.day_index,
          row.client_inflow,
          row.supplier_outflow,
          row.net_cash_flow,
          row.cumulative_inflow,
          row.cumulative_outflow,
          row.cash_balance,
        ].join(',')),
      ];

      return json({ format: 'csv', content: csvLines.join('\n') });
    }

    if (action === 'offers.cash-flow.apply-scenario') {
      const offerId = String(body.offerId || '');
      const scenarioId = String(body.scenarioId || '');

      const { data: milestones, error } = await supabase
        .from('offer_payment_milestones')
        .select('*')
        .eq('offer_id', offerId)
        .order('milestone_number', { ascending: true });
      if (error) throw error;

      const sorted = [...(milestones || [])].sort((a: any, b: any) => a.milestone_number - b.milestone_number);
      if (sorted.length === 0) return json({ success: false, message: 'No payment milestones found.' }, 400);

      const updated = sorted.map((item: any) => ({ ...item, percentage: toNumber(item.percentage, 0) }));

      if (scenarioId === 'front-load-client-payments') {
        if (updated[0]) updated[0].percentage = clamp(updated[0].percentage + 15, 0, 100);
        if (updated[updated.length - 1]) updated[updated.length - 1].percentage = clamp(updated[updated.length - 1].percentage - 15, 0, 100);
      } else if (scenarioId === 'milestone-consolidation' && updated.length >= 3) {
        updated[1].percentage = clamp(updated[1].percentage + updated[2].percentage * 0.5, 0, 100);
        updated[2].percentage = clamp(updated[2].percentage * 0.5, 0, 100);
      } else if (scenarioId === 'early-payment-discount-program') {
        if (updated[1]) updated[1].expected_days_after_contract = Math.max(0, toNumber(updated[1].expected_days_after_contract, 0) - 15);
      }

      const total = updated.reduce((sum: number, item: any) => sum + toNumber(item.percentage, 0), 0) || 1;
      const normalized = updated.map((item: any, idx: number) => ({
        ...item,
        percentage: Number(((toNumber(item.percentage, 0) * 100) / total).toFixed(2)),
        sort_order: idx + 1,
      }));

      for (const item of normalized) {
        await supabase
          .from('offer_payment_milestones')
          .update({
            percentage: item.percentage,
            expected_days_after_contract: item.expected_days_after_contract,
            sort_order: item.sort_order,
          })
          .eq('id', item.id)
          .eq('offer_id', offerId);
      }

      const { data: refreshed, error: refreshedError } = await supabase
        .from('offer_payment_milestones')
        .select('*')
        .eq('offer_id', offerId)
        .order('milestone_number', { ascending: true });
      if (refreshedError) throw refreshedError;

      return json({ success: true, milestones: refreshed || [] });
    }

    if (action === 'offers.payment-terms.validate') {
      const offerId = String(body.offerId || '');

      const [{ data: offerRow, error: offerError }, { data: milestones, error: milestonesError }, { data: concepts, error: conceptsError }] = await Promise.all([
        supabase.from('offers').select('id, total_amount').eq('id', offerId).single(),
        supabase.from('offer_payment_milestones').select('*').eq('offer_id', offerId),
        supabase.from('offer_cost_concepts').select('*').eq('offer_id', offerId),
      ]);

      if (offerError || !offerRow) throw offerError || new Error('Offer not found');
      if (milestonesError) throw milestonesError;
      if (conceptsError) throw conceptsError;

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!milestones || milestones.length === 0) {
        errors.push('Client payment milestones are mandatory. Add at least one milestone (H1).');
      }

      const totalPercentage = (milestones || []).reduce((sum: number, row: any) => sum + toNumber(row.percentage, 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        errors.push(`Payment milestones total ${Number(totalPercentage.toFixed(2))}%. Must equal 100%.`);
      }

      (milestones || []).forEach((milestone: any) => {
        if (!String(milestone.milestone_title || '').trim()) {
          errors.push(`Milestone H${milestone.milestone_number} must have a description/title.`);
        }
      });

      if (!concepts || concepts.length === 0) {
        errors.push('At least one cost concept (materials, engineering, etc.) is required.');
      }

      const totalCost = (concepts || []).reduce((sum: number, row: any) => sum + toNumber(row.total_cost, 0), 0);
      const offerTotal = toNumber(offerRow.total_amount, 0);
      if (totalCost > offerTotal) {
        errors.push(`Total costs (€${Number(totalCost.toFixed(2))}) exceed offer total (€${Number(offerTotal.toFixed(2))}). Negative margin.`);
      }

      if (offerTotal > 0 && totalCost / offerTotal > 0.8) {
        warnings.push('Projected margin is below 20%. Consider optimizing supplier payment terms.');
      }

      return json({ isValid: errors.length === 0, errors, warnings });
    }

    return json({ error: 'Unknown action' }, 404);
  } catch (error: any) {
    return json({ error: error?.message || 'Unexpected offers API error' }, 500);
  }
});
