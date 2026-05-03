import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/store/DataStore';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { TemplateSelector } from '@/components/offers/TemplateSelector';
import { ContentAssignmentPanel } from '@/components/offers/ContentAssignmentPanel';
import { OfferConditionsManager } from '@/components/offers/OfferConditionsManager';
import { PaymentMilestonesEditor } from '@/components/offers/PaymentMilestonesEditor';
import { CostConceptsEditor } from '@/components/offers/CostConceptsEditor';
import { CashFlowDashboard } from '@/components/offers/CashFlowDashboard';
import { ContentLibraryService, type OfferContentBlock } from '@/services/offer/ContentLibraryService';
import { OfferSerialNumberService } from '@/services/offer/OfferSerialNumberService';
import { OfferVersionService } from '@/services/offer/OfferVersionService';
import { OfferDocumentGenerator } from '@/services/offer/OfferDocumentGenerator';
import { getTemplateByType, type OfferTemplateType } from '@/services/offer/offerTemplates';
import { PaymentMilestoneService, type CostConcept, type PaymentTermsValidation } from '@/services/payments/PaymentMilestoneService';
import type { ClientMilestone } from '@/services/payments/CashFlowGenerator';

type Step = 1 | 2 | 3 | 4 | 5;

function hashId(prefix: string, value: string) {
  const raw = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `${prefix}_${(hash >>> 0).toString(16)}`;
}

export function OfferCreationPanel() {
  const { activeCompanyId, data } = useData();
  const { toast } = useToast();
  const serialService = useMemo(() => new OfferSerialNumberService(), []);
  const versionService = useMemo(() => new OfferVersionService(), []);
  const contentService = useMemo(() => new ContentLibraryService(), []);
  const generator = useMemo(() => new OfferDocumentGenerator(), []);
  const paymentService = useMemo(() => new PaymentMilestoneService(), []);

  const [step, setStep] = useState<Step>(1);
  const [nextSerialNumber, setNextSerialNumber] = useState('OFF-2026-100');
  const [selectedTemplate, setSelectedTemplate] = useState<OfferTemplateType>('machine_selling');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [contentAssignments, setContentAssignments] = useState<Map<string, string>>(new Map());
  const [customContent, setCustomContent] = useState<Record<string, string>>({});
  const [conditionsIds, setConditionsIds] = useState<string[]>([]);
  const [contentBlocks, setContentBlocks] = useState<OfferContentBlock[]>([]);
  const [paymentMilestones, setPaymentMilestones] = useState<ClientMilestone[]>([]);
  const [costConcepts, setCostConcepts] = useState<CostConcept[]>([]);
  const [showCashFlow, setShowCashFlow] = useState(false);
  const [validation, setValidation] = useState<PaymentTermsValidation>({ isValid: false, errors: [], warnings: [] });

  const [offer, setOffer] = useState({
    id: '',
    serial_number: '',
    title: '',
    customer_name: '',
    valid_until: '',
    total_amount: 0,
    notes: '',
    status: 'draft',
    version: 1,
    version_group_id: '',
  });

  const template = useMemo(() => getTemplateByType(selectedTemplate), [selectedTemplate]);
  const customerSuggestions = useMemo(() => {
    const values = new Set<string>();
    data.orders.forEach((row) => row.customerName && values.add(row.customerName));
    data.opportunities.forEach((row) => row.customerName && values.add(row.customerName));
    data.leads.forEach((row) => row.companyName && values.add(row.companyName));
    data.contacts.forEach((row) => row.companyName && values.add(row.companyName));
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [data.orders, data.opportunities, data.leads, data.contacts]);

  useEffect(() => {
    serialService.getNextSerial().then(setNextSerialNumber).catch(() => setNextSerialNumber('OFF-2026-100'));
    contentService.getContentBlocks(selectedTemplate).then(setContentBlocks).catch(() => setContentBlocks([]));
  }, []);

  useEffect(() => {
    const defaults = template.sections.map((section) => section.id);
    setSelectedSections(defaults);
    contentService.getContentBlocks(selectedTemplate).then(setContentBlocks).catch(() => setContentBlocks([]));
  }, [selectedTemplate]);

  useEffect(() => {
    if (!activeCompanyId) return;

    const channel = supabase
      .channel(`offer-events-${activeCompanyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'offers',
          filter: `company_id=eq.${activeCompanyId}`,
        },
        (payload) => {
          window.dispatchEvent(new CustomEvent('offer.created', { detail: payload.new }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCompanyId]);

  const loadPaymentTerms = async (offerId: string) => {
    const [milestones, concepts, validationResult] = await Promise.all([
      paymentService.getClientMilestones(offerId),
      paymentService.getCostConcepts(offerId),
      paymentService.validatePaymentTerms(offerId),
    ]);

    if (milestones.length > 0) setPaymentMilestones(milestones);
    if (concepts.length > 0) setCostConcepts(concepts);
    setValidation(validationResult);
  };

  useEffect(() => {
    if (!offer.id) return;
    loadPaymentTerms(offer.id).catch(() => {
      setValidation({ isValid: false, errors: [], warnings: [] });
    });
  }, [offer.id]);

  const upsertAssignment = (sectionId: string, blockId: string) => {
    const map = new Map(contentAssignments);
    map.set(sectionId, blockId);
    setContentAssignments(map);
  };

  const saveDraft = async () => {
    if (!activeCompanyId) {
      toast({ title: 'Select a company first', variant: 'destructive' });
      return;
    }

    const customerHash = hashId('cmp', offer.customer_name || 'unknown');

    const assignedBlocks = Object.fromEntries(Array.from(contentAssignments.entries()));

    const result = await serialService.createOffer({
      companyId: activeCompanyId,
      title: offer.title || 'Untitled Offer',
      customerName: offer.customer_name,
      templateType: selectedTemplate,
      validUntil: offer.valid_until || null,
      totalAmount: Number(offer.total_amount || 0),
      clientEntityHash: customerHash,
      offerData: {
        customer_name: offer.customer_name,
        notes: offer.notes,
        sections: selectedSections,
        assignments: assignedBlocks,
        custom_content: customContent,
        selected_conditions: conditionsIds,
      },
    });

    setOffer((prev) => ({
      ...prev,
      id: result.offerId,
      serial_number: result.serialNumber,
      version: result.offer.version,
      version_group_id: result.offer.version_group_id,
    }));

    if (paymentMilestones.length > 0) {
      await paymentService.upsertClientMilestones(result.offerId, paymentMilestones);
    }

    if (costConcepts.length > 0) {
      await paymentService.replaceCostConcepts(result.offerId, costConcepts);
    }

    const validationResult = await paymentService.validatePaymentTerms(result.offerId);
    setValidation(validationResult);

    setNextSerialNumber(await serialService.getNextSerial());
    window.dispatchEvent(new CustomEvent('offer.created', { detail: { offerId: result.offerId, serialNumber: result.serialNumber } }));
    toast({ title: 'Offer draft created', description: `Serial ${result.serialNumber}` });
  };

  const handleEditOffer = async () => {
    if (!offer.id) return;

    const choice = window.confirm(
      `Edit offer ${offer.serial_number || '(draft)'}\n\nOK = Overwrite current offer\nCancel = Create new version`,
    );

    const editedData = {
      customer_name: offer.customer_name,
      title: offer.title,
      valid_until: offer.valid_until,
      total_amount: Number(offer.total_amount || 0),
      notes: offer.notes,
      template_type: selectedTemplate,
      offer_data: {
        sections: selectedSections,
        assignments: Object.fromEntries(Array.from(contentAssignments.entries())),
        custom_content: customContent,
        selected_conditions: conditionsIds,
      },
    };

    if (choice) {
      await versionService.overwriteOffer(offer.id, editedData);
      window.dispatchEvent(new CustomEvent('offer.updated', { detail: { offerId: offer.id } }));
      toast({ title: 'Offer updated successfully' });
      return;
    }

    const created = await versionService.createNewVersion({
      id: offer.id,
      serial_number: offer.serial_number,
      version: offer.version,
      version_group_id: offer.version_group_id,
      status: offer.status,
      offer_data: {},
    }, editedData);

    setOffer((prev) => ({
      ...prev,
      id: created.newVersionId,
      serial_number: created.serialNumber,
      version: created.version,
      status: 'draft',
    }));
    window.dispatchEvent(new CustomEvent('offer.versioned', { detail: { offerId: created.newVersionId, version: created.version } }));
    toast({ title: `Created version ${created.version}` });
  };

  const generateWord = async () => {
    if (!offer.id) {
      toast({ title: 'Save draft first', variant: 'destructive' });
      return;
    }

    const buffer = await generator.generateWord({
      id: offer.id,
      serial_number: offer.serial_number,
      title: offer.title,
      template_type: selectedTemplate,
      valid_until: offer.valid_until,
      total_amount: Number(offer.total_amount || 0),
      currency: 'EUR',
      offer_data: {
        customer_name: offer.customer_name,
      },
    }, selectedSections, contentAssignments, {
      clientMilestones: paymentMilestones,
      costConcepts,
    });

    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `offer_${offer.serial_number || 'draft'}.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Word document generated' });
  };

  const finalize = async () => {
    if (!offer.id) {
      toast({ title: 'Save draft first', variant: 'destructive' });
      return;
    }

    const validationResult = await paymentService.validatePaymentTerms(offer.id);
    setValidation(validationResult);

    if (!validationResult.isValid) {
      toast({ title: 'Cannot finalize offer', description: validationResult.errors[0], variant: 'destructive' });
      return;
    }

    const result = await serialService.finalizeOffer(offer.id);
    setOffer((prev) => ({ ...prev, status: 'finalized' }));
    toast({ title: 'Offer finalized', description: result.finalizedAt });
  };

  const persistPaymentTerms = async () => {
    if (!offer.id) {
      toast({ title: 'Save draft first', variant: 'destructive' });
      return;
    }

    await paymentService.upsertClientMilestones(offer.id, paymentMilestones);
    await paymentService.replaceCostConcepts(offer.id, costConcepts);
    const validationResult = await paymentService.validatePaymentTerms(offer.id);
    setValidation(validationResult);

    if (!validationResult.isValid) {
      toast({ title: 'Payment terms saved with issues', description: validationResult.errors[0], variant: 'destructive' });
      return;
    }

    toast({ title: 'Payment terms and cash flow settings saved' });
    await loadPaymentTerms(offer.id);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Create New Offer</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2">
          <div>Next Serial: <strong>{nextSerialNumber}</strong></div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Step {step} / 5</Badge>
            <Button size="sm" variant="outline" onClick={handleEditOffer} disabled={!offer.id}>Edit Offer</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((idx) => (
          <Button key={idx} variant={step === idx ? 'default' : 'outline'} onClick={() => setStep(idx as Step)}>
            {idx === 1
              ? '1. Basic Info'
              : idx === 2
                ? '2. Template & Structure'
                : idx === 3
                  ? '3. Content Assignment'
                  : idx === 4
                    ? '4. Payment Terms & Cash Flow'
                    : '5. Review & Generate'}
          </Button>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Offer Title</Label>
                <Input value={offer.title} onChange={(e) => setOffer((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Client / Customer</Label>
                <Input value={offer.customer_name} onChange={(e) => setOffer((prev) => ({ ...prev, customer_name: e.target.value }))} list="offer-customers" />
                <datalist id="offer-customers">
                  {customerSuggestions.map((name) => <option key={name} value={name} />)}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label>Valid Until</Label>
                <Input type="date" value={offer.valid_until} onChange={(e) => setOffer((prev) => ({ ...prev, valid_until: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Total Amount (EUR)</Label>
                <Input type="number" value={offer.total_amount} onChange={(e) => setOffer((prev) => ({ ...prev, total_amount: Number(e.target.value || 0) }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea rows={4} value={offer.notes} onChange={(e) => setOffer((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
            <Button onClick={saveDraft}>Save Draft</Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <TemplateSelector selectedTemplate={selectedTemplate} onSelect={setSelectedTemplate} />
      )}

      {step === 3 && (
        <div className="space-y-4">
          <ContentAssignmentPanel
            template={template}
            contentLibrary={contentBlocks}
            selectedSections={selectedSections}
            assignments={contentAssignments}
            customContent={customContent}
            onSelectSection={(sectionId, selected) => {
              if (selected) setSelectedSections((prev) => [...new Set([...prev, sectionId])]);
              else setSelectedSections((prev) => prev.filter((id) => id !== sectionId));
            }}
            onAssign={upsertAssignment}
            onCustomize={(sectionId, value) => setCustomContent((prev) => ({ ...prev, [sectionId]: value }))}
          />
          <OfferConditionsManager selectedIds={conditionsIds} onChange={setConditionsIds} />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <PaymentMilestonesEditor
            offerTotal={Number(offer.total_amount || 0)}
            value={paymentMilestones}
            onMilestonesChange={setPaymentMilestones}
          />

          <CostConceptsEditor
            offerTotal={Number(offer.total_amount || 0)}
            value={costConcepts}
            onCostsChange={setCostConcepts}
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={persistPaymentTerms}>Save Payment Terms</Button>
            <Button variant="outline" onClick={() => setShowCashFlow((prev) => !prev)} disabled={!offer.id}>
              {showCashFlow ? 'Hide Cash Flow Analysis' : 'Show Cash Flow Analysis'}
            </Button>
          </div>

          {showCashFlow && offer.id && (
            <CashFlowDashboard
              offerId={offer.id}
              contractStartDate={new Date().toISOString().slice(0, 10)}
              onScenarioApplied={async () => {
                await loadPaymentTerms(offer.id);
              }}
            />
          )}

          {!validation.isValid && validation.errors.length > 0 && (
            <Card className="border-destructive">
              <CardHeader><CardTitle className="text-base text-destructive">Cannot proceed</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {validation.errors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {step === 5 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Review & Generate</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p><strong>Serial:</strong> {offer.serial_number || nextSerialNumber}</p>
            <p><strong>Template:</strong> {selectedTemplate}</p>
            <p><strong>Sections:</strong> {selectedSections.join(', ')}</p>
            <p><strong>Client payment milestones:</strong> {paymentMilestones.length}</p>
            <p><strong>Cost concepts:</strong> {costConcepts.length}</p>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={generateWord}>Generate Word</Button>
              <Button onClick={finalize}>Finalize Offer</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
