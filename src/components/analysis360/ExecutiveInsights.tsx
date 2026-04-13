import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { OrderRecord, OpportunityRecord, ProductRecord, StrategyRecord, CompanyProfile } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { groupBy, fmt } from './AnalysisUtils';
import {
  Brain, Sparkles, AlertTriangle, TrendingUp, Shield, Lightbulb,
  Target, Zap, Clock, ArrowRight, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

interface InsightData {
  executive_summary: string;
  health_score: number;
  health_label: string;
  critical_insights: Array<{
    title: string;
    type: 'risk' | 'opportunity' | 'pattern' | 'warning' | 'strength';
    severity: 'high' | 'medium' | 'low';
    description: string;
    data_point?: string;
  }>;
  recommendations: Array<{
    priority: 'immediate' | 'short_term' | 'medium_term';
    action: string;
    expected_impact: string;
    effort?: 'low' | 'medium' | 'high';
  }>;
  portfolio_diagnosis?: string;
  growth_outlook?: string;
  key_risks?: string[];
}

interface Props {
  orders: OrderRecord[];
  opportunities: OpportunityRecord[];
  products: ProductRecord[];
  strategy: StrategyRecord[];
  company: CompanyProfile;
}

export const ExecutiveInsights = ({ orders, opportunities, products, strategy, company }: Props) => {
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const generateInsights = async () => {
    setLoading(true);
    try {
      // Pre-aggregate data to minimize payload
      const totalRevenue = orders.reduce((s, o) => s + o.sellingPrice, 0);
      const totalMargin = orders.reduce((s, o) => s + o.margin, 0);
      const byYear = Object.entries(groupBy(orders, o => o.purchasingYear)).map(([year, items]) => ({
        year,
        revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
        margin: items.reduce((s, i) => s + i.margin, 0),
        orders: items.length,
        customers: new Set(items.map(i => i.customerName)).size,
      })).sort((a, b) => a.year.localeCompare(b.year));

      const byProduct = Object.entries(groupBy(orders, o => o.productFamily)).map(([name, items]) => ({
        name,
        revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
        margin: items.reduce((s, i) => s + i.margin, 0),
        share: totalRevenue > 0 ? (items.reduce((s, i) => s + i.sellingPrice, 0) / totalRevenue * 100) : 0,
      })).sort((a, b) => b.revenue - a.revenue);

      const byCustomer = Object.entries(groupBy(orders, o => o.customerName)).map(([name, items]) => ({
        name,
        revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
        share: totalRevenue > 0 ? (items.reduce((s, i) => s + i.sellingPrice, 0) / totalRevenue * 100) : 0,
      })).sort((a, b) => b.revenue - a.revenue);

      const byRegion = Object.entries(groupBy(orders, o => o.region)).map(([name, items]) => ({
        name,
        revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
      })).sort((a, b) => b.revenue - a.revenue);

      const byKam = Object.entries(groupBy(orders, o => o.kam)).map(([name, items]) => ({
        name,
        revenue: items.reduce((s, i) => s + i.sellingPrice, 0),
        customers: new Set(items.map(i => i.customerName)).size,
      })).sort((a, b) => b.revenue - a.revenue);

      const totalPipeline = opportunities.reduce((s, o) => s + o.estRevenue, 0);
      const avgProb = opportunities.length > 0
        ? opportunities.reduce((s, o) => s + o.contractProb, 0) / opportunities.length : 0;

      const totalPlanned = strategy.reduce((s, r) => s + r.estRevenue, 0);

      const { data, error } = await supabase.functions.invoke('analyze-360', {
        body: {
          companyProfile: {
            name: company.company_name,
            industry: company.industry,
            sub_sector: company.sub_sector,
            description: company.business_description,
            strategic_goals: company.strategic_goals,
            objectives: company.objectives,
            competitors: company.main_competitors,
            segments: company.main_customer_segments,
            regions: company.operating_regions,
            main_products: company.main_products,
            annual_revenue: company.annual_revenue,
            sales_channels: company.sales_channels,
            current_challenges: company.current_challenges,
            market_context: company.market_context,
            strategy_context: company.strategy_context,
            additional_notes: company.additional_notes,
            employee_count: company.employee_count,
            headquarters: company.headquarters,
            sales_team_size: company.sales_team_size,
            kam_count: company.kam_count,
          },
          ordersSummary: {
            totalRevenue, totalMargin,
            marginPct: totalRevenue > 0 ? (totalMargin / totalRevenue * 100) : 0,
            totalOrders: orders.length,
            uniqueCustomers: new Set(orders.map(o => o.customerName)).size,
            byYear, byProduct: byProduct.slice(0, 10),
            topCustomers: byCustomer.slice(0, 10),
            byRegion, byKam: byKam.slice(0, 10),
            top3CustomerShare: byCustomer.slice(0, 3).reduce((s, c) => s + c.share, 0),
          },
          strategySummary: {
            totalPlanned,
            achievement: totalPlanned > 0 ? (totalRevenue / totalPlanned * 100) : 0,
            gap: totalRevenue - totalPlanned,
            hasStrategy: strategy.length > 0,
          },
          opportunitiesSummary: {
            totalPipeline,
            count: opportunities.length,
            avgProbability: avgProb,
            weightedPipeline: opportunities.reduce((s, o) => s + o.estRevenue * (o.contractProb / 100), 0),
          },
          productsSummary: {
            count: products.length,
            families: byProduct.length,
            products: products.map(p => ({ name: p.name, type: p.type, avgValue: p.averageValue })),
          },
        },
      });

      if (error) throw error;
      if (data?.insights) {
        setInsights(data.insights);
        toast({ title: "Executive insights generated", description: "AI analysis complete" });
      } else {
        throw new Error(data?.error || "No insights returned");
      }
    } catch (e: any) {
      console.error("Insight generation error:", e);
      toast({ title: "Error generating insights", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'risk': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-success" />;
      case 'warning': return <Shield className="h-4 w-4 text-warning" />;
      case 'strength': return <Sparkles className="h-4 w-4 text-primary" />;
      case 'pattern': return <Target className="h-4 w-4 text-muted-foreground" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const priorityColor = (p: string) =>
    p === 'immediate' ? 'destructive' as const : p === 'short_term' ? 'secondary' as const : 'outline' as const;

  const healthColor = (score: number) =>
    score >= 80 ? 'text-success' : score >= 60 ? 'text-primary' : score >= 40 ? 'text-warning' : 'text-destructive';

  const healthBg = (score: number) =>
    score >= 80 ? 'bg-success' : score >= 60 ? 'bg-primary' : score >= 40 ? 'bg-warning' : 'bg-destructive';

  if (!insights) {
    return (
      <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
        <CardContent className="py-8 text-center">
          <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">AI Executive Insights</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Generate an AI-powered strategic analysis of your company's 360º data.
            The AI will identify patterns, risks, opportunities, and provide prioritized recommendations.
          </p>
          <Button onClick={generateInsights} disabled={loading} className="gap-2" size="lg">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing data...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate Executive Insights</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with health score */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-primary" />
              <div>
                <h3 className="text-lg font-bold text-foreground">AI Executive Insights</h3>
                <p className="text-xs text-muted-foreground">Generated by strategic analysis engine</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Strategic Health</p>
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-bold ${healthColor(insights.health_score)}`}>
                    {insights.health_score}
                  </span>
                  <Badge variant="outline" className="text-xs">{insights.health_label}</Badge>
                </div>
                <Progress value={insights.health_score} className={`h-1.5 mt-1 w-24`} />
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)} className="gap-1 text-xs">
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expanded ? 'Collapse' : 'Expand'}
                </Button>
                <Button variant="ghost" size="sm" onClick={generateInsights} disabled={loading} className="gap-1 text-xs">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {expanded && (
        <>
          {/* Executive Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" /> Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{insights.executive_summary}</p>
            </CardContent>
          </Card>

          {/* Diagnosis row */}
          {(insights.portfolio_diagnosis || insights.growth_outlook) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {insights.portfolio_diagnosis && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Portfolio Diagnosis</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{insights.portfolio_diagnosis}</p></CardContent>
                </Card>
              )}
              {insights.growth_outlook && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5" /> Growth Outlook</CardTitle>
                  </CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{insights.growth_outlook}</p></CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Critical Insights */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" /> Critical Insights
                <Badge variant="secondary" className="ml-auto text-xs">{insights.critical_insights?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.critical_insights?.map((insight, i) => (
                  <div key={i} className={`flex gap-3 p-3 rounded-lg border ${
                    insight.severity === 'high' ? 'bg-destructive/5 border-destructive/20' :
                    insight.severity === 'medium' ? 'bg-warning/5 border-warning/20' : 'bg-muted/50 border-border'
                  }`}>
                    <div className="mt-0.5">{typeIcon(insight.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                        <Badge variant={insight.severity === 'high' ? 'destructive' : insight.severity === 'medium' ? 'secondary' : 'outline'} className="text-[10px] capitalize shrink-0">
                          {insight.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize shrink-0">{insight.type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{insight.description}</p>
                      {insight.data_point && (
                        <p className="text-xs text-primary font-medium mt-1">📊 {insight.data_point}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4" /> Strategic Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.recommendations?.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={priorityColor(rec.priority)} className="text-[10px] capitalize">
                          {rec.priority === 'immediate' ? '🔴 Immediate' : rec.priority === 'short_term' ? '🟡 Short-term' : '🟢 Medium-term'}
                        </Badge>
                        {rec.effort && (
                          <Badge variant="outline" className="text-[10px]">Effort: {rec.effort}</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground">{rec.action}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" /> {rec.expected_impact}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Key Risks */}
          {insights.key_risks && insights.key_risks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Key Risks to Monitor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {insights.key_risks.map((risk, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span> {risk}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
