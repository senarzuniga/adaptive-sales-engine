import { useState, useMemo, useCallback } from 'react';
import { useData } from '@/store/DataStore';
import type { MonitoringTask, TaskPillar, TaskPriority, TaskCategory, ActionContent } from '@/store/DataStore';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CalendarDays, Sparkles, Loader2, Brain, BarChart3, Building2, Users,
  Wrench, Heart, Package, Activity, CheckCircle, Plus, Trash2, Target
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getActivePipelineOpportunities } from '@/lib/salesData';
import { buildFallbackActionContent, buildFallbackWeeklyPlan, classifyEdgeRuntimeError } from '@/lib/edgeStability';

const PILLAR_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  p0: { label: '360º Analysis', icon: BarChart3, color: 'text-blue-500' },
  p1: { label: 'Sales Architecture', icon: Building2, color: 'text-emerald-500' },
  p2: { label: 'KAM', icon: Users, color: 'text-purple-500' },
  p3: { label: 'After-Sales', icon: Wrench, color: 'text-orange-500' },
  p4: { label: 'AI Sales', icon: Brain, color: 'text-cyan-500' },
  p5: { label: 'Behavioral', icon: Heart, color: 'text-pink-500' },
  p6: { label: 'Product Strategy', icon: Package, color: 'text-amber-500' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'secondary', medium: 'default', high: 'destructive', critical: 'destructive',
};

const CATEGORY_LABELS: Record<string, string> = {
  analysis: 'Analysis', follow_up: 'Follow-up', loyalty: 'Loyalty', cross_sell: 'Cross-sell',
  strategy: 'Strategy', data: 'Data', meeting: 'Meeting', report: 'Report',
};

interface BudgetGap {
  segment: string;
  segmentType: 'product_family' | 'region' | 'kam';
  targetRevenue: number;
  actualRevenue: number;
  gapAmount: number;
  gapPct: number;
  pipelineCoverage: number;
}

interface GeneratedTask {
  title: string;
  description: string;
  pillar: string;
  priority: string;
  category: string;
  dueDate: string;
  rationale: string;
  budgetImpactScore: number;
  targetSegment: string;
  estimatedRevenueImpact: number;
  selected: boolean;
}

const WeeklyPlannerPage = () => {
  const { data, addTask, activeCompanyId } = useData();
  const [weekNotes, setWeekNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [weekSummary, setWeekSummary] = useState('');
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);

  const computeBudgetGapAnalysis = useCallback(() => {
    if (data.strategy.length === 0) return { gaps: [] as BudgetGap[], overallAchievement: 0, totalTarget: 0, totalActual: 0, totalGap: 0, summary: '' };

    const totalTarget = data.strategy.reduce((s, st) => s + st.estRevenue, 0);
    const totalActual = data.orders.reduce((s, o) => s + o.sellingPrice, 0);
    const overallAchievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
    const totalGap = totalTarget - totalActual;
    const activeOpportunities = getActivePipelineOpportunities(data.opportunities, data.orders);

    // Gaps by product family
    const productFamilies = [...new Set(data.strategy.map(s => s.productFamily).filter(Boolean))];
    const productGaps: BudgetGap[] = productFamilies.map(pf => {
      const target = data.strategy.filter(s => s.productFamily === pf).reduce((s, st) => s + st.estRevenue, 0);
      const actual = data.orders.filter(o => o.productFamily === pf).reduce((s, o) => s + o.sellingPrice, 0);
      const pipeline = activeOpportunities.filter(o => o.productFamily === pf).reduce((s, o) => s + o.estRevenue * (o.contractProb / 100), 0);
      return { segment: pf, segmentType: 'product_family' as const, targetRevenue: target, actualRevenue: actual, gapAmount: target - actual, gapPct: target > 0 ? ((target - actual) / target) * 100 : 0, pipelineCoverage: pipeline };
    });

    // Gaps by region
    const regions = [...new Set(data.strategy.map(s => s.region).filter(Boolean))];
    const regionGaps: BudgetGap[] = regions.map(r => {
      const target = data.strategy.filter(s => s.region === r).reduce((s, st) => s + st.estRevenue, 0);
      const actual = data.orders.filter(o => o.region === r).reduce((s, o) => s + o.sellingPrice, 0);
      const pipeline = activeOpportunities.filter(o => o.region === r).reduce((s, o) => s + o.estRevenue * (o.contractProb / 100), 0);
      return { segment: r, segmentType: 'region' as const, targetRevenue: target, actualRevenue: actual, gapAmount: target - actual, gapPct: target > 0 ? ((target - actual) / target) * 100 : 0, pipelineCoverage: pipeline };
    });

    // Gaps by KAM
    const kams = [...new Set(data.strategy.map(s => s.kam).filter(Boolean))];
    const kamGaps: BudgetGap[] = kams.map(k => {
      const target = data.strategy.filter(s => s.kam === k).reduce((s, st) => s + st.estRevenue, 0);
      const actual = data.orders.filter(o => o.kam === k).reduce((s, o) => s + o.sellingPrice, 0);
      const pipeline = activeOpportunities.filter(o => o.kam === k).reduce((s, o) => s + o.estRevenue * (o.contractProb / 100), 0);
      return { segment: k, segmentType: 'kam' as const, targetRevenue: target, actualRevenue: actual, gapAmount: target - actual, gapPct: target > 0 ? ((target - actual) / target) * 100 : 0, pipelineCoverage: pipeline };
    });

    const allGaps = [...productGaps, ...regionGaps, ...kamGaps].filter(g => g.gapAmount > 0).sort((a, b) => b.gapAmount - a.gapAmount);

    const summary = `Overall: ${overallAchievement.toFixed(0)}% achieved (€${totalActual.toLocaleString()} of €${totalTarget.toLocaleString()}, gap: €${totalGap.toLocaleString()}).
TOP GAPS BY PRODUCT: ${productGaps.filter(g => g.gapAmount > 0).sort((a, b) => b.gapAmount - a.gapAmount).slice(0, 5).map(g => `${g.segment}: €${g.gapAmount.toLocaleString()} gap (${g.gapPct.toFixed(0)}%), pipeline coverage: €${g.pipelineCoverage.toLocaleString()}`).join('; ')}
TOP GAPS BY REGION: ${regionGaps.filter(g => g.gapAmount > 0).sort((a, b) => b.gapAmount - a.gapAmount).slice(0, 5).map(g => `${g.segment}: €${g.gapAmount.toLocaleString()} gap (${g.gapPct.toFixed(0)}%), pipeline coverage: €${g.pipelineCoverage.toLocaleString()}`).join('; ')}
TOP GAPS BY KAM: ${kamGaps.filter(g => g.gapAmount > 0).sort((a, b) => b.gapAmount - a.gapAmount).slice(0, 5).map(g => `${g.segment}: €${g.gapAmount.toLocaleString()} gap (${g.gapPct.toFixed(0)}%), pipeline coverage: €${g.pipelineCoverage.toLocaleString()}`).join('; ')}`;

    return { gaps: allGaps, overallAchievement, totalTarget, totalActual, totalGap, summary };
  }, [data]);

  const buildDataSummary = useCallback(() => {
    const ordersData = data.orders.length > 0
      ? (() => {
          const totalRev = data.orders.reduce((s, o) => s + o.sellingPrice, 0);
          const avgMargin = data.orders.reduce((s, o) => s + o.margin, 0) / data.orders.length;
          const custRev: Record<string, number> = {};
          data.orders.forEach(o => { custRev[o.customerName] = (custRev[o.customerName] || 0) + o.sellingPrice; });
          const topCust = Object.entries(custRev).sort((a, b) => b[1] - a[1]).slice(0, 10);
          return `Total revenue: €${totalRev.toLocaleString()}, Avg margin: ${avgMargin.toFixed(1)}%, ${data.orders.length} orders. Top customers: ${topCust.map(([n, v]) => `${n}(€${v.toLocaleString()})`).join(', ')}`;
        })()
      : null;

    const oppData = data.opportunities.length > 0
      ? (() => {
          const open = getActivePipelineOpportunities(data.opportunities, data.orders);
          const totalPipeline = open.reduce((s, o) => s + o.estRevenue, 0);
          const highProb = open.filter(o => o.contractProb >= 75);
          return `Pipeline: €${totalPipeline.toLocaleString()}, ${open.length} open opps, ${highProb.length} strong-prob (≥75%). Stages: ${open.map(o => `${o.customerName}/${o.productFamily}/${o.status}`).slice(0, 10).join('; ')}`;
        })()
      : null;

    const stratData = data.strategy.length > 0
      ? `Target revenue: €${data.strategy.reduce((s, st) => s + st.estRevenue, 0).toLocaleString()}, ${data.strategy.length} entries. By region: ${[...new Set(data.strategy.map(s => s.region))].join(', ')}`
      : null;

    const prodData = data.products.length > 0
      ? `${data.products.length} products. Types: ${[...new Set(data.products.map(p => p.type))].join(', ')}. Portfolio: ${data.products.slice(0, 10).map(p => `${p.name}(${p.type})`).join(', ')}`
      : null;

    const existingTasks = data.tasks.filter(t => t.status !== 'done').length > 0
      ? data.tasks.filter(t => t.status !== 'done').map(t => `[${t.pillar}/${t.priority}] ${t.title}`).join('; ')
      : null;

    const budgetGap = computeBudgetGapAnalysis();

    return { ordersData, opportunitiesData: oppData, strategyData: stratData, productsData: prodData, existingTasks, budgetGapAnalysis: budgetGap.summary || null };
  }, [data, computeBudgetGapAnalysis]);

  const handleGenerate = async () => {
    if (!activeCompanyId) {
      toast({ title: 'No company selected', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    try {
      const summary = buildDataSummary();
      const { data: result, error } = await supabase.functions.invoke('generate-weekly-plan', {
        body: {
          companyProfile: data.companyProfile,
          ...summary,
          weekNotes,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      setWeekSummary(result.weekSummary || '');
      setGeneratedTasks((result.tasks || []).map((t: any) => ({ ...t, selected: true })));
      toast({ title: 'Weekly plan generated', description: `${result.tasks?.length || 0} tasks across all pillars.` });
    } catch (e: any) {
      console.error('Weekly plan error:', e);
      const details = classifyEdgeRuntimeError(e, 'local weekly planning');
      const fallback = buildFallbackWeeklyPlan({
        companyProfile: data.companyProfile,
        opportunities: data.opportunities,
        orders: data.orders,
        strategy: data.strategy,
        weekNotes,
      });
      setWeekSummary(fallback.weekSummary || '');
      setGeneratedTasks((fallback.tasks || []).map((task: any) => ({ ...task, selected: true })));
      toast({ title: details.title, description: details.description });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleTask = (index: number) => {
    setGeneratedTasks(prev => prev.map((t, i) => i === index ? { ...t, selected: !t.selected } : t));
  };

  const toggleAll = (selected: boolean) => {
    setGeneratedTasks(prev => prev.map(t => ({ ...t, selected })));
  };

  const [isAddingTasks, setIsAddingTasks] = useState(false);
  const [addProgress, setAddProgress] = useState({ current: 0, total: 0 });

  const handleAddSelected = async () => {
    const selected = generatedTasks.filter(t => t.selected);
    if (selected.length === 0) {
      toast({ title: 'No tasks selected', variant: 'destructive' });
      return;
    }

    setIsAddingTasks(true);
    setAddProgress({ current: 0, total: selected.length });

    for (let i = 0; i < selected.length; i++) {
      const t = selected[i];
      setAddProgress({ current: i + 1, total: selected.length });

      // Generate action content via AI for each task
      let actionContent: ActionContent = { goal: '', callScript: '', emailTemplate: '', presentationNotes: '' };
      try {
        const { data: acResult, error: acError } = await supabase.functions.invoke('generate-action-content', {
          body: {
            type: 'generate',
            task: {
              title: t.title, description: t.description, category: t.category,
              pillar: t.pillar, priority: t.priority, assignee: '',
            },
            companyProfile: data.companyProfile,
            contextData: {
              topCustomers: data.orders.length > 0
                ? (() => {
                    const custRev: Record<string, number> = {};
                    data.orders.forEach(o => { custRev[o.customerName] = (custRev[o.customerName] || 0) + o.sellingPrice; });
                    return Object.entries(custRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v]) => `${n}(€${v.toLocaleString()})`).join(', ');
                  })()
                : null,
              topProducts: data.products.length > 0 ? data.products.slice(0, 5).map(p => `${p.name}(${p.type})`).join(', ') : null,
              pipelineValue: data.opportunities.length > 0 ? `€${data.opportunities.filter(o => isOpenOpportunityStatus(o.status)).reduce((s, o) => s + o.estRevenue, 0).toLocaleString()}` : null,
              strategyTargets: data.strategy.length > 0 ? `€${data.strategy.reduce((s, st) => s + st.estRevenue, 0).toLocaleString()} target` : null,
            },
          },
        });
        if (!acError && acResult && !acResult.error) {
          actionContent = acResult;
        }
      } catch (e) {
        console.warn(`Could not generate action content for task "${t.title}":`, e);
        actionContent = buildFallbackActionContent({
          task: { title: t.title, description: t.description, category: t.category, pillar: t.pillar, priority: t.priority },
          companyProfile: data.companyProfile,
        });
      }

      const newTask: MonitoringTask = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${i}`,
        title: t.title,
        description: `${t.description}\n\n📋 Rationale: ${t.rationale}`,
        pillar: t.pillar as TaskPillar,
        status: 'todo',
        priority: t.priority as TaskPriority,
        category: t.category as TaskCategory,
        assignee: '',
        dueDate: t.dueDate,
        createdAt: new Date().toISOString(),
        notes: [],
        actionContent,
      };
      await addTask(newTask);
    }

    setIsAddingTasks(false);
    toast({ title: `${selected.length} tasks added with AI-generated content`, description: 'Navigate to Monitoring to view scripts, emails, and presentation notes.' });
    setGeneratedTasks([]);
    setWeekSummary('');
  };

  const pillarCoverage = useMemo(() => {
    const covered = new Set(generatedTasks.filter(t => t.selected).map(t => t.pillar));
    return Object.keys(PILLAR_META).map(p => ({ pillar: p, covered: covered.has(p) }));
  }, [generatedTasks]);

  const selectedCount = generatedTasks.filter(t => t.selected).length;

  if (!activeCompanyId) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto text-center py-20">
        <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No company selected</h2>
        <p className="text-muted-foreground">Select a company from the top bar to use the Weekly Planner.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2 flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" /> Weekly Task Planner
        </h2>
        <p className="text-muted-foreground">
          AI-powered weekly action planner that analyzes your data, strategy gaps, and pillar priorities to generate a comprehensive action plan covering all 7 transformation pillars.
        </p>
      </div>

      {/* Data readiness */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-foreground">Data Available:</span>
            <Badge variant={data.orders.length > 0 ? 'default' : 'secondary'}>Orders: {data.orders.length}</Badge>
            <Badge variant={data.opportunities.length > 0 ? 'default' : 'secondary'}>Pipeline: {data.opportunities.length}</Badge>
            <Badge variant={data.strategy.length > 0 ? 'default' : 'secondary'}>Strategy: {data.strategy.length}</Badge>
            <Badge variant={data.products.length > 0 ? 'default' : 'secondary'}>Products: {data.products.length}</Badge>
            <Badge variant={data.tasks.length > 0 ? 'default' : 'secondary'}>Active Tasks: {data.tasks.filter(t => t.status !== 'done').length}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Budget Gap Dashboard */}
      {(() => {
        const gap = computeBudgetGapAnalysis();
        if (gap.totalTarget === 0) return null;
        const topProductGaps = gap.gaps.filter(g => g.segmentType === 'product_family').slice(0, 3);
        const topRegionGaps = gap.gaps.filter(g => g.segmentType === 'region').slice(0, 3);
        const topKamGaps = gap.gaps.filter(g => g.segmentType === 'kam').slice(0, 3);
        return (
          <Card className="mb-6 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Budget Achievement Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className="text-lg font-bold text-foreground">€{gap.totalTarget.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Actual</p>
                  <p className="text-lg font-bold text-foreground">€{gap.totalActual.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gap</p>
                  <p className="text-lg font-bold text-destructive">€{gap.totalGap.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Achievement</p>
                  <p className={`text-lg font-bold ${gap.overallAchievement >= 80 ? 'text-primary' : gap.overallAchievement >= 50 ? 'text-foreground' : 'text-destructive'}`}>
                    {gap.overallAchievement.toFixed(0)}%
                  </p>
                </div>
              </div>
              <Progress value={Math.min(gap.overallAchievement, 100)} className="mb-4" />
              {(topProductGaps.length > 0 || topRegionGaps.length > 0 || topKamGaps.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {topProductGaps.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Top Product Gaps</p>
                      {topProductGaps.map(g => (
                        <div key={g.segment} className="flex justify-between text-xs py-0.5">
                          <span className="text-foreground">{g.segment}</span>
                          <span className="text-destructive font-medium">-€{g.gapAmount.toLocaleString()} ({g.gapPct.toFixed(0)}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {topRegionGaps.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Top Region Gaps</p>
                      {topRegionGaps.map(g => (
                        <div key={g.segment} className="flex justify-between text-xs py-0.5">
                          <span className="text-foreground">{g.segment}</span>
                          <span className="text-destructive font-medium">-€{g.gapAmount.toLocaleString()} ({g.gapPct.toFixed(0)}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {topKamGaps.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Top KAM Gaps</p>
                      {topKamGaps.map(g => (
                        <div key={g.segment} className="flex justify-between text-xs py-0.5">
                          <span className="text-foreground">{g.segment}</span>
                          <span className="text-destructive font-medium">-€{g.gapAmount.toLocaleString()} ({g.gapPct.toFixed(0)}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Consultant notes with voice input */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> Consultant Notes & Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Add your observations, priorities, or specific focus areas for this week. You can type or use voice input. The AI will incorporate these into the plan.
          </p>
          <VoiceTextInput
            value={weekNotes}
            onChange={setWeekNotes}
            placeholder="E.g., Focus on renewing contracts with top 3 accounts. Customer X complained about delivery times. Need to prepare Q2 forecast presentation. Product Y launch happening next week..."
            rows={5}
          />
          <div className="flex justify-end mt-4">
            <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2" size="lg">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? 'Analyzing & Planning...' : 'Generate Weekly Plan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Plan */}
      {weekSummary && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Week Analysis & Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{weekSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Pillar Coverage */}
      {generatedTasks.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-foreground">Pillar Coverage:</span>
              <span className="text-xs text-muted-foreground">
                {pillarCoverage.filter(p => p.covered).length}/{pillarCoverage.length} pillars
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {pillarCoverage.map(({ pillar, covered }) => {
                const meta = PILLAR_META[pillar];
                const Icon = meta.icon;
                return (
                  <div key={pillar} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${covered ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                    {covered && <CheckCircle className="h-3 w-3" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task List */}
      {generatedTasks.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Generated Tasks ({generatedTasks.length})</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>Select All</Button>
                <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>Deselect All</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {generatedTasks.map((task, index) => {
                const meta = PILLAR_META[task.pillar] || { label: task.pillar, icon: Activity, color: 'text-muted-foreground' };
                const Icon = meta.icon;
                return (
                  <div key={index} className={`p-3 rounded-lg border ${task.selected ? 'border-primary/30 bg-primary/5' : 'border-border bg-background'} transition-colors`}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={task.selected}
                        onCheckedChange={() => toggleTask(index)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Icon className={`h-3.5 w-3.5 ${meta.color} flex-shrink-0`} />
                          <span className="text-sm font-medium text-foreground">{task.title}</span>
                          <Badge variant={PRIORITY_COLORS[task.priority] as any} className="text-[10px]">{task.priority}</Badge>
                          <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[task.category] || task.category}</Badge>
                          {task.budgetImpactScore > 0 && (
                            <Badge variant={task.budgetImpactScore >= 70 ? 'destructive' : task.budgetImpactScore >= 40 ? 'default' : 'secondary'} className="text-[10px]">
                              Impact: {task.budgetImpactScore}/100
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{task.description}</p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {task.dueDate}</span>
                          {task.targetSegment && <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {task.targetSegment}</span>}
                          {task.estimatedRevenueImpact > 0 && <span className="font-medium text-primary">€{task.estimatedRevenueImpact.toLocaleString()}</span>}
                          <span>📋 {task.rationale}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator className="my-4" />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{selectedCount} of {generatedTasks.length} tasks selected</span>
              <Button onClick={handleAddSelected} disabled={selectedCount === 0 || isAddingTasks} className="gap-2">
                {isAddingTasks ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating content {addProgress.current}/{addProgress.total}...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Add {selectedCount} Tasks with AI Content
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WeeklyPlannerPage;
