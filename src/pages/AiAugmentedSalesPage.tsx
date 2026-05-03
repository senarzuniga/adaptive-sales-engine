import { useState, useMemo } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import type { MonitoringTask, ActionContent, TaskPillar, TaskCategory, TaskPriority } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActionContentPanel } from '@/components/ActionContentPanel';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Brain, Target, TrendingUp, AlertTriangle, CheckCircle2,
  ArrowDownRight, Sparkles, Loader2,
  Users, DollarSign, BarChart3, Zap, Clock, ShieldAlert,
  Phone, Mail, FileText, ChevronDown, ChevronUp,
  Play, Check, ListChecks, Rocket, Eye
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { fmt, fmtAxis } from '@/components/analysis360/AnalysisUtils';
import { buildFallbackActionPool } from '@/lib/aiSalesFallback';
import { buildDeterministicActionPool, buildStrategyDiagnostic } from '@/lib/commercialIntelligence';
import { buildPipelineMetrics, getProbabilityGuidance, isNeglectedStatus, isOpenOpportunityStatus, isWonStatus } from '@/lib/salesData';

const fmtEur = fmt;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

/* ───────── Lead Score helpers ───────── */
interface ScoredLead {
  name: string; revenue: number; probability: number; margin: number;
  score: number; tier: 'A' | 'B' | 'C' | 'D'; signals: string[];
  status: string; kam: string; product: string; region: string;
}

function scoreLead(o: any, strategyFamilies: Set<string>, strategyRegions: Set<string>): ScoredLead {
  let score = 0;
  const signals: string[] = [];
  if (o.estRevenue >= 500000) { score += 25; signals.push('High-value deal'); }
  else if (o.estRevenue >= 100000) { score += 15; signals.push('Mid-value deal'); }
  else { score += 5; }
  score += Math.round(o.contractProb * 0.25);
  if (o.contractProb >= 75) signals.push('High close probability');
  else signals.push('Weak probability needs improvement');
  if (o.margin >= 30) { score += 20; signals.push('Strong margin'); }
  else if (o.margin >= 20) { score += 12; }
  else if (o.margin >= 10) { score += 6; }
  else { signals.push('Low margin risk'); }
  if (strategyFamilies.has(o.productFamily)) { score += 10; signals.push('Strategic product'); }
  if (strategyRegions.has(o.region)) { score += 5; signals.push('Strategic region'); }
  const st = (o.status || '').toUpperCase();
  if (isWonStatus(o.status)) { score += 15; signals.push('Won'); }
  else if (st.includes('NEGOCIACION') || st.includes('NEGOTIATION')) { score += 10; signals.push('In negotiation'); }
  else if (st.includes('OFERTA') || st.includes('OFFER')) { score += 7; signals.push('Offer sent'); }
  else if (isNeglectedStatus(o.status)) { score -= 10; signals.push('⚠ Neglected'); }
  const tier = score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D';
  return {
    name: o.customerName || 'Unknown', revenue: o.estRevenue, probability: o.contractProb,
    margin: o.margin, score: Math.max(0, Math.min(100, score)), tier, signals,
    status: o.status || '', kam: o.kam || '', product: o.productFamily || '', region: o.region || '',
  };
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_COLORS: Record<string, string> = { critical: 'destructive', high: 'destructive', medium: 'default', low: 'secondary' };
const CATEGORY_LABELS: Record<string, string> = {
  follow_up: 'Follow-up', loyalty: 'Loyalty', cross_sell: 'Cross-sell',
  strategy: 'Strategy', analysis: 'Analysis', meeting: 'Meeting', report: 'Report', data: 'Data',
};
const CATEGORY_ICONS: Record<string, string> = {
  follow_up: '📞', loyalty: '❤️', cross_sell: '🔄', strategy: '🎯',
  analysis: '📊', meeting: '🤝', report: '📋', data: '📁',
};

/* ───────── Component ───────── */
const AiAugmentedSalesPage = () => {
  const { t } = useLanguage();
  const { data, addTask, updateTask } = useData();
  const { opportunities, orders, strategy, tasks, companyProfile } = data;

  const [generatingPool, setGeneratingPool] = useState(false);
  const [poolPreview, setPoolPreview] = useState<any[] | null>(null);
  const [poolSummary, setPoolSummary] = useState<any | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('actions');

  const hasData = opportunities.length > 0 || orders.length > 0;

  const strategyFamilies = useMemo(() => new Set(strategy.map(s => s.productFamily).filter(Boolean) as string[]), [strategy]);
  const strategyRegions = useMemo(() => new Set(strategy.map(s => s.region).filter(Boolean) as string[]), [strategy]);

  const scoredLeads = useMemo(() =>
    opportunities.map(o => scoreLead(o, strategyFamilies, strategyRegions)).sort((a, b) => b.score - a.score),
    [opportunities, strategyFamilies, strategyRegions]
  );

  const forecast = useMemo(() => {
    const open = opportunities.filter((opportunity) => isOpenOpportunityStatus(opportunity.status));
    const pipelineMetrics = buildPipelineMetrics({ opportunities, orders });
    const totalPipeline = pipelineMetrics.openPipeline;
    const weightedPipeline = pipelineMetrics.weightedOpenRevenue;
    const wonRevenue = pipelineMetrics.soldRevenue;
    const strategyDiagnostic = buildStrategyDiagnostic({ company: companyProfile, orders, opportunities, strategy });
    const strategyTarget = strategyDiagnostic.targetRevenue;
    const achievement = strategyDiagnostic.currentAchievementPct;
    const coverage = strategyDiagnostic.pipelineCoveragePct;
    const neglectedDeals = opportunities.filter((opportunity) => isNeglectedStatus(opportunity.status)).length;
    return { totalPipeline, weightedPipeline, wonRevenue, strategyTarget, achievement, coverage, neglectedDeals, open };
  }, [companyProfile, opportunities, orders, strategy]);

  // Active actions from tasks
  const activeActions = useMemo(() =>
    [...tasks]
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
      .filter(t => t.status !== 'done'),
    [tasks]
  );
  const completedActions = useMemo(() => tasks.filter(t => t.status === 'done'), [tasks]);

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

  const tierDistribution = useMemo(() => {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    scoredLeads.forEach(l => counts[l.tier]++);
    return [
      { name: 'Tier A', value: counts.A, fill: 'hsl(var(--chart-1))' },
      { name: 'Tier B', value: counts.B, fill: 'hsl(var(--chart-2))' },
      { name: 'Tier C', value: counts.C, fill: 'hsl(var(--chart-3))' },
      { name: 'Tier D', value: counts.D, fill: 'hsl(var(--chart-4))' },
    ].filter(d => d.value > 0);
  }, [scoredLeads]);

  const topWeightedLeads = useMemo(() =>
    scoredLeads.map(l => ({ ...l, weighted: l.revenue * (l.probability / 100) }))
      .sort((a, b) => b.weighted - a.weighted).slice(0, 10),
    [scoredLeads]
  );

  // ─── Generate Action Pool ───
  const generateActionPool = async () => {
    setGeneratingPool(true);
    setPoolPreview(null);
    try {
      const teamMembers = data.orders
        .map(o => o.kam).filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .map(name => ({ name, role: 'KAM', department: 'Sales' }));

      const deterministic = buildDeterministicActionPool({ company: companyProfile, opportunities, orders, strategy, products: data.products });

      const { data: result, error } = await supabase.functions.invoke('generate-action-pool', {
        body: {
          companyProfile, opportunities, orders, strategy, tasks,
          teamMembers,
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const mergedActions = [...(result.actions || []), ...(deterministic.actions || [])]
        .filter((action, index, array) => array.findIndex((candidate) => candidate.title === action.title) === index)
        .slice(0, 25);

      setPoolPreview(mergedActions);
      setPoolSummary(result.summary || deterministic.summary || null);
      setActiveTab('pool');
      toast({ title: '✅ Action Pool Generated', description: `${mergedActions.length || 0} actions ready for review` });
    } catch (e: any) {
      console.error('generateActionPool fallback:', e);
      const deterministic = buildDeterministicActionPool({ company: companyProfile, opportunities, orders, strategy, products: data.products });
      const fallback = buildFallbackActionPool({ companyProfile, opportunities, orders, strategy, tasks });
      const mergedActions = [...(deterministic.actions || []), ...(fallback.actions || [])]
        .filter((action, index, array) => array.findIndex((candidate) => candidate.title === action.title) === index)
        .slice(0, 25);
      setPoolPreview(mergedActions);
      setPoolSummary(deterministic.summary || fallback.summary || null);
      setActiveTab('pool');
      toast({ title: 'Action Pool Ready', description: 'Deterministic commercial intelligence generated prioritized actions while the edge service was unavailable.' });
    } finally {
      setGeneratingPool(false);
    }
  };

  const acceptPoolAction = async (action: any) => {
    const ac: ActionContent = action.actionContent ? {
      goal: action.actionContent.goal || '',
      callScript: action.actionContent.callScript || '',
      emailTemplate: action.actionContent.emailTemplate || '',
      presentationNotes: action.actionContent.presentationNotes || '',
    } : { goal: '', callScript: '', emailTemplate: '', presentationNotes: '' };

    await addTask({
      id: crypto.randomUUID(),
      title: action.title,
      description: action.description || '',
      pillar: (['general','p0','p1','p2','p3','p4','p5','p6'].includes(action.pillar) ? action.pillar : 'p4') as TaskPillar,
      status: 'todo',
      priority: (['critical','high','medium','low'].includes(action.priority) ? action.priority : 'medium') as TaskPriority,
      category: (['analysis','follow_up','loyalty','cross_sell','strategy','data','meeting','report'].includes(action.category) ? action.category : 'follow_up') as TaskCategory,
      assignee: action.assignee || '',
      dueDate: action.dueDate || '',
      createdAt: new Date().toISOString(),
      notes: action.rationale ? [action.rationale] : [],
      actionContent: ac,
    });
    setPoolPreview(prev => prev ? prev.filter(a => a.title !== action.title) : null);
    toast({ title: '✅ Action accepted', description: action.title });
  };

  const acceptAllPool = async () => {
    if (!poolPreview) return;
    for (const action of poolPreview) {
      await acceptPoolAction(action);
    }
    setPoolPreview(null);
    setPoolSummary(null);
    toast({ title: '✅ All actions accepted' });
  };

  const startAction = async (task: MonitoringTask) => {
    await updateTask(task.id, { status: 'in_progress' });
    setSelectedTaskId(task.id);
  };

  const completeAction = async (task: MonitoringTask) => {
    await updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() });
  };

  const tierColor = (tier: string) => {
    switch (tier) {
      case 'A': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'B': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'C': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
  };

  if (!hasData) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <Badge variant="outline" className="mb-2">{t.dashboard.pillar} 4</Badge>
          <h2 className="text-2xl font-semibold text-foreground">{t.nav.aiSales}</h2>
          <p className="text-muted-foreground">AI-powered commercial action engine</p>
        </div>
        <Card><CardContent className="py-16 text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Data Available</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">Upload pipeline opportunities and orders to activate the AI commercial engine.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Badge variant="outline" className="mb-2">{t.dashboard.pillar} 4</Badge>
          <h2 className="text-2xl font-semibold text-foreground">{t.nav.aiSales}</h2>
          <p className="text-muted-foreground text-sm">Your AI-powered commercial action engine — prioritized actions with full supportive content</p>
        </div>
        <Button onClick={generateActionPool} disabled={generatingPool} size="lg" className="gap-2">
          {generatingPool ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Generate Action Pool
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Active Actions</span>
            </div>
            <p className="text-xl font-bold text-foreground">{activeActions.length}</p>
            <p className="text-xs text-muted-foreground">{tasks.filter(t => t.priority === 'critical' || t.priority === 'high').length} high priority</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Weighted Pipeline</span>
            </div>
            <p className="text-xl font-bold text-foreground">{fmtEur(forecast.weightedPipeline)}</p>
            <p className="text-xs text-muted-foreground">of {fmtEur(forecast.totalPipeline)} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Strategy Achievement</span>
            </div>
            <p className={`text-xl font-bold ${forecast.achievement >= 80 ? 'text-green-600' : forecast.achievement >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {forecast.achievement.toFixed(0)}%
            </p>
            <Progress value={Math.min(100, forecast.achievement)} className="h-1.5 mt-1" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Completed</span>
            </div>
            <p className="text-xl font-bold text-foreground">{completedActions.length}</p>
            <p className="text-xs text-muted-foreground">{tasks.length > 0 ? ((completedActions.length / tasks.length) * 100).toFixed(0) : 0}% done</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">At Risk</span>
            </div>
            <p className={`text-xl font-bold ${forecast.neglectedDeals > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {forecast.neglectedDeals}
            </p>
            <p className="text-xs text-muted-foreground">neglected deals</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Action list + tabs */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="actions" className="gap-1"><Zap className="h-3.5 w-3.5" /> Action Pool ({activeActions.length})</TabsTrigger>
              <TabsTrigger value="pool" className="gap-1" disabled={!poolPreview}>
                <Sparkles className="h-3.5 w-3.5" /> AI Suggestions {poolPreview ? `(${poolPreview.length})` : ''}
              </TabsTrigger>
              <TabsTrigger value="scoring" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Lead Scoring</TabsTrigger>
              <TabsTrigger value="forecast" className="gap-1"><TrendingUp className="h-3.5 w-3.5" /> Forecast</TabsTrigger>
            </TabsList>

            {/* ─── ACTION POOL TAB ─── */}
            <TabsContent value="actions" className="space-y-3">
              {activeActions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Rocket className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold text-foreground mb-1">No Active Actions</h3>
                    <p className="text-sm text-muted-foreground mb-4">Generate your first action pool to get AI-prioritized commercial actions with full supportive content.</p>
                    <Button onClick={generateActionPool} disabled={generatingPool} className="gap-2">
                      {generatingPool ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Generate Action Pool
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                activeActions.map(task => {
                  const isExpanded = expandedAction === task.id;
                  const hasContent = task.actionContent && (task.actionContent.goal || task.actionContent.callScript || task.actionContent.emailTemplate);
                  return (
                    <Card key={task.id} className={`transition-all ${task.status === 'in_progress' ? 'border-primary/50 bg-primary/5' : ''} ${task.priority === 'critical' ? 'border-destructive/30' : ''}`}>
                      <CardContent className="py-3 px-4">
                        {/* Action header */}
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge variant={PRIORITY_COLORS[task.priority] as any} className="text-[10px]">
                                {task.priority}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {CATEGORY_ICONS[task.category] || '📌'} {CATEGORY_LABELS[task.category] || task.category}
                              </Badge>
                              {task.assignee && (
                                <Badge variant="outline" className="text-[10px]">
                                  <Users className="h-3 w-3 mr-1" />{task.assignee}
                                </Badge>
                              )}
                              {task.dueDate && (
                                <span className={`text-[10px] ${new Date(task.dueDate) < new Date() ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                  📅 {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <h4 className="font-medium text-sm text-foreground">{task.title}</h4>
                            {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}

                            {/* Content indicators */}
                            {hasContent && (
                              <div className="flex gap-2 mt-2">
                                {task.actionContent.goal && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Target className="h-3 w-3" /> Goal</span>}
                                {task.actionContent.callScript && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone className="h-3 w-3" /> Script</span>}
                                {task.actionContent.emailTemplate && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Mail className="h-3 w-3" /> Email</span>}
                                {task.actionContent.presentationNotes && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><FileText className="h-3 w-3" /> Notes</span>}
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {task.status === 'todo' && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => startAction(task)}>
                                <Play className="h-3 w-3" /> Start
                              </Button>
                            )}
                            {task.status === 'in_progress' && (
                              <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => completeAction(task)}>
                                <Check className="h-3 w-3" /> Done
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                              setExpandedAction(isExpanded ? null : task.id);
                              setSelectedTaskId(task.id);
                            }}>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        {/* Expanded: show supportive content inline */}
                        {isExpanded && hasContent && (
                          <div className="mt-4 pt-3 border-t space-y-3">
                            {task.actionContent.goal && (
                              <div>
                                <p className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1"><Target className="h-3.5 w-3.5 text-primary" /> Goal & Success Criteria</p>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-2">{task.actionContent.goal}</p>
                              </div>
                            )}
                            {task.actionContent.callScript && (
                              <div>
                                <p className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1"><Phone className="h-3.5 w-3.5 text-primary" /> Call / Meeting Script</p>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-48 overflow-y-auto">{task.actionContent.callScript}</p>
                              </div>
                            )}
                            {task.actionContent.emailTemplate && (
                              <div>
                                <p className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1"><Mail className="h-3.5 w-3.5 text-primary" /> Email Template</p>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-48 overflow-y-auto">{task.actionContent.emailTemplate}</p>
                              </div>
                            )}
                            {task.actionContent.presentationNotes && (
                              <div>
                                <p className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1"><FileText className="h-3.5 w-3.5 text-primary" /> Presentation Notes & Key Data</p>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-48 overflow-y-auto">{task.actionContent.presentationNotes}</p>
                              </div>
                            )}
                            {task.notes && task.notes.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-foreground mb-1">📝 Rationale</p>
                                {task.notes.map((n, i) => <p key={i} className="text-xs text-muted-foreground">{n}</p>)}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}

              {/* Completed actions summary */}
              {completedActions.length > 0 && (
                <Card className="border-green-200 dark:border-green-800/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> Completed Actions ({completedActions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {completedActions.slice(0, 5).map(t => (
                        <div key={t.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className="h-3 w-3 text-green-600" />
                          <span className="line-through">{t.title}</span>
                        </div>
                      ))}
                      {completedActions.length > 5 && <p className="text-xs text-muted-foreground">...and {completedActions.length - 5} more</p>}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ─── AI SUGGESTIONS TAB ─── */}
            <TabsContent value="pool" className="space-y-3">
              {poolSummary && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-4 text-sm">
                        <span><strong>{poolSummary.totalActions}</strong> actions</span>
                        <span className="text-destructive"><strong>{poolSummary.criticalCount}</strong> critical</span>
                        <span>Pipeline protected: <strong>{fmtEur(poolSummary.estimatedPipelineProtected || 0)}</strong></span>
                        <span>New revenue: <strong>{fmtEur(poolSummary.estimatedNewRevenue || 0)}</strong></span>
                      </div>
                      <Button size="sm" onClick={acceptAllPool} className="gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Accept All
                      </Button>
                    </div>
                    {poolSummary.coverageGaps?.length > 0 && (
                      <div className="mt-2 flex gap-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">Gaps:</span>
                        {poolSummary.coverageGaps.map((g: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{g}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {poolPreview?.map((action, idx) => (
                <Card key={idx} className="border-dashed">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant={PRIORITY_COLORS[action.priority] as any} className="text-[10px]">{action.priority}</Badge>
                          <Badge variant="outline" className="text-[10px]">{CATEGORY_ICONS[action.category] || '📌'} {CATEGORY_LABELS[action.category] || action.category}</Badge>
                          {action.assignee && <Badge variant="outline" className="text-[10px]"><Users className="h-3 w-3 mr-1" />{action.assignee}</Badge>}
                          {action.estimatedRevenue > 0 && <span className="text-[10px] text-green-600 font-medium">{fmtEur(action.estimatedRevenue)}</span>}
                        </div>
                        <h4 className="font-medium text-sm text-foreground">{action.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                        {action.rationale && <p className="text-xs text-primary/80 mt-1 italic">💡 {action.rationale}</p>}
                        {action.riskIfNotDone && <p className="text-xs text-destructive/80 mt-1">⚠️ {action.riskIfNotDone}</p>}

                        {/* Content preview */}
                        <div className="flex gap-2 mt-2">
                          {action.actionContent?.goal && <span className="text-[10px] text-green-600 flex items-center gap-0.5"><Target className="h-3 w-3" /> Goal</span>}
                          {action.actionContent?.callScript && <span className="text-[10px] text-blue-600 flex items-center gap-0.5"><Phone className="h-3 w-3" /> Script</span>}
                          {action.actionContent?.emailTemplate && <span className="text-[10px] text-purple-600 flex items-center gap-0.5"><Mail className="h-3 w-3" /> Email</span>}
                          {action.actionContent?.presentationNotes && <span className="text-[10px] text-orange-600 flex items-center gap-0.5"><FileText className="h-3 w-3" /> Notes</span>}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => acceptPoolAction(action)} className="gap-1 flex-shrink-0">
                        <Check className="h-3.5 w-3.5" /> Accept
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* ─── LEAD SCORING TAB ─── */}
            <TabsContent value="scoring" className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Lead Tier Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={tierDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                          {tierDistribution.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card className="md:col-span-2">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Top 10 Opportunities (Weighted Value)</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={topWeightedLeads} layout="vertical">
                        <XAxis type="number" tickFormatter={fmtAxis} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => fmtEur(v)} />
                        <Bar dataKey="weighted" name="Weighted Revenue" radius={[0, 4, 4, 0]}>
                          {topWeightedLeads.map((l, i) => (
                            <Cell key={i} fill={l.tier === 'A' ? 'hsl(var(--chart-1))' : l.tier === 'B' ? 'hsl(var(--chart-2))' : l.tier === 'C' ? 'hsl(var(--chart-3))' : 'hsl(var(--chart-4))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">All Scored Leads ({scoredLeads.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2 pr-3 font-medium text-muted-foreground">Score</th>
                          <th className="py-2 pr-3 font-medium text-muted-foreground">Tier</th>
                          <th className="py-2 pr-3 font-medium text-muted-foreground">Customer</th>
                          <th className="py-2 pr-3 font-medium text-muted-foreground">Product</th>
                          <th className="py-2 pr-3 font-medium text-muted-foreground text-right">Revenue</th>
                          <th className="py-2 pr-3 font-medium text-muted-foreground text-right">Prob%</th>
                          <th className="py-2 pr-3 font-medium text-muted-foreground text-right">Margin%</th>
                          <th className="py-2 pr-3 font-medium text-muted-foreground">KAM</th>
                          <th className="py-2 font-medium text-muted-foreground">Signals</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoredLeads.slice(0, 25).map((l, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <Progress value={l.score} className="h-1.5 w-12" />
                                <span className="font-mono text-xs">{l.score}</span>
                              </div>
                            </td>
                            <td className="py-2 pr-3"><span className={`text-xs font-bold px-2 py-0.5 rounded ${tierColor(l.tier)}`}>{l.tier}</span></td>
                            <td className="py-2 pr-3 font-medium text-foreground">{l.name}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{l.product}</td>
                            <td className="py-2 pr-3 text-right font-mono">{fmtEur(l.revenue)}</td>
                            <td className="py-2 pr-3 text-right">{l.probability}%</td>
                            <td className="py-2 pr-3 text-right">{fmtPct(l.margin)}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{l.kam}</td>
                            <td className="py-2">
                              <div className="flex flex-wrap gap-1">
                                {l.signals.slice(0, 3).map((s, j) => (
                                  <Badge key={j} variant="outline" className="text-[10px] py-0">{s}</Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── FORECAST TAB ─── */}
            <TabsContent value="forecast" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Forecast Summary</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Won Revenue</span><span className="font-bold text-foreground">{fmtEur(forecast.wonRevenue)}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Weighted Pipeline</span><span className="font-bold text-foreground">{fmtEur(forecast.weightedPipeline)}</span></div>
                    <div className="border-t pt-2 flex justify-between"><span className="text-sm font-medium text-foreground">Forecast Total</span><span className="text-lg font-bold text-primary">{fmtEur(forecast.wonRevenue + forecast.weightedPipeline)}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Strategy Target</span><span className="font-bold text-foreground">{fmtEur(forecast.strategyTarget)}</span></div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Gap to Target</span>
                      <span className={`font-bold ${forecast.strategyTarget - forecast.wonRevenue - forecast.weightedPipeline > 0 ? 'text-destructive' : 'text-green-600'}`}>
                        {fmtEur(Math.abs(forecast.strategyTarget - forecast.wonRevenue - forecast.weightedPipeline))}
                        {forecast.strategyTarget - forecast.wonRevenue - forecast.weightedPipeline > 0 ? ' short' : ' surplus'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue by Lead Tier</CardTitle></CardHeader>
                  <CardContent>
                    {(['A', 'B', 'C', 'D'] as const).map(tier => {
                      const leads = scoredLeads.filter(l => l.tier === tier);
                      const rev = leads.reduce((s, l) => s + l.revenue, 0);
                      const weighted = leads.reduce((s, l) => s + l.revenue * (l.probability / 100), 0);
                      return (
                        <div key={tier} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${tierColor(tier)}`}>{tier}</span>
                          <div className="flex-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{leads.length} deals</span>
                              <span className="text-foreground font-medium">{fmtEur(weighted)} weighted</span>
                            </div>
                            <Progress value={forecast.totalPipeline > 0 ? (rev / forecast.totalPipeline) * 100 : 0} className="h-1 mt-1" />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {(forecast.neglectedDeals > 0 || forecast.achievement < 60) && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Pipeline Risk Alerts</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {forecast.neglectedDeals > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <ArrowDownRight className="h-4 w-4 text-destructive mt-0.5" />
                        <p className="text-foreground"><strong>{forecast.neglectedDeals} neglected deals</strong> — lost revenue if not re-engaged immediately.</p>
                      </div>
                    )}
                    {forecast.achievement < 60 && (
                      <div className="flex items-start gap-2 text-sm">
                        <ArrowDownRight className="h-4 w-4 text-destructive mt-0.5" />
                        <p className="text-foreground"><strong>Strategy at {forecast.achievement.toFixed(0)}%</strong> — significant gap requires pipeline acceleration.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Action Content Panel */}
        <div className="lg:col-span-1">
          {selectedTask ? (
            <div className="sticky top-6">
              <ActionContentPanel
                task={selectedTask}
                onUpdateContent={(content) => updateTask(selectedTask.id, { actionContent: content })}
                onSaveResult={(result) => updateTask(selectedTask.id, { actionResult: result })}
                onBack={() => setSelectedTaskId(null)}
              />
            </div>
          ) : (
            <Card className="sticky top-6">
              <CardContent className="py-12 text-center">
                <Eye className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">Action Detail Panel</p>
                <p className="text-xs text-muted-foreground">Expand any action to see its full supportive content: goals, call scripts, email templates, and presentation notes.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiAugmentedSalesPage;
