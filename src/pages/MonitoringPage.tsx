import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import type { MonitoringTask, TaskPillar, TaskStatus, TaskPriority, TaskCategory, ActionContent, ActionResult } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Activity, CheckCircle, Clock, AlertTriangle, Plus, Trash2, Edit2, CalendarDays,
  BarChart3, Building2, Users, Wrench, Brain, Heart, Package, Target, Eye,
  Sparkles, Loader2, Zap, CheckCircle2
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { ActionContentPanel } from '@/components/ActionContentPanel';
import { supabase } from '@/integrations/supabase/client';

const PILLAR_LABELS: Record<TaskPillar, string> = {
  general: 'General', p0: '360º Analysis', p1: 'Sales Architecture', p2: 'KAM',
  p3: 'After-Sales', p4: 'AI Sales', p5: 'Behavioral', p6: 'Product Strategy',
};
const PILLAR_ICONS: Record<TaskPillar, React.ElementType> = {
  general: Activity, p0: BarChart3, p1: Building2, p2: Users,
  p3: Wrench, p4: Brain, p5: Heart, p6: Package,
};
const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'secondary', in_progress: 'default', done: 'outline',
};
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'secondary', medium: 'default', high: 'destructive', critical: 'destructive',
};
const CATEGORY_LABELS: Record<TaskCategory, string> = {
  analysis: 'Analysis', follow_up: 'Follow-up', loyalty: 'Loyalty', cross_sell: 'Cross-sell',
  strategy: 'Strategy', data: 'Data', meeting: 'Meeting', report: 'Report',
};

const emptyActionContent: ActionContent = { goal: '', callScript: '', emailTemplate: '', presentationNotes: '' };

const emptyTask = (): Partial<MonitoringTask> => ({
  title: '', description: '', pillar: 'general', status: 'todo', priority: 'medium',
  category: 'follow_up', assignee: '', dueDate: '', notes: [], actionContent: emptyActionContent,
});

const MonitoringPage = () => {
  const { t } = useLanguage();
  const { data, addTask, updateTask, deleteTask } = useData();
  const tasks = data.tasks;

  const [filterPillar, setFilterPillar] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<MonitoringTask>>(emptyTask());
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [generatingPool, setGeneratingPool] = useState(false);
  const [poolPreview, setPoolPreview] = useState<any[] | null>(null);
  const [poolSummary, setPoolSummary] = useState<any | null>(null);

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filterPillar !== 'all' && t.pillar !== filterPillar) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      return true;
    });
  }, [tasks, filterPillar, filterStatus]);

  const stats = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    todo: tasks.filter(t => t.status === 'todo').length,
    overdue: tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length,
    byPillar: Object.entries(
      tasks.reduce((acc, t) => { acc[t.pillar] = (acc[t.pillar] || 0) + 1; return acc; }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]),
  }), [tasks]);

  const completionPct = stats.total > 0 ? (stats.done / stats.total * 100) : 0;

  const dataChecks = [
    { label: 'Orders data', ok: data.orders.length > 0, count: data.orders.length },
    { label: 'Opportunities data', ok: data.opportunities.length > 0, count: data.opportunities.length },
    { label: 'Products data', ok: data.products.length > 0, count: data.products.length },
    { label: 'Strategy data', ok: data.strategy.length > 0, count: data.strategy.length },
    { label: 'Company profile', ok: !!data.companyProfile.company_name, count: data.companyProfile.company_name ? 1 : 0 },
  ];

  // ─── Action Pool Generation ───
  const generateActionPool = async () => {
    setGeneratingPool(true);
    setPoolPreview(null);
    setPoolSummary(null);
    try {
      // Fetch team members for assignment suggestions
      const companyId = data.companyProfile.id;
      let teamMembers: any[] = [];
      if (companyId) {
        const { data: contacts } = await supabase.from('company_contacts').select('*').eq('company_id', companyId);
        teamMembers = contacts || [];
      }

      const { data: result, error } = await supabase.functions.invoke('generate-action-pool', {
        body: {
          companyProfile: data.companyProfile,
          opportunities: data.opportunities,
          orders: data.orders,
          strategy: data.strategy,
          tasks: data.tasks.map(t => ({ title: t.title, status: t.status, pillar: t.pillar })),
          teamMembers,
        },
      });
      if (error) throw error;
      if (result.error) throw new Error(result.error);
      setPoolPreview(result.actions || []);
      setPoolSummary(result.summary || null);
      toast({ title: `${(result.actions || []).length} actions generated`, description: 'Review and accept the actions you want to add.' });
    } catch (e: any) {
      toast({ title: 'Error generating action pool', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingPool(false);
    }
  };

  const categoryMap: Record<string, TaskCategory> = {
    follow_up: 'follow_up', loyalty: 'loyalty', cross_sell: 'cross_sell',
    strategy: 'strategy', analysis: 'analysis', meeting: 'meeting',
    report: 'report', data: 'data',
  };

  const acceptPoolAction = (action: any) => {
    const cat = categoryMap[action.category] || 'follow_up';
    const pillar = (['general', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'].includes(action.pillar) ? action.pillar : 'general') as TaskPillar;
    const pri = (['low', 'medium', 'high', 'critical'].includes(action.priority) ? action.priority : 'medium') as TaskPriority;
    const generatedContent: ActionContent = action.actionContent ? {
      goal: action.actionContent.goal || '',
      callScript: action.actionContent.callScript || '',
      emailTemplate: action.actionContent.emailTemplate || '',
      presentationNotes: action.actionContent.presentationNotes || '',
    } : emptyActionContent;
    const newTask: MonitoringTask = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: action.title || 'Untitled Action',
      description: `${action.description || ''}\n\n📌 Rationale: ${action.rationale || ''}\n⚠️ Risk if not done: ${action.riskIfNotDone || ''}`,
      pillar,
      status: 'todo',
      priority: pri,
      category: cat,
      assignee: action.assignee || '',
      dueDate: action.dueDate || '',
      createdAt: new Date().toISOString(),
      notes: [],
      actionContent: generatedContent,
    };
    addTask(newTask);
    setPoolPreview(prev => prev ? prev.filter(a => a !== action) : null);
    toast({ title: `"${action.title}" added` });
  };

  const acceptAllPool = () => {
    if (!poolPreview) return;
    poolPreview.forEach(a => acceptPoolAction(a));
    setPoolPreview(null);
    setPoolSummary(null);
    toast({ title: 'All actions added to monitoring' });
  };

  const handleSaveTask = () => {
    if (!editingTask.title) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    if (editId) {
      updateTask(editId, editingTask);
      toast({ title: 'Task updated' });
    } else {
      const newTask: MonitoringTask = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: editingTask.title || '',
        description: editingTask.description || '',
        pillar: (editingTask.pillar || 'general') as TaskPillar,
        status: (editingTask.status || 'todo') as TaskStatus,
        priority: (editingTask.priority || 'medium') as TaskPriority,
        category: (editingTask.category || 'follow_up') as TaskCategory,
        assignee: editingTask.assignee || '',
        dueDate: editingTask.dueDate || '',
        createdAt: new Date().toISOString(),
        notes: [],
        actionContent: editingTask.actionContent || emptyActionContent,
      };
      addTask(newTask);
      toast({ title: 'Task created' });
    }
    setDialogOpen(false);
    setEditingTask(emptyTask());
    setEditId(null);
  };

  const openEdit = (task: MonitoringTask) => {
    setEditingTask({ ...task });
    setEditId(task.id);
    setDialogOpen(true);
  };

  const cycleStatus = (task: MonitoringTask) => {
    const next: Record<TaskStatus, TaskStatus> = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
    updateTask(task.id, {
      status: next[task.status],
      ...(next[task.status] === 'done' ? { completedAt: new Date().toISOString() } : { completedAt: undefined }),
    });
  };

  const handleUpdateContent = (content: ActionContent) => {
    if (selectedTaskId) {
      updateTask(selectedTaskId, { actionContent: content });
      toast({ title: 'Action content saved' });
    }
  };

  const handleSaveResult = (result: ActionResult) => {
    if (selectedTaskId) {
      updateTask(selectedTaskId, { actionResult: result });
      toast({ title: 'Result analyzed and saved' });
    }
  };

  // If a task is selected, show the content panel
  if (selectedTask) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <ActionContentPanel
          task={selectedTask}
          onUpdateContent={handleUpdateContent}
          onSaveResult={handleSaveResult}
          onBack={() => setSelectedTaskId(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">{t.nav.monitoring}</h2>
          <p className="text-muted-foreground">Track project status, actions, and pending tasks across all pillars.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={generateActionPool} disabled={generatingPool}>
            {generatingPool ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generatingPool ? 'Generating...' : 'Generate Action Pool'}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => { setEditingTask(emptyTask()); setEditId(null); }}>
                <Plus className="h-4 w-4" /> New Action
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? 'Edit Action' : 'New Action'}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-sm">Title</Label>
                <Input value={editingTask.title || ''} onChange={e => setEditingTask(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm">Description</Label>
                <VoiceTextInput rows={2} value={editingTask.description || ''} onChange={v => setEditingTask(p => ({ ...p, description: v }))} placeholder="Describe the action... (type or use voice)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Pillar</Label>
                  <Select value={editingTask.pillar} onValueChange={v => setEditingTask(p => ({ ...p, pillar: v as TaskPillar }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(PILLAR_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Priority</Label>
                  <Select value={editingTask.priority} onValueChange={v => setEditingTask(p => ({ ...p, priority: v as TaskPriority }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Category</Label>
                  <Select value={editingTask.category} onValueChange={v => setEditingTask(p => ({ ...p, category: v as TaskCategory }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Status</Label>
                  <Select value={editingTask.status} onValueChange={v => setEditingTask(p => ({ ...p, status: v as TaskStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem><SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Assignee</Label>
                  <Input value={editingTask.assignee || ''} onChange={e => setEditingTask(p => ({ ...p, assignee: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-sm">Due Date</Label>
                  <Input type="date" value={editingTask.dueDate || ''} onChange={e => setEditingTask(p => ({ ...p, dueDate: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveTask}>{editId ? 'Update' : 'Create'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs defaultValue={poolPreview && poolPreview.length > 0 ? "pool" : "overview"}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {poolPreview && poolPreview.length > 0 && (
            <TabsTrigger value="pool" className="gap-1">
              <Zap className="h-3 w-3" /> Action Pool ({poolPreview.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="tasks">Actions ({tasks.length})</TabsTrigger>
          <TabsTrigger value="data">Data Readiness</TabsTrigger>
        </TabsList>

        {/* ─── Action Pool Tab ─── */}
        {poolPreview && poolPreview.length > 0 && (
          <TabsContent value="pool" className="space-y-4">
            {/* Summary banner */}
            {poolSummary && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <span className="font-medium text-foreground text-sm">AI Action Pool Generated</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span><strong className="text-foreground">{poolSummary.totalActions}</strong> actions</span>
                      <span><strong className="text-destructive">{poolSummary.criticalCount}</strong> critical</span>
                      <span>Pipeline protected: <strong className="text-foreground">€{(poolSummary.estimatedPipelineProtected || 0).toLocaleString()}</strong></span>
                      <span>New revenue: <strong className="text-foreground">€{(poolSummary.estimatedNewRevenue || 0).toLocaleString()}</strong></span>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" onClick={acceptAllPool} className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Accept All
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setPoolPreview(null); setPoolSummary(null); }}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                  {poolSummary.coverageGaps && poolSummary.coverageGaps.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-primary/20">
                      <p className="text-xs font-medium text-foreground mb-1">⚠️ Coverage Gaps Identified:</p>
                      <div className="flex flex-wrap gap-2">
                        {poolSummary.coverageGaps.map((gap: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{gap}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action cards */}
            <div className="space-y-3">
              {poolPreview.map((action, i) => (
                <Card key={i} className={`${action.priority === 'critical' ? 'border-destructive/40' : action.priority === 'high' ? 'border-orange-300 dark:border-orange-700' : ''}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={action.priority === 'critical' || action.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {action.priority}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {PILLAR_LABELS[action.pillar as TaskPillar] || action.pillar}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {CATEGORY_LABELS[action.category as TaskCategory] || action.category}
                          </Badge>
                          {action.assignee && (
                            <span className="text-[10px] text-muted-foreground">→ {action.assignee}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground">{action.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                        {action.rationale && (
                          <p className="text-xs text-primary mt-1">📌 {action.rationale}</p>
                        )}
                        {action.riskIfNotDone && (
                          <p className="text-xs text-destructive mt-1">⚠️ {action.riskIfNotDone}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                          {action.dueDate && <span>Due: {new Date(action.dueDate).toLocaleDateString()}</span>}
                          {action.estimatedRevenue > 0 && <span>Est. revenue: €{action.estimatedRevenue.toLocaleString()}</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1 flex-shrink-0" onClick={() => acceptPoolAction(action)}>
                        <Plus className="h-3 w-3" /> Accept
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}

        {/* ─── Overview Tab ─── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Target className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold text-foreground">{stats.total}</p><p className="text-xs text-muted-foreground">Total Actions</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-success" /></div>
              <div><p className="text-2xl font-bold text-foreground">{stats.done}</p><p className="text-xs text-muted-foreground">Completed</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Clock className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold text-foreground">{stats.inProgress}</p><p className="text-xs text-muted-foreground">In Progress</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center"><CalendarDays className="h-5 w-5 text-warning" /></div>
              <div><p className="text-2xl font-bold text-foreground">{stats.todo}</p><p className="text-xs text-muted-foreground">To Do</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-2xl font-bold text-foreground">{stats.overdue}</p><p className="text-xs text-muted-foreground">Overdue</p></div>
            </CardContent></Card>
          </div>

          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Overall Completion</span>
                <span className="text-sm font-bold text-foreground">{completionPct.toFixed(0)}%</span>
              </div>
              <Progress value={completionPct} className="h-3" />
            </CardContent>
          </Card>

          {stats.byPillar.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Actions by Pillar</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.byPillar.map(([pillar, count]) => {
                    const Icon = PILLAR_ICONS[pillar as TaskPillar] || Activity;
                    const pillarTasks = tasks.filter(t => t.pillar === pillar);
                    const donePct = pillarTasks.length > 0 ? (pillarTasks.filter(t => t.status === 'done').length / pillarTasks.length * 100) : 0;
                    return (
                      <div key={pillar} className="flex items-center gap-4">
                        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground truncate">{PILLAR_LABELS[pillar as TaskPillar]}</span>
                            <span className="text-xs text-muted-foreground">{count} actions · {donePct.toFixed(0)}%</span>
                          </div>
                          <Progress value={donePct} className="h-1.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {tasks.length === 0 && (
            <Card><CardContent className="py-12 text-center">
              <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">No actions yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create actions to track commercial activities across all transformation pillars.</p>
              <Button onClick={() => { setEditingTask(emptyTask()); setEditId(null); setDialogOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Create First Action
              </Button>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* ─── Actions Tab ─── */}
        <TabsContent value="tasks">
          <div className="flex items-center gap-3 mb-4">
            <Select value={filterPillar} onValueChange={setFilterPillar}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Pillars" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pillars</SelectItem>
                {Object.entries(PILLAR_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No actions match your filters.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-xs w-8"></TableHead>
                      <TableHead className="text-xs">Action</TableHead>
                      <TableHead className="text-xs">Pillar</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs">Priority</TableHead>
                      <TableHead className="text-xs">Assignee</TableHead>
                      <TableHead className="text-xs">Due</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Prep</TableHead>
                      <TableHead className="text-xs w-24"></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filtered.map(task => {
                        const isOverdue = task.status !== 'done' && task.dueDate && new Date(task.dueDate) < new Date();
                        const ac = task.actionContent || emptyActionContent;
                        const prepFields = [ac.goal, ac.callScript, ac.emailTemplate, ac.presentationNotes];
                        const prepPct = Math.round((prepFields.filter(f => f && f.trim().length > 0).length / prepFields.length) * 100);
                        return (
                          <TableRow key={task.id} className={`${task.status === 'done' ? 'opacity-60' : ''} cursor-pointer hover:bg-muted/50`} onClick={() => setSelectedTaskId(task.id)}>
                            <TableCell onClick={e => e.stopPropagation()}>
                              <button onClick={() => cycleStatus(task)} className="hover:opacity-70">
                                {task.status === 'done' ? <CheckCircle className="h-4 w-4 text-success" /> :
                                  task.status === 'in_progress' ? <Clock className="h-4 w-4 text-primary" /> :
                                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />}
                              </button>
                            </TableCell>
                            <TableCell>
                              <p className={`text-xs font-medium text-foreground ${task.status === 'done' ? 'line-through' : ''}`}>{task.title}</p>
                              {task.description && <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{task.description}</p>}
                            </TableCell>
                            <TableCell><Badge variant="secondary" className="text-[10px]">{PILLAR_LABELS[task.pillar]}</Badge></TableCell>
                            <TableCell><span className="text-xs text-muted-foreground">{CATEGORY_LABELS[task.category]}</span></TableCell>
                            <TableCell>
                              <Badge variant={PRIORITY_COLORS[task.priority] as any} className="text-[10px]">{task.priority}</Badge>
                            </TableCell>
                            <TableCell><span className="text-xs">{task.assignee || '—'}</span></TableCell>
                            <TableCell>
                              <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={STATUS_COLORS[task.status] as any} className="text-[10px]">
                                {task.status === 'todo' ? 'To Do' : task.status === 'in_progress' ? 'In Progress' : 'Done'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Progress value={prepPct} className="h-1.5 w-12" />
                                <span className="text-[10px] text-muted-foreground">{prepPct}%</span>
                              </div>
                            </TableCell>
                            <TableCell onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedTaskId(task.id)} title="View content">
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEdit(task)}>
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => { deleteTask(task.id); toast({ title: 'Action deleted' }); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Data Readiness Tab ─── */}
        <TabsContent value="data">
          <Card>
            <CardHeader><CardTitle className="text-base">Data Readiness Check</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dataChecks.map((check) => (
                  <div key={check.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      {check.ok ? <CheckCircle className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
                      <span className="text-sm text-foreground">{check.label}</span>
                    </div>
                    <Badge variant={check.ok ? 'default' : 'secondary'} className="text-[10px]">
                      {check.ok ? `${check.count} records` : 'Missing'}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-foreground mb-1">Readiness Score</p>
                <div className="flex items-center gap-3">
                  <Progress value={dataChecks.filter(c => c.ok).length / dataChecks.length * 100} className="h-2 flex-1" />
                  <span className="text-sm font-bold text-foreground">{dataChecks.filter(c => c.ok).length}/{dataChecks.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringPage;
