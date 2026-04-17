import { useMemo, useState } from 'react';
import { useData } from '@/store/DataStore';
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

const CommercialActionsRepositoryPage = () => {
  const { addTask } = useData();
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

        <TabsContent value="pipeline">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {repository.lifecycle_stages.map((stageNode) => {
              const total = stageNode.actions.length;
              const avgScore = total > 0 ? stageNode.actions.reduce((acc, action) => acc + scoreAction(action), 0) / total : 0;
              return (
                <Card key={stageNode.stage}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{stageNode.stage}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">Processes: {stageNode.processes.join(', ')}</p>
                    <p className="text-sm font-medium">Actions: {total}</p>
                    <Progress value={Math.min(100, avgScore)} className="h-2" />
                    <p className="text-xs text-muted-foreground">Avg score: {Math.round(avgScore)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">KPI dashboard per action</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {allActions.slice(0, 12).map((action) => (
                <div key={action.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{action.name}</p>
                    <Badge variant="outline">{action.stage}</Badge>
                  </div>
                  {evaluateKpis(action).map((kpi) => (
                    <div key={kpi.name} className="mb-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>{kpi.name}</span>
                        <span>{kpi.current} / {kpi.target} {kpi.unit || ''}</span>
                      </div>
                      <Progress value={Math.min(100, kpi.achievement)} className="h-1.5" />
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
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
