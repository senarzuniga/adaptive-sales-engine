import { useState, useMemo } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Brain, Target, TrendingUp, AlertTriangle, CheckCircle2,
  ArrowUpRight, ArrowDownRight, Minus, Sparkles, Loader2,
  Users, DollarSign, BarChart3, Zap, Clock, ShieldAlert
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { fmtEur, fmtPct, fmtAxis } from '@/components/analysis360/AnalysisUtils';

/* ───────── Lead Score helpers ───────── */
interface ScoredLead {
  name: string;
  revenue: number;
  probability: number;
  margin: number;
  score: number;
  tier: 'A' | 'B' | 'C' | 'D';
  signals: string[];
  status: string;
  kam: string;
  product: string;
  region: string;
}

function scoreLead(o: any, strategyFamilies: Set<string>, strategyRegions: Set<string>): ScoredLead {
  let score = 0;
  const signals: string[] = [];

  // Revenue weight (0-25)
  if (o.estRevenue >= 500000) { score += 25; signals.push('High-value deal'); }
  else if (o.estRevenue >= 100000) { score += 15; signals.push('Mid-value deal'); }
  else { score += 5; }

  // Probability weight (0-25)
  score += Math.round(o.contractProb * 0.25);
  if (o.contractProb >= 70) signals.push('High close probability');

  // Margin weight (0-20)
  if (o.margin >= 30) { score += 20; signals.push('Strong margin'); }
  else if (o.margin >= 20) { score += 12; }
  else if (o.margin >= 10) { score += 6; }
  else { signals.push('Low margin risk'); }

  // Strategic alignment (0-15)
  if (strategyFamilies.has(o.productFamily)) { score += 10; signals.push('Strategic product'); }
  if (strategyRegions.has(o.region)) { score += 5; signals.push('Strategic region'); }

  // Status bonus (0-15)
  const st = (o.status || '').toUpperCase();
  if (st.includes('GANADO') || st.includes('WON')) { score += 15; signals.push('Won'); }
  else if (st.includes('NEGOCIACION') || st.includes('NEGOTIATION')) { score += 10; signals.push('In negotiation'); }
  else if (st.includes('OFERTA') || st.includes('OFFER')) { score += 7; signals.push('Offer sent'); }
  else if (st.includes('DESATENDIDO') || st.includes('NEGLECTED')) { score -= 10; signals.push('⚠ Neglected'); }

  const tier = score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D';

  return {
    name: o.customerName || 'Unknown',
    revenue: o.estRevenue,
    probability: o.contractProb,
    margin: o.margin,
    score: Math.max(0, Math.min(100, score)),
    tier,
    signals,
    status: o.status || '',
    kam: o.kam || '',
    product: o.productFamily || '',
    region: o.region || '',
  };
}

/* ───────── Component ───────── */
const AiAugmentedSalesPage = () => {
  const { t } = useLanguage();
  const { state } = useData();
  const { opportunities, orders, strategy, tasks, companyProfile } = state;
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  const hasData = opportunities.length > 0 || orders.length > 0;

  // Strategy sets for alignment scoring
  const strategyFamilies = useMemo(() => new Set(strategy.map(s => s.productFamily).filter(Boolean)), [strategy]);
  const strategyRegions = useMemo(() => new Set(strategy.map(s => s.region).filter(Boolean)), [strategy]);

  // Score all opportunities
  const scoredLeads = useMemo(() =>
    opportunities.map(o => scoreLead(o, strategyFamilies, strategyRegions))
      .sort((a, b) => b.score - a.score),
    [opportunities, strategyFamilies, strategyRegions]
  );

  // Pipeline forecasting
  const forecast = useMemo(() => {
    const totalPipeline = opportunities.reduce((s, o) => s + o.estRevenue, 0);
    const weightedPipeline = opportunities.reduce((s, o) => s + o.estRevenue * (o.contractProb / 100), 0);
    const wonRevenue = orders.reduce((s, o) => s + o.sellingPrice, 0);
    const strategyTarget = strategy.reduce((s, r) => s + r.estRevenue, 0);
    const achievement = strategyTarget > 0 ? ((wonRevenue + weightedPipeline) / strategyTarget) * 100 : 0;
    const avgMargin = opportunities.length > 0
      ? opportunities.reduce((s, o) => s + o.margin, 0) / opportunities.length : 0;
    const highProbDeals = opportunities.filter(o => o.contractProb >= 60).length;
    const neglectedDeals = opportunities.filter(o =>
      (o.status || '').toUpperCase().includes('DESATENDIDO') || (o.status || '').toUpperCase().includes('NEGLECTED')
    ).length;

    return { totalPipeline, weightedPipeline, wonRevenue, strategyTarget, achievement, avgMargin, highProbDeals, neglectedDeals };
  }, [opportunities, orders, strategy]);

  // Activity effectiveness
  const taskMetrics = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const overdue = tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length;
    const highPriority = tasks.filter(t => t.priority === 'high' || t.priority === 'critical').length;
    const byPillar = tasks.reduce((acc, t) => {
      acc[t.pillar] = (acc[t.pillar] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { total, done, overdue, highPriority, completionRate: total > 0 ? (done / total) * 100 : 0, byPillar };
  }, [tasks]);

  // Tier distribution for chart
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

  // Top leads by weighted value
  const topWeightedLeads = useMemo(() =>
    scoredLeads
      .map(l => ({ ...l, weighted: l.revenue * (l.probability / 100) }))
      .sort((a, b) => b.weighted - a.weighted)
      .slice(0, 10),
    [scoredLeads]
  );

  // AI insight generation
  const generateInsight = async () => {
    setLoadingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-action-content', {
        body: {
          type: 'generate',
          task: {
            title: 'AI Sales Intelligence Briefing',
            description: `Generate a strategic sales intelligence briefing analyzing: ${scoredLeads.length} opportunities scored, ${forecast.neglectedDeals} neglected deals, pipeline weighted value ${fmtEur(forecast.weightedPipeline)}, strategy achievement ${forecast.achievement.toFixed(0)}%, task completion rate ${taskMetrics.completionRate.toFixed(0)}%`,
            category: 'analysis',
            pillar: 'p4',
            priority: 'high',
            assignee: '',
          },
          companyProfile,
          contextData: {
            topCustomers: scoredLeads.slice(0, 5).map(l => `${l.name}: Score ${l.score}, ${fmtEur(l.revenue)}`).join('; '),
            pipelineValue: fmtEur(forecast.weightedPipeline),
            strategyTargets: fmtEur(forecast.strategyTarget),
          },
        },
      });
      if (error) throw error;
      setAiInsight(data.goal || 'No insight generated');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingAi(false);
    }
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
          <p className="text-muted-foreground">AI-powered lead scoring, pipeline forecasting & activity prioritization</p>
        </div>
        <Card><CardContent className="py-16 text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Data Available</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">Upload pipeline opportunities and orders to activate AI-augmented sales intelligence.</p>
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
          <p className="text-muted-foreground text-sm">Lead scoring, pipeline forecasting & activity prioritization</p>
        </div>
        <Button onClick={generateInsight} disabled={loadingAi} className="gap-2">
          {loadingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AI Intelligence Briefing
        </Button>
      </div>

      {/* AI Insight banner */}
      {aiInsight && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground text-sm mb-1">AI Strategic Insight</p>
                <p className="text-muted-foreground text-sm">{aiInsight}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">High-Prob Deals</span>
            </div>
            <p className="text-xl font-bold text-foreground">{forecast.highProbDeals}</p>
            <p className="text-xs text-muted-foreground">≥60% probability</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Neglected</span>
            </div>
            <p className={`text-xl font-bold ${forecast.neglectedDeals > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {forecast.neglectedDeals}
            </p>
            <p className="text-xs text-muted-foreground">deals at risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scoring" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scoring">Lead Scoring</TabsTrigger>
          <TabsTrigger value="forecast">Pipeline Forecast</TabsTrigger>
          <TabsTrigger value="activity">Activity Prioritization</TabsTrigger>
        </TabsList>

        {/* Lead Scoring Tab */}
        <TabsContent value="scoring" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Tier Distribution */}
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

            {/* Top 10 by Weighted Value */}
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

          {/* Full scored list */}
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
                        <td className="py-2 pr-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${tierColor(l.tier)}`}>{l.tier}</span>
                        </td>
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

        {/* Pipeline Forecast Tab */}
        <TabsContent value="forecast" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Forecast Summary */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Forecast Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Won Revenue (Booked)</span>
                    <span className="font-bold text-foreground">{fmtEur(forecast.wonRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Weighted Pipeline</span>
                    <span className="font-bold text-foreground">{fmtEur(forecast.weightedPipeline)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">Forecast Total</span>
                    <span className="text-lg font-bold text-primary">{fmtEur(forecast.wonRevenue + forecast.weightedPipeline)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Strategy Target</span>
                    <span className="font-bold text-foreground">{fmtEur(forecast.strategyTarget)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Gap to Target</span>
                    <span className={`font-bold ${forecast.strategyTarget - forecast.wonRevenue - forecast.weightedPipeline > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {fmtEur(Math.abs(forecast.strategyTarget - forecast.wonRevenue - forecast.weightedPipeline))}
                      {forecast.strategyTarget - forecast.wonRevenue - forecast.weightedPipeline > 0 ? ' short' : ' surplus'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tier Contribution */}
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

          {/* Risk alerts */}
          {(forecast.neglectedDeals > 0 || forecast.achievement < 60) && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Pipeline Risk Alerts</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {forecast.neglectedDeals > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <ArrowDownRight className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="text-foreground"><strong>{forecast.neglectedDeals} neglected deals</strong> in pipeline — these represent lost revenue if not re-engaged immediately.</p>
                  </div>
                )}
                {forecast.achievement < 60 && (
                  <div className="flex items-start gap-2 text-sm">
                    <ArrowDownRight className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="text-foreground"><strong>Strategy achievement at {forecast.achievement.toFixed(0)}%</strong> — significant gap requires pipeline acceleration or new deal sourcing.</p>
                  </div>
                )}
                {forecast.avgMargin < 15 && (
                  <div className="flex items-start gap-2 text-sm">
                    <ArrowDownRight className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <p className="text-foreground"><strong>Average pipeline margin {forecast.avgMargin.toFixed(1)}%</strong> — below healthy threshold, review pricing strategy.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Activity Prioritization Tab */}
        <TabsContent value="activity" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Task Completion</span>
                </div>
                <p className="text-xl font-bold text-foreground">{taskMetrics.completionRate.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">{taskMetrics.done}/{taskMetrics.total} completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs text-muted-foreground">Overdue Tasks</span>
                </div>
                <p className={`text-xl font-bold ${taskMetrics.overdue > 0 ? 'text-destructive' : 'text-foreground'}`}>{taskMetrics.overdue}</p>
                <p className="text-xs text-muted-foreground">need immediate attention</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-muted-foreground">High Priority</span>
                </div>
                <p className="text-xl font-bold text-foreground">{taskMetrics.highPriority}</p>
                <p className="text-xs text-muted-foreground">high/critical tasks</p>
              </CardContent>
            </Card>
          </div>

          {/* Priority recommendations */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">AI Priority Recommendations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Re-engage neglected */}
              {forecast.neglectedDeals > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-foreground">🚨 Re-engage Neglected Deals</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {forecast.neglectedDeals} deals marked as neglected. Assign KAMs and create follow-up actions within 48h to prevent permanent loss.
                    </p>
                  </div>
                </div>
              )}
              {/* Focus on Tier A */}
              {scoredLeads.filter(l => l.tier === 'A').length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30">
                  <Target className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-foreground">🎯 Prioritize Tier A Leads</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {scoredLeads.filter(l => l.tier === 'A').length} Tier A leads represent {fmtEur(scoredLeads.filter(l => l.tier === 'A').reduce((s, l) => s + l.revenue, 0))} in pipeline. Ensure daily follow-up and executive sponsorship.
                    </p>
                  </div>
                </div>
              )}
              {/* Task backlog */}
              {taskMetrics.overdue > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30">
                  <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-foreground">⏰ Clear Overdue Backlog</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {taskMetrics.overdue} overdue tasks impacting commercial velocity. Reassign or close stale actions.
                    </p>
                  </div>
                </div>
              )}
              {/* Pipeline gap */}
              {forecast.achievement < 80 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30">
                  <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-foreground">📈 Accelerate Pipeline Generation</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      At {forecast.achievement.toFixed(0)}% strategy achievement, need {fmtEur(Math.max(0, forecast.strategyTarget - forecast.wonRevenue - forecast.weightedPipeline))} in additional pipeline. Focus prospecting on strategic product families and regions.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AiAugmentedSalesPage;
