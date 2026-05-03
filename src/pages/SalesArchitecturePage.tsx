import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Users, Globe, MapPin, Building2, AlertTriangle, CheckCircle2, TrendingUp, Brain, Network, Target, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildSalesArchitectureFallbackRecommendation } from '@/lib/salesArchitecture';
import { buildSalesScenarioRecommendation, buildScenarioSynthesis } from '@/lib/salesScenario';
import { dedupeOpportunities, dedupeOrders, getActivePipelineOpportunities, isNeglectedStatus, isOpportunityCoveredByOrder, normalizeOpportunityStatus } from '@/lib/salesData';

const COLORS = ['hsl(var(--primary))', 'hsl(35,90%,55%)', 'hsl(150,60%,45%)', 'hsl(280,60%,55%)', 'hsl(0,70%,55%)', 'hsl(200,70%,50%)'];

const fmt = (v: number) => v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `€${(v / 1_000).toFixed(0)}K` : `€${v.toFixed(0)}`;

const formatEuroAxisTick = (value: number) => {
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    return Number.isInteger(millions) ? `€${millions.toFixed(0)}M` : `€${millions.toFixed(1).replace(/\.0$/, '')}M`;
  }

  if (Math.abs(value) >= 1_000) {
    const thousands = value / 1_000;
    return Number.isInteger(thousands) ? `€${thousands.toFixed(0)}K` : `€${thousands.toFixed(1).replace(/\.0$/, '')}K`;
  }

  return `€${value.toFixed(0)}`;
};

const getNiceAxisStep = (maxValue: number, tickCount = 4) => {
  if (maxValue <= 0) return 1;

  const roughStep = maxValue / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;

  if (normalizedStep <= 1) return magnitude;
  if (normalizedStep <= 2) return 2 * magnitude;
  if (normalizedStep <= 2.5) return 2.5 * magnitude;
  if (normalizedStep <= 5) return 5 * magnitude;
  return 10 * magnitude;
};

const SalesArchitecturePage = () => {
  const { data } = useData();
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scenarioPrompt, setScenarioPrompt] = useState('');
  const [scenarioReports, setScenarioReports] = useState<Array<{ name: string; prompt: string; report: string }>>([]);

  const company = data.companyProfile;
  const opportunities = useMemo(() => dedupeOpportunities(data.opportunities), [data.opportunities]);
  const orders = useMemo(() => dedupeOrders(data.orders), [data.orders]);
  const strategy = data.strategy;
  const tasks = data.tasks;
  const activePipelineOpportunities = useMemo(() => getActivePipelineOpportunities(opportunities, orders), [opportunities, orders]);
  const totalOpenPipelineValue = useMemo(() => activePipelineOpportunities.reduce((s, o) => s + o.estRevenue, 0), [activePipelineOpportunities]);
  const totalNeglectedValue = useMemo(() => opportunities.filter(o => isNeglectedStatus(o.status)).reduce((s, o) => s + o.estRevenue, 0), [opportunities]);
  const totalNeglectedCount = useMemo(() => opportunities.filter(o => isNeglectedStatus(o.status)).length, [opportunities]);

  // ── Parse company profile for structure info ──
  const companyInsights = useMemo(() => {
    const notes = company?.additional_notes || '';
    const desc = company?.business_description || '';
    const stratCtx = company?.strategy_context || '';
    const fullText = `${notes}\n${desc}\n${stratCtx}`;

    const employees = fullText.match(/Total employees:\s*(\d+)/i);
    const teamSize = employees ? parseInt(employees[1]) : null;
    const serviceRadius = fullText.match(/(\d+)\s*km\s*radius/i);
    const outsourceRatio = fullText.match(/(\d+)%\s*outsourced/i);
    const currentRevenue = fullText.match(/Revenue:\s*€([\d.,]+)M/i);
    const targetRevenue = fullText.match(/targeting\s*€([\d.,]+)M/i) || fullText.match(/Target.*?€([\d.,]+)M/i);

    return {
      teamSize,
      serviceRadius: serviceRadius ? parseInt(serviceRadius[1]) : null,
      outsourcePercent: outsourceRatio ? parseInt(outsourceRatio[1]) : null,
      currentRevenue: currentRevenue ? parseFloat(currentRevenue[1].replace(',', '.')) * 1_000_000 : null,
      targetRevenue: targetRevenue ? parseFloat(targetRevenue[1].replace(',', '.')) * 1_000_000 : null,
    };
  }, [company]);

  // ── Regional Analysis ──
  const regionalAnalysis = useMemo(() => {
    const regionMap: Record<string, { pipeline: number; oppCount: number; customers: Set<string>; sold: number; neglected: number; neglectedValue: number; kams: Set<string> }> = {};
    const ensureRegion = (region: string) => {
      if (!regionMap[region]) {
        regionMap[region] = { pipeline: 0, oppCount: 0, customers: new Set(), sold: 0, neglected: 0, neglectedValue: 0, kams: new Set() };
      }
      return regionMap[region];
    };

    opportunities.forEach(o => {
      const region = o.region || 'Unknown';
      const bucket = ensureRegion(region);
      const status = normalizeOpportunityStatus(o.status);
      const alreadyBooked = isOpportunityCoveredByOrder(o, orders);

      bucket.customers.add(o.customerName);
      if (o.kam) bucket.kams.add(o.kam);

      if (alreadyBooked) return;

      if (status === 'won') {
        bucket.sold += o.estRevenue;
        return;
      }

      if (status === 'neglected') {
        bucket.neglected += 1;
        bucket.neglectedValue += o.estRevenue;
        return;
      }

      if (status !== 'lost') {
        bucket.pipeline += o.estRevenue;
        bucket.oppCount += 1;
      }
    });

    orders.forEach(o => {
      const region = o.region || 'Unknown';
      const bucket = ensureRegion(region);
      bucket.sold += o.sellingPrice;
      bucket.customers.add(o.customerName);
      if (o.kam) bucket.kams.add(o.kam);
    });

    return Object.entries(regionMap)
      .filter(([r]) => r && r !== 'Unknown')
      .map(([region, d]) => ({
        region,
        pipeline: d.pipeline,
        oppCount: d.oppCount,
        customers: d.customers.size,
        sold: d.sold,
        neglected: d.neglected,
        neglectedValue: d.neglectedValue,
        kams: [...d.kams],
        conversionRate: d.pipeline + d.sold > 0 ? (d.sold / (d.pipeline + d.sold) * 100) : 0,
      }))
      .sort((a, b) => (b.pipeline + b.sold) - (a.pipeline + a.sold));
  }, [opportunities, orders]);

  // ── KAM Performance ──
  const kamAnalysis = useMemo(() => {
    const kamMap: Record<string, { pipeline: number; oppCount: number; sold: number; neglected: number; neglectedValue: number; regions: Set<string>; customers: Set<string> }> = {};
    const ensureKam = (kam: string) => {
      if (!kamMap[kam]) {
        kamMap[kam] = { pipeline: 0, oppCount: 0, sold: 0, neglected: 0, neglectedValue: 0, regions: new Set(), customers: new Set() };
      }
      return kamMap[kam];
    };

    opportunities.forEach(o => {
      const kam = o.kam || 'Unassigned';
      const bucket = ensureKam(kam);
      const status = normalizeOpportunityStatus(o.status);
      const alreadyBooked = isOpportunityCoveredByOrder(o, orders);

      if (o.region) bucket.regions.add(o.region);
      bucket.customers.add(o.customerName);

      if (alreadyBooked) return;

      if (status === 'won') {
        bucket.sold += o.estRevenue;
        return;
      }

      if (status === 'neglected') {
        bucket.neglected += 1;
        bucket.neglectedValue += o.estRevenue;
        return;
      }

      if (status !== 'lost') {
        bucket.pipeline += o.estRevenue;
        bucket.oppCount += 1;
      }
    });

    orders.forEach(o => {
      const kam = o.kam || 'Unassigned';
      const bucket = ensureKam(kam);
      bucket.sold += o.sellingPrice;
      if (o.region) bucket.regions.add(o.region);
      bucket.customers.add(o.customerName);
    });

    return Object.entries(kamMap).map(([kam, d]) => ({
      kam,
      pipeline: d.pipeline,
      oppCount: d.oppCount,
      sold: d.sold,
      neglected: d.neglected,
      neglectedValue: d.neglectedValue,
      regions: [...d.regions],
      customers: d.customers.size,
      efficiency: d.pipeline + d.sold > 0 ? (d.sold / (d.pipeline + d.sold) * 100) : 0,
    })).sort((a, b) => (b.pipeline + b.sold) - (a.pipeline + a.sold));
  }, [opportunities, orders]);

  // ── Structure Recommendations (rule-based) ──
  const structureRecommendations = useMemo(() => {
    const recs: { type: 'critical' | 'warning' | 'opportunity'; title: string; detail: string; region?: string }[] = [];
    const totalNeglected = totalNeglectedValue;
    const totalPipeline = totalOpenPipelineValue;

    if (totalNeglected > 0) {
      recs.push({
        type: 'critical',
        title: `€${(totalNeglected / 1_000_000).toFixed(1)}M in Neglected Opportunities`,
        detail: `${totalNeglectedCount} opportunities worth €${(totalNeglected / 1_000_000).toFixed(1)}M are unattended or neglected. This signals insufficient commercial coverage capacity.`,
      });
    }

    // USA dominance
    const usaPipeline = regionalAnalysis.find(r => r.region === 'USA');
    if (usaPipeline && totalPipeline > 0 && (usaPipeline.pipeline / totalPipeline) > 0.5) {
      recs.push({
        type: 'opportunity',
        title: 'USA is the Primary Revenue Engine',
        detail: `${((usaPipeline.pipeline / totalPipeline) * 100).toFixed(0)}% of pipeline (${fmt(usaPipeline.pipeline)}) is in USA with ${usaPipeline.customers} customers. This justifies dedicated commercial structure.`,
        region: 'USA',
      });
    }

    // Spain local coverage
    const spainData = regionalAnalysis.find(r => r.region === 'SPAIN');
    if (spainData && spainData.neglected > 0) {
      recs.push({
        type: 'warning',
        title: 'Spain Market Underserved Despite Proximity',
        detail: `${spainData.neglected} opportunities neglected in Spain (${fmt(spainData.neglectedValue)}). With HQ in Spain, this shouldn't happen — consider back-office commercial support.`,
        region: 'SPAIN',
      });
    }

    // LATAM coverage
    const latamData = regionalAnalysis.find(r => r.region === 'LATAM');
    if (latamData) {
      recs.push({
        type: 'opportunity',
        title: 'LATAM Requires Finder/Agent Network',
        detail: `LATAM pipeline of ${fmt(latamData.pipeline)} with ${latamData.customers} customer(s). A finder's fee structure or regional agent would unlock this market without fixed cost.`,
        region: 'LATAM',
      });
    }

    // KAM overload
    kamAnalysis.forEach(k => {
      if (k.neglected >= 2) {
        recs.push({
          type: 'warning',
          title: `${k.kam}: Capacity Overload (${k.neglected} Neglected)`,
          detail: `${k.kam} handles ${k.oppCount} opportunities across ${k.regions.join(', ')} but has ${k.neglected} neglected deals worth ${fmt(k.neglectedValue)}. Needs support or territory reduction.`,
        });
      }
    });

    // Team size vs revenue target
    if (companyInsights.teamSize && companyInsights.targetRevenue) {
      const revenuePerPerson = companyInsights.targetRevenue / companyInsights.teamSize;
      if (revenuePerPerson > 350_000) {
        recs.push({
          type: 'warning',
          title: 'Revenue/Employee Ratio Too High for Target',
          detail: `Target of ${fmt(companyInsights.targetRevenue)} with ${companyInsights.teamSize} employees = ${fmt(revenuePerPerson)}/person. Industry benchmark is €200-300K. Consider adding commercial roles.`,
        });
      }
    }

    return recs;
  }, [regionalAnalysis, kamAnalysis, companyInsights, totalNeglectedValue, totalOpenPipelineValue, totalNeglectedCount]);

  // ── Proposed Structure ──
  const proposedStructure = useMemo(() => {
    const roles: { role: string; type: string; location: string; rationale: string; priority: 'high' | 'medium' | 'low'; cost: string }[] = [];
    const usaPipeline = regionalAnalysis.find(r => r.region === 'USA');
    const spainPipeline = regionalAnalysis.find(r => r.region === 'SPAIN');
    const latamPipeline = regionalAnalysis.find(r => r.region === 'LATAM');

    // Centralized back-office
    roles.push({
      role: 'Commercial Back-Office Coordinator',
      type: 'Back Office',
      location: 'HQ (Spain)',
      rationale: 'Centralized support for quotes, follow-ups, CRM management. Frees KAMs from admin tasks. Critical to prevent opportunity neglect.',
      priority: 'high',
      cost: '€30-40K/year',
    });

    // USA agent (already LINETEX)
    if (usaPipeline && usaPipeline.pipeline > 1_000_000) {
      roles.push({
        role: 'LINETEX (Commercial Agent - USA)',
        type: 'Agent/Rep',
        location: 'USA',
        rationale: `Already managing ${usaPipeline.oppCount} opportunities (${fmt(usaPipeline.pipeline)}). Formalize as exclusive regional agent with structured commission (5-8% on closed deals).`,
        priority: 'high',
        cost: 'Commission-based (5-8%)',
      });
    }

    // Spain sales rep or back-office sales
    if (spainPipeline) {
      roles.push({
        role: 'Inside Sales / Technical Sales (Spain)',
        type: 'Sales Representative',
        location: 'HQ (Spain)',
        rationale: `Spain has ${fmt(spainPipeline.pipeline)} pipeline with ${spainPipeline.neglected} neglected deals. An inside sales role can cover local market and support service business growth.`,
        priority: 'medium',
        cost: '€35-50K/year + variable',
      });
    }

    // LATAM finder
    if (latamPipeline) {
      roles.push({
        role: 'LATAM Finder / Agent',
        type: "Finder's Fee",
        location: 'LATAM (Remote)',
        rationale: `Emerging market with ${fmt(latamPipeline.pipeline)} pipeline. Use finder's fee model (3-5%) to test market before committing fixed resources.`,
        priority: 'low',
        cost: "Finder's fee (3-5%)",
      });
    }

    // Europe agent
    const europePipeline = regionalAnalysis.find(r => r.region === 'EUROPE');
    if (europePipeline && europePipeline.pipeline > 500_000) {
      roles.push({
        role: 'European Agent Network',
        type: 'Agent/Rep',
        location: 'Europe (Key Markets)',
        rationale: `${fmt(europePipeline.pipeline)} pipeline in Europe. Identify agents in key markets (Germany, Italy, France) for packaging industry connections.`,
        priority: 'medium',
        cost: 'Commission-based (5-7%)',
      });
    }

    // Service expansion
    if (companyInsights.serviceRadius) {
      roles.push({
        role: 'Service Expansion Manager',
        type: 'Sales Representative',
        location: 'Spain (National)',
        rationale: `Current service limited to ${companyInsights.serviceRadius}km. Scaling from local maintenance to national contract-based service requires a dedicated commercial role.`,
        priority: 'medium',
        cost: '€40-55K/year + bonus',
      });
    }

    return roles;
  }, [regionalAnalysis, companyInsights]);

  // ── AI Recommendation Engine ──
  const generateFallbackRecommendation = () => {
    return buildSalesArchitectureFallbackRecommendation({
      companyName: company?.company_name || 'Company',
      currentRevenue: companyInsights.currentRevenue || 0,
      targetRevenue: companyInsights.targetRevenue || 0,
      teamSize: companyInsights.teamSize || 0,
      businessDescription: company?.business_description || '',
      strategicGoals: company?.strategic_goals || company?.strategy_context || '',
      totalPipeline: totalOpenPipelineValue,
      totalNeglected: totalNeglectedValue,
      regions: regionalAnalysis.map(r => ({ region: r.region, pipeline: r.pipeline, customers: r.customers, neglected: r.neglected })),
      kams: kamAnalysis.map(k => ({ name: k.kam, pipeline: k.pipeline, sold: k.sold, neglected: k.neglected, regions: k.regions })),
    });
  };

  useEffect(() => {
    setAiRecommendation((prev) => prev || generateFallbackRecommendation());
  }, [company?.company_name, totalOpenPipelineValue, totalNeglectedValue, regionalAnalysis.length, kamAnalysis.length, strategy.length]);

  const generateAiRecommendation = async () => {
    setLoading(true);

    const fallbackRecommendation = generateFallbackRecommendation();

    try {
      const regionSummary = regionalAnalysis
        .map(r => `${r.region}: ${fmt(r.pipeline)} pipeline, ${r.customers} customers, ${r.neglected} neglected`)
        .join(' | ');

      const task = {
        title: 'Global Sales Architecture Blueprint',
        description: 'Design a scalable global sales architecture that explicitly covers market segmentation, geographic sales model, channel strategy, pricing architecture, opportunity management, and sales resource allocation. Compare at least 3 structural options and select the best safe option using business impact, technical risk, complexity, maintainability, and scalability.',
        category: 'strategy',
        pillar: 'p1',
        priority: 'high',
        assignee: 'AI Advisor',
      };

      const contextData = {
        pipelineValue: fmt(totalOpenPipelineValue),
        topCustomers: regionSummary,
        topProducts: [...new Set([...orders.map(o => o.productFamily), ...opportunities.map(o => o.productFamily)].filter(Boolean))].slice(0, 8).join(', '),
        strategyTargets: strategy.map(s => `${s.productFamily} in ${s.region}: ${fmt(s.estRevenue)}`).slice(0, 8).join(' | '),
      };

      const { data: result, error } = await supabase.functions.invoke('generate-action-content', {
        body: {
          type: 'generate',
          task,
          companyProfile: company,
          contextData,
        },
      });

      if (error) throw error;

      const agentAddendum = [
        '## AI Agent Addendum',
        result?.goal ? `- Recommended operating goal: ${result.goal}` : '',
        result?.presentationNotes ? `- Execution blueprint: ${result.presentationNotes}` : '',
        result?.callScript ? `- Management cadence: ${result.callScript}` : '',
      ].filter(Boolean).join('\n');

      setAiRecommendation([fallbackRecommendation, agentAddendum].filter(Boolean).join('\n\n'));
    } catch (err) {
      console.error('AI recommendation error:', err);
      setAiRecommendation(fallbackRecommendation);
    }

    setLoading(false);
  };

  const createScenarioReport = () => {
    if (!scenarioPrompt.trim()) return;

    const scenarioName = `Scenario ${scenarioReports.length + 1}`;
    const report = buildSalesScenarioRecommendation({
      scenarioName,
      prompt: scenarioPrompt.trim(),
      companyName: company?.company_name || 'Company',
      totalPipeline: totalOpenPipelineValue,
      totalSold: orders.reduce((sum, order) => sum + order.sellingPrice, 0),
      keyRegions: regionalAnalysis.map((region) => region.region).slice(0, 4),
      topCustomers: [...new Set([...orders.map((order) => order.customerName), ...opportunities.map((opportunity) => opportunity.customerName)].filter(Boolean))].slice(0, 4),
    });

    setScenarioReports((prev) => [...prev, { name: scenarioName, prompt: scenarioPrompt.trim(), report }]);
    setScenarioPrompt('');
  };

  const finalScenarioRecommendation = useMemo(() => buildScenarioSynthesis(scenarioReports), [scenarioReports]);

  // Chart data
  const regionChartData = regionalAnalysis.map(r => ({
    name: r.region,
    pipeline: r.pipeline,
    sold: r.sold,
    neglected: r.neglectedValue,
  }));

  const regionAxisConfig = useMemo(() => {
    const maxStackValue = regionChartData.reduce((maxValue, region) => {
      const total = region.pipeline + region.sold + region.neglected;
      return Math.max(maxValue, total);
    }, 0);

    const step = getNiceAxisStep(maxStackValue || 1);
    const max = Math.max(step, Math.ceil(maxStackValue / step) * step);
    const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step);

    return { max, ticks };
  }, [regionChartData]);

  const coverageData = regionalAnalysis.map(r => ({
    name: r.region,
    value: r.pipeline,
  }));

  const kamChartData = kamAnalysis.map(k => ({
    name: k.kam || 'Unassigned',
    pipeline: k.pipeline,
    sold: k.sold,
    neglectedValue: k.neglectedValue,
    efficiency: k.efficiency,
  }));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">Pillar 1</span>
            <Badge variant="outline" className="text-xs">Data-Driven</Badge>
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Sales Architecture</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Global sales architecture blueprint for segmentation, geography, channels, pricing, and systematic growth
          </p>
        </div>
        <Button onClick={generateAiRecommendation} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          {loading ? 'Analyzing...' : 'Generate AI Recommendation'}
        </Button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Team Size</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{companyInsights.teamSize || '—'}</p>
          <p className="text-[10px] text-muted-foreground">employees</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Active Regions</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{regionalAnalysis.length}</p>
          <p className="text-[10px] text-muted-foreground">{regionalAnalysis.map(r => r.region).join(', ')}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Network className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Active KAMs/Agents</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{kamAnalysis.length}</p>
          <p className="text-[10px] text-muted-foreground">{kamAnalysis.map(k => k.kam).join(', ')}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-xs text-muted-foreground">Neglected Pipeline</p>
          </div>
          <p className="text-2xl font-bold text-destructive">{fmt(totalNeglectedValue)}</p>
          <p className="text-[10px] text-muted-foreground">{totalNeglectedCount} neglected opportunities</p>
        </CardContent></Card>
      </div>

      {/* Critical Alerts */}
      {structureRecommendations.filter(r => r.type === 'critical').length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="font-semibold text-destructive">Critical Structural Issues</h3>
            </div>
            <div className="space-y-2">
              {structureRecommendations.filter(r => r.type === 'critical').map((r, i) => (
                <div key={i} className="text-sm">
                  <p className="font-medium text-foreground">{r.title}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{r.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="coverage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="coverage">Regional Coverage</TabsTrigger>
          <TabsTrigger value="structure">Proposed Structure</TabsTrigger>
          <TabsTrigger value="kam">KAM Analysis</TabsTrigger>
          <TabsTrigger value="recommendation">AI Recommendation</TabsTrigger>
        </TabsList>

        {/* ── Regional Coverage ── */}
        <TabsContent value="coverage" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Pipeline by Region</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={regionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      domain={[0, regionAxisConfig.max]}
                      ticks={regionAxisConfig.ticks}
                      tickFormatter={formatEuroAxisTick}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                    />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="sold" fill="hsl(150,60%,45%)" name="Sold" stackId="total" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pipeline" fill="hsl(var(--primary))" name="Open Pipeline" stackId="total" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="neglected" fill="hsl(0,70%,55%)" name="Neglected" stackId="total" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Market Share Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={coverageData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {coverageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Regional Detail Table */}
          <Card>
            <CardHeader><CardTitle className="text-base">Regional Coverage Analysis</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Region</TableHead>
                  <TableHead className="text-xs text-right">Pipeline</TableHead>
                  <TableHead className="text-xs text-right">Sold</TableHead>
                  <TableHead className="text-xs text-right">Customers</TableHead>
                  <TableHead className="text-xs text-right">Opportunities</TableHead>
                  <TableHead className="text-xs text-right">Neglected</TableHead>
                  <TableHead className="text-xs">Current Coverage</TableHead>
                  <TableHead className="text-xs">Recommended Model</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {regionalAnalysis.map(r => (
                    <TableRow key={r.region}>
                      <TableCell className="text-xs font-medium">{r.region}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(r.pipeline)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(r.sold)}</TableCell>
                      <TableCell className="text-xs text-right">{r.customers}</TableCell>
                      <TableCell className="text-xs text-right">{r.oppCount}</TableCell>
                      <TableCell className="text-xs text-right">
                        {r.neglected > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">{r.neglected} ({fmt(r.neglectedValue)})</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">None</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{r.kams.length > 0 ? r.kams.join(', ') : '—'}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {r.region === 'USA' ? 'Exclusive Agent' : r.region === 'SPAIN' ? 'Direct + Back Office' : r.region === 'LATAM' ? "Finder's Fee" : 'Agent Network'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Proposed Structure ── */}
        <TabsContent value="structure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Recommended Commercial Roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {proposedStructure.map((role, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">{role.role}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">{role.type}</Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            <MapPin className="h-3 w-3 mr-1" />{role.location}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={role.priority === 'high' ? 'destructive' : role.priority === 'medium' ? 'default' : 'secondary'} className="text-[10px]">
                          {role.priority} priority
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">{role.cost}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{role.rationale}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Warnings & Opportunities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base text-amber-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Warnings
              </CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {structureRecommendations.filter(r => r.type === 'warning').map((r, i) => (
                  <div key={i} className="border-l-2 border-amber-400 pl-3">
                    <p className="text-xs font-medium text-foreground">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{r.detail}</p>
                  </div>
                ))}
                {structureRecommendations.filter(r => r.type === 'warning').length === 0 && (
                  <p className="text-xs text-muted-foreground">No warnings detected</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base text-green-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Opportunities
              </CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {structureRecommendations.filter(r => r.type === 'opportunity').map((r, i) => (
                  <div key={i} className="border-l-2 border-green-400 pl-3">
                    <p className="text-xs font-medium text-foreground">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{r.detail}</p>
                  </div>
                ))}
                {structureRecommendations.filter(r => r.type === 'opportunity').length === 0 && (
                  <p className="text-xs text-muted-foreground">Upload more data to identify opportunities</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── KAM Analysis ── */}
        <TabsContent value="kam" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">KAM / Agent Performance & Coverage</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={kamChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => fmt(v)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis dataKey="name" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="sold" fill="hsl(150,60%,45%)" name="Sold" />
                  <Bar dataKey="pipeline" fill="hsl(var(--primary))" name="Pipeline" opacity={0.6} />
                  <Bar dataKey="neglectedValue" fill="hsl(0,70%,55%)" name="Neglected" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">KAM Efficiency Matrix</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">KAM/Agent</TableHead>
                  <TableHead className="text-xs text-right">Total Pipeline</TableHead>
                  <TableHead className="text-xs text-right">Sold</TableHead>
                  <TableHead className="text-xs text-right">Conversion</TableHead>
                  <TableHead className="text-xs text-right">Customers</TableHead>
                  <TableHead className="text-xs">Regions</TableHead>
                  <TableHead className="text-xs text-right">Neglected</TableHead>
                  <TableHead className="text-xs">Assessment</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {kamAnalysis.map(k => {
                    const score = (k.efficiency > 20 ? 2 : k.efficiency > 5 ? 1 : 0) +
                      (k.neglected === 0 ? 2 : k.neglected <= 1 ? 1 : 0);
                    return (
                      <TableRow key={k.kam}>
                        <TableCell className="text-xs font-medium">{k.kam}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{fmt(k.pipeline)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{fmt(k.sold)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{k.efficiency.toFixed(1)}%</TableCell>
                        <TableCell className="text-xs text-right">{k.customers}</TableCell>
                        <TableCell className="text-xs">{k.regions.join(', ')}</TableCell>
                        <TableCell className="text-xs text-right">
                          {k.neglected > 0 ? (
                            <Badge variant="destructive" className="text-[10px]">{k.neglected}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={score >= 3 ? 'default' : score >= 2 ? 'secondary' : 'destructive'} className="text-[10px]">
                            {score >= 3 ? 'Effective' : score >= 2 ? 'Needs Support' : 'Overloaded'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI Recommendation ── */}
        <TabsContent value="recommendation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Scenario Workspace
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Write a question or commercial scenario to test alternative sales structures. Each prompt creates a new scenario report and contributes to the final AI + Context recommendation.
              </p>
              <Textarea
                value={scenarioPrompt}
                onChange={(event) => setScenarioPrompt(event.target.value)}
                placeholder="Example: What if we use a hybrid distributor model in Germany while keeping direct KAM ownership for strategic accounts?"
                className="min-h-[120px] text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={createScenarioReport} disabled={!scenarioPrompt.trim()} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Create Scenario
                </Button>
                <Button onClick={generateAiRecommendation} disabled={loading} variant="outline" className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  Refresh Base Recommendation
                </Button>
              </div>
            </CardContent>
          </Card>

          {aiRecommendation && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  Base Global Sales Architecture Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {aiRecommendation.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">{line.replace('## ', '')}</h2>;
                    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{line.replace('### ', '')}</h3>;
                    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-sm font-semibold text-foreground mt-2">{line.replace(/\*\*/g, '')}</p>;
                    if (line.startsWith('- ')) return <li key={i} className="text-xs text-muted-foreground ml-4">{line.replace('- ', '')}</li>;
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="text-xs text-muted-foreground">{line}</p>;
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {scenarioReports.map((scenario) => (
            <Card key={scenario.name}>
              <CardHeader>
                <CardTitle className="text-base">{scenario.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{scenario.prompt}</p>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {scenario.report.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">{line.replace('## ', '')}</h2>;
                    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{line.replace('### ', '')}</h3>;
                    if (line.startsWith('- ')) return <li key={i} className="text-xs text-muted-foreground ml-4">{line.replace('- ', '')}</li>;
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="text-xs text-muted-foreground">{line}</p>;
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Final AI + Context - Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {finalScenarioRecommendation.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">{line.replace('## ', '')}</h2>;
                  if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{line.replace('### ', '')}</h3>;
                  if (line.startsWith('- ')) return <li key={i} className="text-xs text-muted-foreground ml-4">{line.replace('- ', '')}</li>;
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i} className="text-xs text-muted-foreground">{line}</p>;
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalesArchitecturePage;
