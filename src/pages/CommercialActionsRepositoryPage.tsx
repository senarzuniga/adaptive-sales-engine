import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type MonitoringTask, useData } from '@/store/DataStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  DEFAULT_REPOSITORY,
  type ActionsRepository,
  type CommercialAction,
  cloneRepository,
  detectCircularTriggers,
  evaluateKpis,
  filterByWorkingHours,
  flattenActions,
  generateActionByRule,
  getActionsByStage,
  getNextBestAction,
  loadRepositoryFromStorage,
  mergeRepository,
  saveRepositoryToStorage,
  scoreAction,
  toMonitoringTask,
  triggerActions,
  upsertAction,
  validateRepository,
} from '@/lib/commercialActionsRepository';
import { Layers, Play, Plus, Rocket, Save, Target, Timer, Wand2 } from 'lucide-react';

const EVENT_OPTIONS = [
  'new_signal',
  'lead_created',
  'offer_pending',
  'health_score_updated',
  'usage_updated',
  'nps_updated',
  'contract_expiring',
  'planning_cycle',
  'any_input_changed',
];

const emptyAction: CommercialAction = {
  id: '',
  name: '',
  description: '',
  role: 'Sales Agent',
  importance_score: 70,
  strategy_alignment: 70,
  estimated_hours: 2,
  inputs: [],
  outputs: [],
  triggers: [{ event: 'planning_cycle', logic: 'true' }],
  kpis: [{ name: 'Action completion', target: 100, unit: '%' }],
  ai_tags: [],
  goal: '',
  supportive_content: {
    call_script: '',
    email_template: '',
    presentation_notes: '',
  },
};

type OfferPipelineBucket = 'live' | 'cancelled' | 'sold';

interface OfferPipelineEntry {
  id: string;
  offer_number: string;
  title: string;
  customer_name: string;
  company_name: string;
  status: string;
  bucket: OfferPipelineBucket;
  score: number;
  last_update: string;
  context: string;
  next_action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: string;
}

const pipelineDemoOffers: OfferPipelineEntry[] = [
  {
    id: 'demo-ingecart-1',
    offer_number: 'ING-2026-042',
    title: 'Cartonajes Font / packaging line follow-up',
    customer_name: 'Cartonajes Font',
    company_name: 'Ingecart 2018 SL',
    status: 'follow_up',
    bucket: 'live',
    score: 96,
    last_update: 'Today',
    context: 'Commercial follow-up required on technical validation and cost alignment for the active opportunity.',
    next_action: 'Send final technical review and confirm the commercial decision date with the customer.',
    priority: 'critical',
    source: 'Ingecart / cgo@ingecart.es',
  },
  {
    id: 'demo-ingecart-2',
    offer_number: 'ING-2026-055',
    title: 'Cascades Waterloo - technical package and approvals',
    customer_name: 'Cascades Waterloo',
    company_name: 'Ingecart 2018 SL',
    status: 'pending',
    bucket: 'live',
    score: 91,
    last_update: '2 days ago',
    context: 'Pipeline remains active after alignment on plant requirements and engineering documentation.',
    next_action: 'Validate the project gate and prepare the next customer meeting with the engineering team.',
    priority: 'high',
    source: 'Ingecart / isenar.cta@gmail.com',
  },
  {
    id: 'demo-agilpack-1',
    offer_number: 'AGI-2026-018',
    title: 'Agilpack / packaging equipment revision',
    customer_name: 'Agilpack',
    company_name: 'Agilpack',
    status: 'postponed',
    bucket: 'cancelled',
    score: 58,
    last_update: 'Last week',
    context: 'Decision postponed while internal budget is reviewed; commercial action remains active with a recovery path.',
    next_action: 'Re-activate the opportunity with a short budget review and restart the next-step proposal.',
    priority: 'medium',
    source: 'Agilpack / shared mailbox',
  },
  {
    id: 'demo-tween-1',
    offer_number: 'TWN-2026-010',
    title: 'Tween / automation package signed',
    customer_name: 'Tween',
    company_name: 'Tween',
    status: 'won',
    bucket: 'sold',
    score: 88,
    last_update: 'This week',
    context: 'The offer moved to execution; handoff to project management and commercial delivery is required.',
    next_action: 'Activate the project management workflow, confirm milestones, and set the delivery plan.',
    priority: 'high',
    source: 'Tween / commercial follow-up',
  },
  {
    id: 'demo-iar-1',
    offer_number: 'IAR-2026-007',
    title: 'IAR / downstream line quotation',
    customer_name: 'IAR',
    company_name: 'IAR',
    status: 'declined',
    bucket: 'cancelled',
    score: 42,
    last_update: '1 month ago',
    context: 'The customer withdrew the request after a revision of internal priorities; keep as a learning account.',
    next_action: 'Document the lost decision and convert any retained technical information into a reusable proposal template.',
    priority: 'low',
    source: 'IAR / archive',
  },
  {
    id: 'demo-ingecart-3',
    offer_number: 'ING-2026-071',
    title: 'Sterner Global / mastercorr project follow-up',
    customer_name: 'Sterner Global',
    company_name: 'Ingecart 2018 SL',
    status: 'closed',
    bucket: 'sold',
    score: 84,
    last_update: 'Today',
    context: 'Program is moving into execution and requires project owner coordination from the commercial stage.',
    next_action: 'Finalize handoff to project management and confirm the delivery calendar and engineering plan.',
    priority: 'high',
    source: 'Ingecart / portfolio tracking',
  },
];

const normalizeOfferBucket = (status: string): OfferPipelineBucket => {
  const normalized = status.toLowerCase();
  if (['won', 'sold', 'accepted', 'approved', 'closed', 'converted', 'signed'].includes(normalized)) return 'sold';
  if (['cancelled', 'canceled', 'postponed', 'declined', 'lost', 'dead', 'stalled', 'on_hold', 'paused'].includes(normalized)) return 'cancelled';
  return 'live';
};

const normalizeOfferPipelineEntry = (offer: Record<string, any>): OfferPipelineEntry => {
  const status = String(offer.status || 'draft');
  const bucket = normalizeOfferBucket(status);
  const score = Number(offer.global_score ?? offer.score ?? (bucket === 'live' ? 90 : bucket === 'sold' ? 82 : 55));
  const title = String(offer.title || offer.offer_number || 'Unnamed offer');
  const customerName = String(offer.customer_name || offer.customerName || 'Customer pending');
  const companyName = String(offer.company_name || offer.companyName || 'Portfolio');

  return {
    id: String(offer.id || `${offer.offer_number || customerName}-${Math.random().toString(16).slice(2)}`),
    offer_number: String(offer.offer_number || offer.offerNumber || 'N/A'),
    title,
    customer_name: customerName,
    company_name: companyName,
    status,
    bucket,
    score: Number.isFinite(score) ? score : 0,
    last_update: offer.updated_at ? new Date(offer.updated_at).toLocaleDateString() : 'recently',
    context:
      bucket === 'live'
        ? 'Open commercial opportunity requiring active follow-up and decision support.'
        : bucket === 'sold'
          ? 'Offer has been won and requires execution handoff to project management.'
          : 'Decision paused or missed; recovery and learning actions should be documented.',
    next_action:
      bucket === 'live'
        ? 'Confirm next meeting, review technical constraints, and push the offer to a decision milestone.'
        : bucket === 'sold'
          ? 'Start the project activation checklist and confirm full delivery ownership.'
          : 'Reassess commercial conditions and decide whether to recover, archive, or convert the opportunity.',
    priority: score >= 90 ? 'critical' : score >= 75 ? 'high' : score >= 60 ? 'medium' : 'low',
    source: offer.source || 'Commercial pipeline',
  };
};

const buildPipelineTask = (offer: OfferPipelineEntry): MonitoringTask => ({
  id: `pipeline_${offer.id}`,
  title: `${offer.customer_name} — ${offer.title}`,
  description: `${offer.next_action} Context: ${offer.context}`,
  pillar: offer.bucket === 'sold' ? 'p2' : offer.bucket === 'cancelled' ? 'p1' : 'p0',
  status: 'todo',
  priority: offer.priority === 'critical' ? 'critical' : offer.priority === 'high' ? 'high' : offer.priority === 'medium' ? 'medium' : 'low',
  category: offer.bucket === 'sold' ? 'strategy' : offer.bucket === 'cancelled' ? 'analysis' : 'follow_up',
  assignee: 'sales',
  dueDate: new Date(Date.now() + (offer.priority === 'critical' ? 2 : 4) * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  notes: [offer.context, offer.next_action, `Source: ${offer.source}`],
  actionContent: {
    goal: offer.next_action,
    callScript: `Review the current status of ${offer.customer_name} and focus on the next commercial decision or execution milestone.`,
    emailTemplate: `Subject: Follow-up on ${offer.offer_number}\n\nHi team,\n\nWe are prioritizing the next step for ${offer.customer_name}. The current status is ${offer.status}. Please confirm the decision path, technical points, and required next milestone.`,
    presentationNotes: `${offer.context} ${offer.next_action}`,
  },
});

const CommercialActionsRepositoryPage = () => {
  const { addTask, activeCompanyId } = useData();
  const [repository, setRepository] = useState<ActionsRepository>(() => loadRepositoryFromStorage());
  const [selectedStage, setSelectedStage] = useState(repository.lifecycle_stages[0]?.stage || 'PIPELINE_EXECUTION');
  const [workingHours, setWorkingHours] = useState(40);
  const [triggerEvent, setTriggerEvent] = useState('planning_cycle');
  const [healthScore, setHealthScore] = useState(55);
  const [usageGrowth, setUsageGrowth] = useState(25);
  const [churnRisk, setChurnRisk] = useState(0.75);
  const [npsScore, setNpsScore] = useState(20);
  const [simulatedActions, setSimulatedActions] = useState<Array<CommercialAction & { stage: string }>>([]);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [formStage, setFormStage] = useState(selectedStage);
  const [formAction, setFormAction] = useState<CommercialAction>(emptyAction);
  const [offerPipeline, setOfferPipeline] = useState<OfferPipelineEntry[]>([]);
  const [offerPipelineLoading, setOfferPipelineLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadOfferPipeline = async () => {
      setOfferPipelineLoading(true);
      try {
        const { data, error } = await supabase
          .from('offers')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(100);

        if (error) {
          throw error;
        }

        const normalized = (data && data.length > 0 ? data : pipelineDemoOffers).map(normalizeOfferPipelineEntry);
        if (isMounted) {
          setOfferPipeline(normalized);
        }
      } catch {
        if (isMounted) {
          setOfferPipeline(pipelineDemoOffers);
        }
      } finally {
        if (isMounted) {
          setOfferPipelineLoading(false);
        }
      }
    };

    loadOfferPipeline();
    return () => {
      isMounted = false;
    };
  }, []);

  const allActions = useMemo(
    () =>
      flattenActions(repository)
        .map((action) => ({ ...action, computed_score: scoreAction(action, { health_score: healthScore, usage_growth: usageGrowth, churn_risk: churnRisk, nps_score: npsScore }) }))
        .sort((a, b) => b.computed_score - a.computed_score),
    [repository, healthScore, usageGrowth, churnRisk, npsScore],
  );

  const stageActions = useMemo(() => getActionsByStage(repository, selectedStage), [repository, selectedStage]);

  const capacityPlan = useMemo(() => filterByWorkingHours(allActions, workingHours), [allActions, workingHours]);

  const nextBestAction = useMemo(
    () =>
      getNextBestAction(repository, {
        health_score: healthScore,
        usage_growth: usageGrowth,
        churn_risk: churnRisk,
        nps_score: npsScore,
      }),
    [repository, healthScore, usageGrowth, churnRisk, npsScore],
  );

  const validation = useMemo(() => validateRepository(repository), [repository]);
  const cycles = useMemo(() => detectCircularTriggers(repository), [repository]);

  const persist = (nextRepo: ActionsRepository, message?: string) => {
    setRepository(nextRepo);
    saveRepositoryToStorage(nextRepo);
    if (message) toast({ title: message });
  };

  const resetForm = () => {
    setFormAction(emptyAction);
    setEditingActionId(null);
    setFormStage(selectedStage);
  };

  const startEdit = (action: CommercialAction) => {
    setEditingActionId(action.id);
    setFormStage(selectedStage);
    setFormAction(cloneRepository(repository).lifecycle_stages.find((s) => s.stage === selectedStage)?.actions.find((a) => a.id === action.id) || action);
  };

  const saveAction = () => {
    if (!formAction.id.trim() || !formAction.description.trim() || !formAction.role.trim()) {
      toast({ title: 'id, description and role are required', variant: 'destructive' });
      return;
    }

    const actionToSave: CommercialAction = {
      ...formAction,
      inputs: formAction.inputs.filter(Boolean),
      outputs: formAction.outputs.filter(Boolean),
      ai_tags: formAction.ai_tags.filter(Boolean),
      triggers: formAction.triggers.filter((t) => t.event.trim() && t.logic.trim()),
      kpis: formAction.kpis.filter((k) => k.name.trim()),
    };

    const nextRepo = upsertAction(repository, actionToSave, formStage, 'ui_user');
    const report = validateRepository(nextRepo);
    if (!report.valid) {
      toast({ title: 'Validation failed', description: report.issues[0], variant: 'destructive' });
      return;
    }

    persist(nextRepo, editingActionId ? 'Action updated' : 'Action created');
    resetForm();
  };

  const runTriggerSimulation = () => {
    const generated = generateActionByRule({
      churn_risk: churnRisk,
      usage_growth: usageGrowth,
      nps_score: npsScore,
    });

    let workingRepo = repository;
    if (generated.length > 0) {
      workingRepo = mergeRepository(
        repository,
        generated.map((g) => ({ ...g.action, stage: g.stage })),
        'agent_auto_generator',
      );
      persist(workingRepo, 'AI-generated actions added based on risk/opportunity signals');
    }

    const triggered = triggerActions(workingRepo, {
      event: triggerEvent,
      health_score: healthScore,
      usage_growth: usageGrowth,
      churn_risk: churnRisk,
      nps_score: npsScore,
    });

    setSimulatedActions(triggered);
  };

  const addAsTask = async (action: CommercialAction, stage = selectedStage) => {
    await addTask(toMonitoringTask(action, stage));
    toast({ title: `Task created from action: ${action.name}` });
  };

  const addCapacityPlanTasks = async () => {
    for (const action of capacityPlan.selected) {
      await addTask(toMonitoringTask(action, action.stage || selectedStage));
    }
    toast({
      title: `${capacityPlan.selected.length} tasks created for ${workingHours}h capacity`,
      description: `Used ${capacityPlan.usedHours}h of ${workingHours}h`,
    });
  };

  const restoreDefaults = () => {
    persist(cloneRepository(DEFAULT_REPOSITORY), 'Repository restored to base model');
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Commercial Actions Repository
          </h2>
          <p className="text-sm text-muted-foreground">
            Dynamic action repository for Sales, Customer Success, Growth, RevOps, and Orchestrator agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Version {repository.version}</Badge>
          <Button variant="outline" onClick={restoreDefaults}>Restore Base</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Actions</p><p className="text-xl font-bold">{allActions.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Next Best Action</p><p className="text-sm font-semibold line-clamp-2">{nextBestAction?.name || 'N/A'}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Validation</p><p className={`text-sm font-semibold ${validation.valid && cycles.length === 0 ? 'text-green-600' : 'text-destructive'}`}>{validation.valid && cycles.length === 0 ? 'Valid chain' : 'Blocked'}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Execution Rule</p><p className="text-sm font-semibold">No partial execution</p></CardContent></Card>
      </div>

      <Tabs defaultValue="repository" className="space-y-4">
        <TabsList>
          <TabsTrigger value="repository">Repository</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline View</TabsTrigger>
          <TabsTrigger value="simulate">Trigger Simulation</TabsTrigger>
          <TabsTrigger value="capacity">Capacity Panel</TabsTrigger>
        </TabsList>

        <TabsContent value="repository" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">View by lifecycle stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>Stage</Label>
                  <Select value={selectedStage} onValueChange={(v) => { setSelectedStage(v); if (!editingActionId) setFormStage(v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {repository.lifecycle_stages.map((stageNode) => (
                        <SelectItem key={stageNode.stage} value={stageNode.stage}>{stageNode.stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Actions in stage</Label>
                  <div className="h-10 px-3 border rounded-md flex items-center text-sm">{stageActions.length}</div>
                </div>
                <div>
                  <Label>Average score</Label>
                  <div className="h-10 px-3 border rounded-md flex items-center text-sm">
                    {stageActions.length > 0 ? Math.round(stageActions.reduce((acc, action) => acc + scoreAction(action), 0) / stageActions.length) : 0}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {stageActions.map((action) => {
                  const computed = scoreAction(action, { health_score: healthScore, usage_growth: usageGrowth, churn_risk: churnRisk, nps_score: npsScore });
                  return (
                    <div key={action.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline">{action.role}</Badge>
                            <Badge variant={computed >= 90 ? 'destructive' : computed >= 75 ? 'default' : 'secondary'}>
                              Score {computed}
                            </Badge>
                            <Badge variant="outline">{action.estimated_hours}h</Badge>
                          </div>
                          <p className="font-medium text-sm">{action.name}</p>
                          <p className="text-xs text-muted-foreground">{action.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Goal: {action.goal || 'Not defined'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Content: {action.supportive_content?.call_script ? 'Script' : 'No script'} · {action.supportive_content?.email_template ? 'Email' : 'No email'} · {action.supportive_content?.presentation_notes ? 'Notes' : 'No notes'}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(action)}>Edit</Button>
                          <Button size="sm" onClick={() => addAsTask(action)} className="gap-1"><Plus className="h-3.5 w-3.5" />Create task</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{editingActionId ? 'Edit action' : 'Add new action'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-4 gap-3">
                <div><Label>ID</Label><Input value={formAction.id} onChange={(e) => setFormAction((p) => ({ ...p, id: e.target.value }))} disabled={!!editingActionId} /></div>
                <div><Label>Name</Label><Input value={formAction.name} onChange={(e) => setFormAction((p) => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>Role</Label><Input value={formAction.role} onChange={(e) => setFormAction((p) => ({ ...p, role: e.target.value }))} /></div>
                <div>
                  <Label>Stage</Label>
                  <Select value={formStage} onValueChange={setFormStage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {repository.lifecycle_stages.map((stageNode) => (
                        <SelectItem key={stageNode.stage} value={stageNode.stage}>{stageNode.stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Textarea value={formAction.description} onChange={(e) => setFormAction((p) => ({ ...p, description: e.target.value }))} placeholder="Description" />

              <div className="grid md:grid-cols-3 gap-3">
                <div><Label>Importance score</Label><Input type="number" value={formAction.importance_score} onChange={(e) => setFormAction((p) => ({ ...p, importance_score: Number(e.target.value) || 0 }))} /></div>
                <div><Label>Strategy alignment</Label><Input type="number" value={formAction.strategy_alignment} onChange={(e) => setFormAction((p) => ({ ...p, strategy_alignment: Number(e.target.value) || 0 }))} /></div>
                <div><Label>Estimated hours</Label><Input type="number" step="0.5" value={formAction.estimated_hours} onChange={(e) => setFormAction((p) => ({ ...p, estimated_hours: Number(e.target.value) || 0 }))} /></div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Inputs (comma separated)</Label><Input value={formAction.inputs.join(', ')} onChange={(e) => setFormAction((p) => ({ ...p, inputs: e.target.value.split(',').map((x) => x.trim()) }))} /></div>
                <div><Label>Outputs (comma separated)</Label><Input value={formAction.outputs.join(', ')} onChange={(e) => setFormAction((p) => ({ ...p, outputs: e.target.value.split(',').map((x) => x.trim()) }))} /></div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Trigger event</Label><Input value={formAction.triggers[0]?.event || ''} onChange={(e) => setFormAction((p) => ({ ...p, triggers: [{ ...(p.triggers[0] || { event: '', logic: 'true' }), event: e.target.value }] }))} /></div>
                <div><Label>Trigger logic</Label><Input value={formAction.triggers[0]?.logic || ''} onChange={(e) => setFormAction((p) => ({ ...p, triggers: [{ ...(p.triggers[0] || { event: 'planning_cycle', logic: '' }), logic: e.target.value }] }))} /></div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>KPI name</Label><Input value={formAction.kpis[0]?.name || ''} onChange={(e) => setFormAction((p) => ({ ...p, kpis: [{ ...(p.kpis[0] || { name: '', target: 0, unit: '%' }), name: e.target.value }] }))} /></div>
                <div><Label>KPI target</Label><Input type="number" value={formAction.kpis[0]?.target || 0} onChange={(e) => setFormAction((p) => ({ ...p, kpis: [{ ...(p.kpis[0] || { name: '', target: 0, unit: '%' }), target: Number(e.target.value) || 0 }] }))} /></div>
              </div>

              <Textarea value={formAction.goal || ''} onChange={(e) => setFormAction((p) => ({ ...p, goal: e.target.value }))} placeholder="Goal" />
              <Textarea value={formAction.supportive_content?.call_script || ''} onChange={(e) => setFormAction((p) => ({ ...p, supportive_content: { ...p.supportive_content, call_script: e.target.value } }))} placeholder="Call script" />
              <Textarea value={formAction.supportive_content?.email_template || ''} onChange={(e) => setFormAction((p) => ({ ...p, supportive_content: { ...p.supportive_content, email_template: e.target.value } }))} placeholder="Email template" />
              <Textarea value={formAction.supportive_content?.presentation_notes || ''} onChange={(e) => setFormAction((p) => ({ ...p, supportive_content: { ...p.supportive_content, presentation_notes: e.target.value } }))} placeholder="Presentation notes" />

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button onClick={saveAction} className="gap-1"><Save className="h-3.5 w-3.5" />{editingActionId ? 'Update action' : 'Create action'}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Live offers</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{offerPipeline.filter((offer) => offer.bucket === 'live').length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Cancelled / postponed</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{offerPipeline.filter((offer) => offer.bucket === 'cancelled').length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Sold</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{offerPipeline.filter((offer) => offer.bucket === 'sold').length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Priority score</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{offerPipeline.length > 0 ? Math.round(offerPipeline.reduce((sum, offer) => sum + offer.score, 0) / offerPipeline.length) : 0}</p>
              </CardContent>
            </Card>
          </div>

          {offerPipelineLoading ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">Loading offer pipeline and commercial context…</CardContent>
            </Card>
          ) : (
            <div className="grid xl:grid-cols-3 gap-4">
              {(['live', 'cancelled', 'sold'] as OfferPipelineBucket[]).map((bucket) => {
                const items = offerPipeline.filter((offer) => offer.bucket === bucket);
                const label = bucket === 'live' ? 'In follow-up' : bucket === 'cancelled' ? 'Cancelled / postponed' : 'Sold / won';

                return (
                  <Card key={bucket} className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between gap-2">
                        <span>{label}</span>
                        <Badge variant={bucket === 'live' ? 'default' : bucket === 'cancelled' ? 'secondary' : 'outline'}>{items.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No offers in this stage.</p>
                      ) : items.map((offer) => (
                        <div key={offer.id} className="border rounded-md p-3 space-y-2 bg-background/70">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium line-clamp-2">{offer.title}</p>
                              <p className="text-xs text-muted-foreground">{offer.customer_name} · {offer.offer_number}</p>
                            </div>
                            <Badge variant={offer.score >= 90 ? 'destructive' : offer.score >= 75 ? 'default' : 'secondary'}>
                              {offer.score}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                            <span className="border rounded-full px-2 py-0.5">{offer.company_name}</span>
                            <span className="border rounded-full px-2 py-0.5">{offer.last_update}</span>
                            <span className="border rounded-full px-2 py-0.5">{offer.source}</span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                              <span>Priority</span>
                              <span>{offer.priority.toUpperCase()}</span>
                            </div>
                            <Progress value={offer.score} className="h-2" />
                          </div>

                          <p className="text-xs text-muted-foreground">{offer.context}</p>
                          <p className="text-xs font-medium">Action: {offer.next_action}</p>

                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (!activeCompanyId) {
                                  toast({ title: 'No company selected', description: 'Select a company to create the pipeline task.' });
                                  return;
                                }
                                addTask(buildPipelineTask(offer));
                                toast({ title: 'Offer task created', description: `${offer.customer_name} moved into the action queue.` });
                              }}
                            >
                              Create task
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="simulate" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Trigger simulation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>Event</Label>
                  <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Health score</Label><Input type="number" value={healthScore} onChange={(e) => setHealthScore(Number(e.target.value) || 0)} /></div>
                <div><Label>Usage growth (%)</Label><Input type="number" value={usageGrowth} onChange={(e) => setUsageGrowth(Number(e.target.value) || 0)} /></div>
                <div><Label>Churn risk (0-1)</Label><Input type="number" step="0.01" value={churnRisk} onChange={(e) => setChurnRisk(Number(e.target.value) || 0)} /></div>
                <div><Label>NPS score</Label><Input type="number" value={npsScore} onChange={(e) => setNpsScore(Number(e.target.value) || 0)} /></div>
              </div>

              <div className="flex justify-end">
                <Button onClick={runTriggerSimulation} className="gap-1"><Play className="h-3.5 w-3.5" />Run simulation</Button>
              </div>

              {simulatedActions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Triggered actions ({simulatedActions.length})</p>
                  {simulatedActions.map((action) => (
                    <div key={action.id} className="border rounded p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{action.name}</p>
                        <p className="text-xs text-muted-foreground">{action.stage} · {action.description}</p>
                      </div>
                      <Button size="sm" onClick={() => addAsTask(action, action.stage)} className="gap-1"><Rocket className="h-3.5 w-3.5" />Create task</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Next Best Action engine</CardTitle></CardHeader>
            <CardContent>
              {nextBestAction ? (
                <div className="border rounded p-3">
                  <p className="text-sm font-semibold">{nextBestAction.name}</p>
                  <p className="text-xs text-muted-foreground">{nextBestAction.stage} · score {nextBestAction.computed_score}</p>
                  <p className="text-xs text-muted-foreground mt-1">{nextBestAction.description}</p>
                  <Button size="sm" className="mt-2 gap-1" onClick={() => addAsTask(nextBestAction, nextBestAction.stage)}>
                    <Target className="h-3.5 w-3.5" />Create task from next-best
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No next-best action available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capacity" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Working hours panel</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-4 gap-3">
                <div>
                  <Label>Available working hours</Label>
                  <Input type="number" value={workingHours} onChange={(e) => setWorkingHours(Number(e.target.value) || 0)} />
                </div>
                <div className="border rounded-md px-3 py-2 text-sm"><span className="text-muted-foreground">Used:</span> {capacityPlan.usedHours}h</div>
                <div className="border rounded-md px-3 py-2 text-sm"><span className="text-muted-foreground">Remaining:</span> {capacityPlan.remainingHours}h</div>
                <div className="border rounded-md px-3 py-2 text-sm"><span className="text-muted-foreground">Selected:</span> {capacityPlan.selected.length}</div>
              </div>
              <Progress value={workingHours > 0 ? Math.min(100, (capacityPlan.usedHours / workingHours) * 100) : 0} className="h-2" />

              <div className="flex justify-end">
                <Button onClick={addCapacityPlanTasks} className="gap-1" disabled={capacityPlan.selected.length === 0}><Wand2 className="h-3.5 w-3.5" />Create filtered task list</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Ideal action pool (no resource limits) + filtered execution list</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {allActions.map((action) => {
                const selected = capacityPlan.selected.some((s) => s.id === action.id);
                return (
                  <div key={action.id} className={`border rounded p-3 ${selected ? 'border-primary/40 bg-primary/5' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{action.name}</p>
                        <p className="text-xs text-muted-foreground">{action.stage} · {action.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={selected ? 'default' : 'outline'}>{selected ? 'Selected' : 'Candidate'}</Badge>
                        <Badge variant="outline"><Timer className="h-3 w-3 mr-1" />{action.estimated_hours}h</Badge>
                        <Badge variant={action.computed_score >= 90 ? 'destructive' : action.computed_score >= 75 ? 'default' : 'secondary'}>
                          Score {action.computed_score}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {(!validation.valid || cycles.length > 0) && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">Validation report (execution blocked)</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            {validation.issues.map((issue, index) => <p key={index}>• {issue}</p>)}
            {cycles.map((cycle) => <p key={cycle}>• Circular trigger detected: {cycle}</p>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CommercialActionsRepositoryPage;
