import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  FolderKanban, Plus, Trash2, Brain, TrendingUp, AlertTriangle, Shield, Settings,
  DollarSign, BarChart3, Lightbulb, Save, Loader2, Target, Calendar, Users,
  Activity, Zap, Eye, CheckCircle, Clock, FileText, ArrowRight, Gauge, GitBranch, Edit
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const PROJECT_TYPES = ['machine', 'line', 'service', 'retrofit', 'software'];
const COMPLEXITY_LEVELS = ['low', 'medium', 'high'];
const RISK_LEVELS = ['low', 'medium', 'high'];
const DURATION_CATS = ['short', 'medium', 'long'];
const PROJECT_STATUSES = ['planning', 'active', 'on-hold', 'completed', 'cancelled'];
const PHASE_STATUSES = ['pending', 'in-progress', 'completed', 'blocked'];
const COST_CATEGORIES = ['engineering', 'procurement', 'labor', 'travel', 'subcontracting', 'overhead', 'contingency'];
const GATE_DEFINITIONS = [
  { number: 'G0', name: 'Contract Validation' },
  { number: 'G1', name: 'Engineering Approval' },
  { number: 'G2', name: 'Procurement Readiness' },
  { number: 'G3', name: 'FAT Readiness' },
  { number: 'G4', name: 'Shipment Approval' },
  { number: 'G5', name: 'SAT / Acceptance' },
  { number: 'G6', name: 'Financial Closure' },
];

const HEALTH_COLOR = (s: number) => s >= 80 ? 'text-primary' : s >= 60 ? 'text-yellow-600' : s >= 40 ? 'text-orange-500' : 'text-destructive';
const STATUS_VARIANT = (s: string) => {
  switch (s) {
    case 'completed': return 'default';
    case 'in-progress': case 'active': return 'secondary';
    case 'blocked': case 'on-hold': return 'destructive';
    default: return 'outline';
  }
};

// --- Gantt Chart Component ---
function GanttChart({ phases, gates, projectStart, projectEnd }: { phases: any[]; gates: any[]; projectStart?: string; projectEnd?: string }) {
  const chartData = useMemo(() => {
    if (phases.length === 0) return null;

    // Determine timeline bounds
    const now = new Date();
    let minDate = projectStart ? new Date(projectStart) : new Date(now.getTime() - 7 * 86400000);
    let maxDate = projectEnd ? new Date(projectEnd) : new Date(now.getTime() + 180 * 86400000);

    // Adjust based on actual phase dates
    phases.forEach(p => {
      if (p.planned_start) { const d = new Date(p.planned_start); if (d < minDate) minDate = d; }
      if (p.planned_end) { const d = new Date(p.planned_end); if (d > maxDate) maxDate = d; }
      if (p.actual_start) { const d = new Date(p.actual_start); if (d < minDate) minDate = d; }
      if (p.actual_end) { const d = new Date(p.actual_end); if (d > maxDate) maxDate = d; }
    });

    // Add padding
    minDate = new Date(minDate.getTime() - 7 * 86400000);
    maxDate = new Date(maxDate.getTime() + 14 * 86400000);
    const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000));

    const toPercent = (date: Date) => Math.max(0, Math.min(100, ((date.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100));

    // Generate month labels
    const months: { label: string; left: number }[] = [];
    const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cursor <= maxDate) {
      months.push({
        label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        left: toPercent(cursor),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Map phases to bars
    const bars = phases.map((p, idx) => {
      const hasPlanned = p.planned_start && p.planned_end;
      const hasActual = p.actual_start;
      const start = hasPlanned ? new Date(p.planned_start) : new Date(minDate.getTime() + (idx / phases.length) * (maxDate.getTime() - minDate.getTime()));
      const end = hasPlanned ? new Date(p.planned_end) : new Date(start.getTime() + (totalDays / phases.length) * 86400000);
      const actualStart = hasActual ? new Date(p.actual_start) : null;
      const actualEnd = p.actual_end ? new Date(p.actual_end) : (p.status === 'in-progress' ? now : null);

      return {
        id: p.id,
        name: p.phase_name,
        number: p.phase_number,
        status: p.status,
        completion: p.completion_pct || 0,
        plannedLeft: toPercent(start),
        plannedWidth: Math.max(1, toPercent(end) - toPercent(start)),
        actualLeft: actualStart ? toPercent(actualStart) : null,
        actualWidth: actualStart && actualEnd ? Math.max(0.5, toPercent(actualEnd) - toPercent(actualStart)) : null,
        isCritical: p.status === 'blocked' || (hasPlanned && p.actual_end && new Date(p.actual_end) > new Date(p.planned_end)),
        responsible: p.responsible,
      };
    });

    // Gate markers
    const gateMarkers = gates.filter(g => g.planned_date).map(g => ({
      id: g.id,
      label: g.gate_number,
      left: toPercent(new Date(g.planned_date)),
      status: g.status,
    }));

    const todayLeft = toPercent(now);

    return { bars, months, gateMarkers, todayLeft, minDate, maxDate };
  }, [phases, gates, projectStart, projectEnd]);

  if (!chartData) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> Gantt Chart — Timeline & Critical Path
        </CardTitle>
        <CardDescription className="text-xs">
          <span className="inline-flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-primary inline-block" /> Planned</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-primary/40 inline-block" /> Actual</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-destructive inline-block" /> Critical / Delayed</span>
            <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-destructive/70 inline-block" /> Today</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border-2 border-primary inline-block" /> Gate</span>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Month headers */}
            <div className="relative h-6 border-b border-border mb-1">
              {chartData.months.map((m, i) => (
                <span key={i} className="absolute text-[10px] text-muted-foreground font-medium" style={{ left: `${m.left}%` }}>
                  {m.label}
                </span>
              ))}
            </div>

            {/* Bars */}
            <div className="space-y-1">
              {chartData.bars.map(bar => (
                <div key={bar.id} className="flex items-center gap-0 h-9">
                  {/* Label */}
                  <div className="w-36 shrink-0 pr-2 text-right">
                    <span className="text-[10px] font-medium text-foreground truncate block">{bar.number}. {bar.name}</span>
                    {bar.responsible && <span className="text-[8px] text-muted-foreground truncate block">{bar.responsible}</span>}
                  </div>
                  {/* Chart area */}
                  <div className="relative flex-1 h-full bg-muted/30 rounded-sm border border-border/50">
                    {/* Today line */}
                    {chartData.todayLeft > 0 && chartData.todayLeft < 100 && (
                      <div className="absolute top-0 bottom-0 w-px bg-destructive/70 z-10" style={{ left: `${chartData.todayLeft}%` }} />
                    )}
                    {/* Gate markers */}
                    {chartData.gateMarkers.map(g => (
                      <div key={g.id} className="absolute top-0 bottom-0 flex items-center z-10" style={{ left: `${g.left}%` }} title={g.label}>
                        <div className={`w-2.5 h-2.5 rounded-full border-2 ${g.status === 'passed' ? 'bg-primary border-primary' : g.status === 'failed' ? 'bg-destructive border-destructive' : 'bg-background border-primary'}`} />
                      </div>
                    ))}
                    {/* Planned bar */}
                    <div
                      className={`absolute top-1 h-3 rounded-sm ${bar.isCritical ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ left: `${bar.plannedLeft}%`, width: `${bar.plannedWidth}%` }}
                      title={`${bar.name}: ${bar.completion}% complete`}
                    >
                      {/* Progress fill */}
                      <div className="h-full rounded-sm bg-foreground/20" style={{ width: `${bar.completion}%` }} />
                    </div>
                    {/* Actual bar */}
                    {bar.actualLeft !== null && bar.actualWidth !== null && (
                      <div
                        className={`absolute bottom-1 h-2 rounded-sm ${bar.isCritical ? 'bg-destructive/40' : 'bg-primary/40'}`}
                        style={{ left: `${bar.actualLeft}%`, width: `${bar.actualWidth}%` }}
                      />
                    )}
                    {/* Dependency arrow (simple sequential) */}
                  </div>
                </div>
              ))}
            </div>

            {/* Dependency lines (sequential phases → drawn as connecting lines) */}
            <div className="relative h-0">
              {chartData.bars.length > 1 && (
                <svg className="absolute inset-0 w-full pointer-events-none" style={{ height: `${chartData.bars.length * 36}px`, top: `-${chartData.bars.length * 36}px` }}>
                  {chartData.bars.slice(1).map((bar, i) => {
                    const prev = chartData.bars[i];
                    const x1 = prev.plannedLeft + prev.plannedWidth;
                    const y1 = i * 36 + 16;
                    const x2 = bar.plannedLeft;
                    const y2 = (i + 1) * 36 + 16;
                    if (x2 < x1 - 1) return null; // overlapping phases
                    return (
                      <line key={bar.id} x1={`${x1}%`} y1={y1} x2={`${x2}%`} y2={y2}
                        stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="3,3" opacity={0.4} />
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectManagementPage() {
  const { activeCompanyId } = useData();

  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [phases, setPhases] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [changeOrders, setChangeOrders] = useState<any[]>([]);
  const [showNewCO, setShowNewCO] = useState(false);
  const [newCO, setNewCO] = useState({
    change_order_number: '', title: '', description: '', category: 'scope', priority: 'medium',
    requested_by: '', cost_impact: 0, schedule_impact_days: 0, margin_impact_pct: 0, risk_impact: 'none',
  });
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectInput, setProjectInput] = useState('');

  const [newProject, setNewProject] = useState({
    project_number: '', title: '', customer_name: '', project_type: 'machine',
    complexity: 'medium', risk_level: 'medium', contract_value: 0,
    scope_of_supply: '', deliverables: '', exclusions: '', payment_terms: '',
    incoterms: '', warranty_terms: '', penalties_lds: '', delivery_deadline: '',
    planned_start: '', planned_end: '', notes: '',
  });

  const loadProjects = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').eq('company_id', activeCompanyId).order('created_at', { ascending: false });
    setProjects(data || []);
    setLoading(false);
  }, [activeCompanyId]);

  const loadProjectDetails = useCallback(async (projectId: string) => {
    const [p, m, r, c, g, co] = await Promise.all([
      supabase.from('project_phases').select('*').eq('project_id', projectId).order('phase_number'),
      supabase.from('project_milestones').select('*').eq('project_id', projectId).order('planned_date'),
      supabase.from('project_risks').select('*').eq('project_id', projectId).order('risk_score', { ascending: false }),
      supabase.from('project_costs').select('*').eq('project_id', projectId).order('category'),
      supabase.from('project_gates').select('*').eq('project_id', projectId).order('gate_number'),
      supabase.from('change_orders').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    ]);
    setPhases(p.data || []);
    setMilestones(m.data || []);
    setRisks(r.data || []);
    setCosts(c.data || []);
    setGates(g.data || []);
    setChangeOrders(co.data || []);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { if (selectedProject) loadProjectDetails(selectedProject.id); }, [selectedProject, loadProjectDetails]);

  const saveProject = async () => {
    if (!activeCompanyId) return;
    const { error } = await supabase.from('projects').insert({ ...newProject, company_id: activeCompanyId });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Project created' });
    setShowNewProject(false);
    setNewProject({ project_number: '', title: '', customer_name: '', project_type: 'machine', complexity: 'medium', risk_level: 'medium', contract_value: 0, scope_of_supply: '', deliverables: '', exclusions: '', payment_terms: '', incoterms: '', warranty_terms: '', penalties_lds: '', delivery_deadline: '', planned_start: '', planned_end: '', notes: '' });
    loadProjects();
  };

  const deleteProject = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id);
    if (selectedProject?.id === id) { setSelectedProject(null); setPhases([]); setMilestones([]); setRisks([]); setCosts([]); setGates([]); }
    loadProjects();
  };

  const runAIAnalysis = async (type: 'initial_analysis' | 'health_check') => {
    if (!selectedProject && type !== 'initial_analysis') return;
    setAnalyzing(true);
    try {
      const body: any = { analysisType: type };
      if (type === 'initial_analysis') {
        body.projectInput = projectInput || `Project: ${selectedProject?.title}\nCustomer: ${selectedProject?.customer_name}\nType: ${selectedProject?.project_type}\nComplexity: ${selectedProject?.complexity}\nContract Value: ${selectedProject?.contract_value}\nScope: ${selectedProject?.scope_of_supply}\nDeliverables: ${selectedProject?.deliverables}\nExclusions: ${selectedProject?.exclusions}\nPayment Terms: ${selectedProject?.payment_terms}\nIncoterms: ${selectedProject?.incoterms}\nWarranty: ${selectedProject?.warranty_terms}\nPenalties: ${selectedProject?.penalties_lds}\nDeadline: ${selectedProject?.delivery_deadline}\nNotes: ${selectedProject?.notes}`;
      } else {
        body.projectData = { project: selectedProject, phases, milestones, risks, costs, gates };
      }

      const { data, error } = await supabase.functions.invoke('project-intelligence', { body });
      if (error) throw error;
      const analysis = data?.analysis;
      if (!analysis) throw new Error('No analysis returned');

      if (type === 'initial_analysis' && selectedProject) {
        // Populate project from AI analysis
        const updates: any = { ai_analysis: analysis };
        if (analysis.classification) {
          updates.project_type = analysis.classification.projectType || selectedProject.project_type;
          updates.complexity = analysis.classification.complexity || selectedProject.complexity;
          updates.risk_level = analysis.classification.riskLevel || selectedProject.risk_level;
          updates.duration_category = analysis.classification.durationCategory || selectedProject.duration_category;
        }
        if (analysis.healthScore) updates.health_score = analysis.healthScore;
        if (analysis.financialPlan?.marginTarget) updates.margin_target = analysis.financialPlan.marginTarget;
        await supabase.from('projects').update(updates).eq('id', selectedProject.id);

        // Create phases
        if (analysis.phases?.length > 0) {
          await supabase.from('project_phases').delete().eq('project_id', selectedProject.id);
          const phaseRows = analysis.phases.map((p: any) => ({
            project_id: selectedProject.id,
            phase_number: p.phaseNumber,
            phase_name: p.phaseName,
            description: p.description,
            responsible: p.responsible || '',
            budget: (selectedProject.contract_value || 0) * (p.budgetPct || 0) / 100,
            key_tasks: p.keyTasks || [],
            control_points: p.controlPoints || [],
            risks: p.risks || [],
          }));
          await supabase.from('project_phases').insert(phaseRows);
        }

        // Create milestones
        if (analysis.milestones?.length > 0) {
          await supabase.from('project_milestones').delete().eq('project_id', selectedProject.id);
          const msRows = analysis.milestones.map((m: any) => ({
            project_id: selectedProject.id,
            milestone_type: m.type || 'contract',
            title: m.title,
            description: m.description || '',
            payment_amount: m.paymentAmount || 0,
            payment_pct: m.paymentPct || 0,
            dependencies: m.dependencies || '',
            gate_id: m.gateId || '',
          }));
          await supabase.from('project_milestones').insert(msRows);
        }

        // Create gates
        if (analysis.gates?.length > 0) {
          await supabase.from('project_gates').delete().eq('project_id', selectedProject.id);
          const gateRows = analysis.gates.map((g: any) => ({
            project_id: selectedProject.id,
            gate_number: g.gateNumber,
            gate_name: g.gateName,
            description: g.description || '',
            required_inputs: g.requiredInputs || [],
            required_outputs: g.requiredOutputs || [],
            responsible: g.responsible || '',
            risks_if_not_passed: g.risksIfNotPassed || '',
          }));
          await supabase.from('project_gates').insert(gateRows);
        }

        // Create risks
        if (analysis.risks?.length > 0) {
          await supabase.from('project_risks').delete().eq('project_id', selectedProject.id);
          const riskRows = analysis.risks.map((r: any) => ({
            project_id: selectedProject.id,
            risk_title: r.title,
            description: r.description || '',
            category: r.category || 'operational',
            probability: r.probability || 'medium',
            impact: r.impact || 'medium',
            risk_score: r.riskScore || 0,
            mitigation_action: r.mitigationAction || '',
            contingency_plan: r.contingencyPlan || '',
            owner: r.owner || '',
          }));
          await supabase.from('project_risks').insert(riskRows);
        }

        // Create costs
        if (analysis.financialPlan?.costBreakdown?.length > 0) {
          await supabase.from('project_costs').delete().eq('project_id', selectedProject.id);
          const costRows = analysis.financialPlan.costBreakdown.map((c: any) => ({
            project_id: selectedProject.id,
            category: c.category || 'engineering',
            line_item: c.lineItem || c.category,
            budget_amount: c.budgetAmount || 0,
          }));
          await supabase.from('project_costs').insert(costRows);
        }

        // Reload
        const { data: updatedProject } = await supabase.from('projects').select('*').eq('id', selectedProject.id).single();
        if (updatedProject) setSelectedProject(updatedProject);
        loadProjectDetails(selectedProject.id);
        toast({ title: 'AI Analysis Complete', description: 'Execution plan generated with phases, milestones, gates, risks, and costs.' });
      } else if (type === 'health_check') {
        await supabase.from('projects').update({ ai_analysis: analysis, health_score: analysis.healthScore || selectedProject.health_score }).eq('id', selectedProject.id);
        const { data: updatedProject } = await supabase.from('projects').select('*').eq('id', selectedProject.id).single();
        if (updatedProject) setSelectedProject(updatedProject);
        toast({ title: 'Health Check Complete', description: `Score: ${analysis.healthScore}/100` });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const updatePhaseStatus = async (phaseId: string, status: string, completionPct: number) => {
    await supabase.from('project_phases').update({ status, completion_pct: completionPct }).eq('id', phaseId);
    if (selectedProject) loadProjectDetails(selectedProject.id);
  };

  const updateGateStatus = async (gateId: string, status: string) => {
    const updates: any = { status };
    if (status === 'passed') updates.actual_date = new Date().toISOString().split('T')[0];
    await supabase.from('project_gates').update(updates).eq('id', gateId);
    if (selectedProject) loadProjectDetails(selectedProject.id);
  };

  const updateMilestoneStatus = async (msId: string, status: string) => {
    const updates: any = { status };
    if (status === 'completed') updates.actual_date = new Date().toISOString().split('T')[0];
    await supabase.from('project_milestones').update(updates).eq('id', msId);
    if (selectedProject) loadProjectDetails(selectedProject.id);
  };

  // Dashboard KPIs
  const totalBudget = costs.reduce((s, c) => s + (c.budget_amount || 0), 0);
  const totalActualCost = costs.reduce((s, c) => s + (c.actual_amount || 0), 0);
  const totalCommitted = costs.reduce((s, c) => s + (c.committed_amount || 0), 0);
  const costVariance = totalBudget > 0 ? ((totalActualCost - totalBudget) / totalBudget) * 100 : 0;
  const completedPhases = phases.filter(p => p.status === 'completed').length;
  const overallProgress = phases.length > 0 ? phases.reduce((s, p) => s + (p.completion_pct || 0), 0) / phases.length : 0;
  const passedGates = gates.filter(g => g.status === 'passed').length;
  const openRisks = risks.filter(r => r.status === 'open').length;
  const paymentMilestones = milestones.filter(m => m.milestone_type === 'payment');
  const invoiced = paymentMilestones.filter(m => m.is_invoiced).reduce((s, m) => s + (m.payment_amount || 0), 0);
  const paid = paymentMilestones.filter(m => m.is_paid).reduce((s, m) => s + (m.payment_amount || 0), 0);
  const aiAnalysis = selectedProject?.ai_analysis || {};

  // Margin deviation alerts
  const marginAlerts = useMemo(() => {
    const alerts: { level: 'warning' | 'critical' | 'info'; title: string; message: string; action: string; metric: string }[] = [];
    const contractValue = selectedProject?.contract_value || 0;
    const marginTarget = selectedProject?.margin_target || 0;
    const exposedCost = Math.max(totalActualCost, totalCommitted);
    const projectedMargin = contractValue > 0 ? ((contractValue - exposedCost) / contractValue) * 100 : 0;
    const marginDeviation = marginTarget > 0 ? projectedMargin - marginTarget : 0;

    // Cost overruns by category
    const categoryOverruns: { category: string; budget: number; actual: number; variance: number }[] = [];
    const byCat: Record<string, { budget: number; actual: number }> = {};
    costs.forEach((c: any) => {
      const cat = c.category || 'other';
      if (!byCat[cat]) byCat[cat] = { budget: 0, actual: 0 };
      byCat[cat].budget += c.budget_amount || 0;
      byCat[cat].actual += Math.max(c.actual_amount || 0, c.committed_amount || 0);
    });
    Object.entries(byCat).forEach(([category, { budget, actual }]) => {
      if (budget > 0 && actual > budget) {
        categoryOverruns.push({ category, budget, actual, variance: ((actual - budget) / budget) * 100 });
      }
    });

    // Change order cumulative impact
    const coImpact = changeOrders
      .filter((co: any) => co.status === 'approved' || co.status === 'implemented')
      .reduce((s: number, co: any) => s + (co.cost_impact || 0), 0);

    // Alert: Overall cost variance > 5%
    if (costVariance > 10) {
      alerts.push({ level: 'critical', title: 'Critical Cost Overrun', message: `Total costs exceed budget by ${fmtPct(costVariance)}. Actual: ${fmt(totalActualCost)} vs Budget: ${fmt(totalBudget)}.`, action: 'Immediate cost review meeting. Freeze non-critical procurement. Evaluate scope reduction options.', metric: `+${fmtPct(costVariance)}` });
    } else if (costVariance > 5) {
      alerts.push({ level: 'warning', title: 'Cost Variance Warning', message: `Costs trending ${fmtPct(costVariance)} above budget. Early intervention recommended.`, action: 'Review uncommitted costs. Negotiate supplier discounts. Reassess contingency allocation.', metric: `+${fmtPct(costVariance)}` });
    }

    // Alert: Margin erosion
    if (contractValue > 0 && marginTarget > 0) {
      if (marginDeviation < -10) {
        alerts.push({ level: 'critical', title: 'Margin Collapse Risk', message: `Projected margin (${fmtPct(projectedMargin)}) is ${fmtPct(Math.abs(marginDeviation))} below target (${fmtPct(marginTarget)}).`, action: 'Escalate to management. Consider change order to customer for additional scope costs. Review all remaining spend.', metric: `${fmtPct(projectedMargin)}` });
      } else if (marginDeviation < -5) {
        alerts.push({ level: 'warning', title: 'Margin Under Pressure', message: `Projected margin at ${fmtPct(projectedMargin)} vs target ${fmtPct(marginTarget)}.`, action: 'Identify cost savings in remaining phases. Defer non-essential activities. Consider value engineering.', metric: `${fmtPct(projectedMargin)}` });
      } else if (marginDeviation >= 0 && contractValue > 0 && totalActualCost > 0) {
        alerts.push({ level: 'info', title: 'Margin On Track', message: `Projected margin at ${fmtPct(projectedMargin)}, meeting or exceeding target of ${fmtPct(marginTarget)}.`, action: 'Continue monitoring. Consider investing savings into quality improvements.', metric: `${fmtPct(projectedMargin)}` });
      }
    }

    // Alert: Category-specific overruns
    categoryOverruns.sort((a, b) => b.variance - a.variance);
    categoryOverruns.slice(0, 2).forEach(ov => {
      alerts.push({
        level: ov.variance > 20 ? 'critical' : 'warning',
        title: `${ov.category.charAt(0).toUpperCase() + ov.category.slice(1)} Over Budget`,
        message: `${ov.category} costs at ${fmt(ov.actual)} vs budget ${fmt(ov.budget)} (+${fmtPct(ov.variance)}).`,
        action: ov.category === 'engineering' ? 'Audit engineering hours. Check for scope creep in design phase.' :
          ov.category === 'procurement' ? 'Review supplier quotes. Consider alternative sources or bulk negotiation.' :
          ov.category === 'labor' ? 'Optimize crew allocation. Reduce overtime. Evaluate subcontracting options.' :
          `Review ${ov.category} spending and identify reduction opportunities.`,
        metric: `+${fmtPct(ov.variance)}`,
      });
    });

    // Alert: Change order impact
    if (coImpact > 0 && contractValue > 0) {
      const coAsPercent = (coImpact / contractValue) * 100;
      if (coAsPercent > 5) {
        alerts.push({ level: 'warning', title: 'Significant Change Order Impact', message: `Approved change orders add ${fmt(coImpact)} (${fmtPct(coAsPercent)} of contract value).`, action: 'Ensure all change orders are billed to customer. Update project baseline budget.', metric: fmt(coImpact) });
      }
    }

    // Alert: Committed but not spent (exposure)
    if (totalCommitted > totalActualCost && totalBudget > 0) {
      const exposureGap = totalCommitted - totalActualCost;
      if (exposureGap > totalBudget * 0.1) {
        alerts.push({ level: 'info', title: 'High Committed Exposure', message: `${fmt(exposureGap)} committed but not yet invoiced. Ensure cash flow planning accounts for these commitments.`, action: 'Verify PO status with suppliers. Update cash flow forecast.', metric: fmt(totalCommitted) });
      }
    }

    return alerts;
  }, [costs, selectedProject, changeOrders, costVariance, totalBudget, totalActualCost, totalCommitted]);

  if (!activeCompanyId) return <div className="p-8 text-center text-muted-foreground">Select a company to manage projects.</div>;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2 flex items-center gap-2">
          <FolderKanban className="h-6 w-6 text-primary" /> Project Execution Control
        </h2>
        <p className="text-muted-foreground">Transform commercial inputs into structured, controlled execution plans with financial discipline and gate-based governance.</p>
      </div>

      {/* Project Selector */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-foreground">Projects:</span>
            {projects.map(p => (
              <Button key={p.id} variant={selectedProject?.id === p.id ? 'default' : 'outline'} size="sm"
                onClick={() => setSelectedProject(p)} className="gap-1.5">
                <span className={`w-2 h-2 rounded-full ${p.status === 'active' ? 'bg-green-500' : p.status === 'completed' ? 'bg-blue-500' : 'bg-muted-foreground'}`} />
                {p.title || p.project_number || 'Untitled'}
              </Button>
            ))}
            <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1"><Plus className="h-3 w-3" /> New Project</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Project Number</label>
                    <Input value={newProject.project_number} onChange={e => setNewProject({ ...newProject, project_number: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Title</label>
                    <Input value={newProject.title} onChange={e => setNewProject({ ...newProject, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Customer</label>
                    <Input value={newProject.customer_name} onChange={e => setNewProject({ ...newProject, customer_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Contract Value (€)</label>
                    <Input type="number" value={newProject.contract_value} onChange={e => setNewProject({ ...newProject, contract_value: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Project Type</label>
                    <Select value={newProject.project_type} onValueChange={v => setNewProject({ ...newProject, project_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Complexity</label>
                    <Select value={newProject.complexity} onValueChange={v => setNewProject({ ...newProject, complexity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{COMPLEXITY_LEVELS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Scope of Supply</label>
                    <Textarea value={newProject.scope_of_supply} onChange={e => setNewProject({ ...newProject, scope_of_supply: e.target.value })} rows={3} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Deliverables</label>
                    <Textarea value={newProject.deliverables} onChange={e => setNewProject({ ...newProject, deliverables: e.target.value })} rows={2} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Payment Terms</label>
                    <Input value={newProject.payment_terms} onChange={e => setNewProject({ ...newProject, payment_terms: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Incoterms</label>
                    <Input value={newProject.incoterms} onChange={e => setNewProject({ ...newProject, incoterms: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Delivery Deadline</label>
                    <Input type="date" value={newProject.delivery_deadline} onChange={e => setNewProject({ ...newProject, delivery_deadline: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Planned Start</label>
                    <Input type="date" value={newProject.planned_start} onChange={e => setNewProject({ ...newProject, planned_start: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={saveProject} className="gap-1"><Save className="h-4 w-4" /> Create Project</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {!selectedProject ? (
        <Card><CardContent className="py-16 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-2">Select or Create a Project</h3>
          <p className="text-sm text-muted-foreground">Choose an existing project or create a new one to access the execution control panel.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* Project Header */}
          <Card className="mb-6">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedProject.title || 'Untitled'}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                    <span>{selectedProject.customer_name}</span>
                    <Badge variant="outline">{selectedProject.project_type}</Badge>
                    <Badge variant={selectedProject.complexity === 'high' ? 'destructive' : 'secondary'}>{selectedProject.complexity} complexity</Badge>
                    <Badge variant={selectedProject.risk_level === 'high' ? 'destructive' : 'secondary'}>{selectedProject.risk_level} risk</Badge>
                    <Badge variant={STATUS_VARIANT(selectedProject.status) as any}>{selectedProject.status}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-center px-3">
                    <p className={`text-2xl font-bold ${HEALTH_COLOR(selectedProject.health_score || 0)}`}>{selectedProject.health_score || '—'}</p>
                    <p className="text-[10px] text-muted-foreground">Health</p>
                  </div>
                  <Separator orientation="vertical" className="h-10" />
                  <div className="text-center px-3">
                    <p className="text-lg font-bold text-foreground">{fmt(selectedProject.contract_value || 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Contract Value</p>
                  </div>
                  <Button onClick={() => runAIAnalysis('initial_analysis')} disabled={analyzing} variant="default" size="sm" className="gap-1.5">
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                    {phases.length > 0 ? 'Re-analyze' : 'Generate Plan'}
                  </Button>
                  <Button onClick={() => runAIAnalysis('health_check')} disabled={analyzing || phases.length === 0} variant="outline" size="sm" className="gap-1.5">
                    <Gauge className="h-4 w-4" /> Health Check
                  </Button>
                  <Button onClick={() => deleteProject(selectedProject.id)} variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Input for initial analysis */}
          {phases.length === 0 && (
            <Card className="mb-6 border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" /> Project Input (Paste contract, emails, scope documents)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={projectInput} onChange={e => setProjectInput(e.target.value)}
                  placeholder="Paste your contract summary, scope of supply, technical specifications, payment terms, delivery conditions... The AI will analyze and generate a full execution plan."
                  rows={8} />
                <div className="flex justify-end mt-3">
                  <Button onClick={() => runAIAnalysis('initial_analysis')} disabled={analyzing} className="gap-1.5">
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Analyze & Generate Execution Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="overview" className="gap-1"><BarChart3 className="h-3 w-3" /> Dashboard</TabsTrigger>
              <TabsTrigger value="phases" className="gap-1"><ArrowRight className="h-3 w-3" /> Phases</TabsTrigger>
              <TabsTrigger value="milestones" className="gap-1"><Target className="h-3 w-3" /> Milestones</TabsTrigger>
              <TabsTrigger value="gates" className="gap-1"><Shield className="h-3 w-3" /> Gates</TabsTrigger>
              <TabsTrigger value="financials" className="gap-1"><DollarSign className="h-3 w-3" /> Financials</TabsTrigger>
              <TabsTrigger value="risks" className="gap-1"><AlertTriangle className="h-3 w-3" /> Risks</TabsTrigger>
              <TabsTrigger value="intelligence" className="gap-1"><Brain className="h-3 w-3" /> Intelligence</TabsTrigger>
              <TabsTrigger value="changes" className="gap-1"><GitBranch className="h-3 w-3" /> Changes{changeOrders.length > 0 ? ` (${changeOrders.length})` : ''}</TabsTrigger>
              <TabsTrigger value="simulation" className="gap-1"><Zap className="h-3 w-3" /> Simulation</TabsTrigger>
            </TabsList>

            {/* DASHBOARD */}
            <TabsContent value="overview">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                <Card><CardContent className="pt-4 pb-4 text-center">
                  <Gauge className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className={`text-2xl font-bold ${HEALTH_COLOR(selectedProject.health_score || 0)}`}>{selectedProject.health_score || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Health Score</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center">
                  <Activity className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold text-foreground">{fmtPct(overallProgress)}</p>
                  <p className="text-[10px] text-muted-foreground">Progress</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center">
                  <CheckCircle className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold text-foreground">{completedPhases}/{phases.length}</p>
                  <p className="text-[10px] text-muted-foreground">Phases Done</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center">
                  <Shield className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold text-foreground">{passedGates}/{gates.length}</p>
                  <p className="text-[10px] text-muted-foreground">Gates Passed</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center">
                  <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className={`text-2xl font-bold ${costVariance > 5 ? 'text-destructive' : 'text-foreground'}`}>{costVariance !== 0 ? `${costVariance > 0 ? '+' : ''}${fmtPct(costVariance)}` : '—'}</p>
                  <p className="text-[10px] text-muted-foreground">Cost Variance</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center">
                  <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className={`text-2xl font-bold ${openRisks > 3 ? 'text-destructive' : 'text-foreground'}`}>{openRisks}</p>
                  <p className="text-[10px] text-muted-foreground">Open Risks</p>
                </CardContent></Card>
              </div>

              {/* Progress bar */}
              <Card className="mb-6">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Overall Project Progress</span>
                    <span className="text-sm text-muted-foreground">{fmtPct(overallProgress)}</span>
                  </div>
                  <Progress value={overallProgress} className="mb-3" />
                  <div className="flex gap-1">
                    {phases.map(p => (
                      <div key={p.id} className="flex-1 relative group" title={`${p.phase_name}: ${p.completion_pct || 0}%`}>
                        <div className={`h-2 rounded-sm ${p.status === 'completed' ? 'bg-primary' : p.status === 'in-progress' ? 'bg-primary/50' : p.status === 'blocked' ? 'bg-destructive/50' : 'bg-muted'}`} />
                        <p className="text-[8px] text-muted-foreground mt-0.5 truncate">{p.phase_name}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Revenue tracking */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Control</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Contract Value</span><span className="font-medium text-foreground">{fmt(selectedProject.contract_value || 0)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Invoiced</span><span className="font-medium text-foreground">{fmt(invoiced)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-medium text-primary">{fmt(paid)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="font-medium text-destructive">{fmt(invoiced - paid)}</span></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Cost Control</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-medium text-foreground">{fmt(totalBudget)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Actual</span><span className={`font-medium ${totalActualCost > totalBudget ? 'text-destructive' : 'text-foreground'}`}>{fmt(totalActualCost)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Margin Target</span><span className="font-medium text-foreground">{fmtPct(selectedProject.margin_target || 0)}</span></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Gate Status</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex gap-1.5 flex-wrap">
                      {gates.map(g => (
                        <div key={g.id} className={`px-2 py-1 rounded text-[10px] font-medium border ${g.status === 'passed' ? 'bg-primary/10 border-primary/30 text-primary' : g.status === 'failed' ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-muted border-border text-muted-foreground'}`}>
                          {g.gate_number}
                        </div>
                      ))}
                    </div>
                    {gates.length === 0 && <p className="text-xs text-muted-foreground">Run AI analysis to generate gates</p>}
                  </CardContent>
                </Card>
              </div>

              {/* Margin Deviation Alerts */}
              {marginAlerts.length > 0 && (
                <Card className={`mb-6 ${marginAlerts.some(a => a.level === 'critical') ? 'border-destructive/50' : marginAlerts.some(a => a.level === 'warning') ? 'border-yellow-500/50' : 'border-primary/30'}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {marginAlerts.some(a => a.level === 'critical') ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : marginAlerts.some(a => a.level === 'warning') ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-primary" />
                      )}
                      Margin & Cost Deviation Alerts
                      {marginAlerts.filter(a => a.level === 'critical').length > 0 && (
                        <Badge variant="destructive" className="text-[10px] ml-1">{marginAlerts.filter(a => a.level === 'critical').length} Critical</Badge>
                      )}
                      {marginAlerts.filter(a => a.level === 'warning').length > 0 && (
                        <Badge variant="secondary" className="text-[10px] ml-1">{marginAlerts.filter(a => a.level === 'warning').length} Warning</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {marginAlerts.map((alert, i) => (
                        <div key={i} className={`rounded-lg border p-3 ${
                          alert.level === 'critical' ? 'border-destructive/40 bg-destructive/5' :
                          alert.level === 'warning' ? 'border-yellow-500/40 bg-yellow-500/5' :
                          'border-primary/30 bg-primary/5'
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {alert.level === 'critical' && <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />}
                                {alert.level === 'warning' && <span className="w-2 h-2 rounded-full bg-yellow-500" />}
                                {alert.level === 'info' && <span className="w-2 h-2 rounded-full bg-primary" />}
                                <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{alert.message}</p>
                              <div className="flex items-start gap-1.5">
                                <Lightbulb className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-primary font-medium">{alert.action}</p>
                              </div>
                            </div>
                            <div className={`text-right px-3 py-1 rounded-md ${
                              alert.level === 'critical' ? 'bg-destructive/10' :
                              alert.level === 'warning' ? 'bg-yellow-500/10' : 'bg-primary/10'
                            }`}>
                              <p className={`text-lg font-bold ${
                                alert.level === 'critical' ? 'text-destructive' :
                                alert.level === 'warning' ? 'text-yellow-600' : 'text-primary'
                              }`}>{alert.metric}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Executive Summary */}
              {aiAnalysis.executiveSummary && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Executive Summary</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{aiAnalysis.executiveSummary}</p></CardContent>
                </Card>
              )}
            </TabsContent>

            {/* PHASES */}
            <TabsContent value="phases">
              {phases.length === 0 ? (
                <Card><CardContent className="py-12 text-center">
                  <ArrowRight className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">No Phases Defined</h3>
                  <p className="text-sm text-muted-foreground mb-4">Run AI analysis to auto-generate the execution phases.</p>
                  <Button onClick={() => runAIAnalysis('initial_analysis')} disabled={analyzing} className="gap-1.5">
                    <Brain className="h-4 w-4" /> Generate Execution Plan
                  </Button>
                </CardContent></Card>
              ) : (
                <div className="space-y-4">
                  {/* Gantt Chart */}
                  <GanttChart phases={phases} gates={gates} projectStart={selectedProject.planned_start} projectEnd={selectedProject.planned_end} />

                  {/* Phase list */}
                  <div className="space-y-3">
                    {phases.map(phase => (
                      <Card key={phase.id}>
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px]">Phase {phase.phase_number}</Badge>
                                <span className="font-medium text-foreground">{phase.phase_name}</span>
                                <Badge variant={STATUS_VARIANT(phase.status) as any} className="text-[10px]">{phase.status}</Badge>
                                {phase.responsible && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{phase.responsible}</span>}
                              </div>
                              {phase.description && <p className="text-xs text-muted-foreground mb-2">{phase.description}</p>}
                              <div className="flex items-center gap-2 mb-2">
                                <Progress value={phase.completion_pct || 0} className="flex-1 h-2" />
                                <span className="text-xs text-muted-foreground">{fmtPct(phase.completion_pct || 0)}</span>
                              </div>
                              {phase.key_tasks?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {(phase.key_tasks as string[]).map((t: string, i: number) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{t}</span>
                                  ))}
                                </div>
                              )}
                              {phase.budget > 0 && <span className="text-xs text-muted-foreground">Budget: {fmt(phase.budget)}{phase.actual_cost > 0 ? ` | Actual: ${fmt(phase.actual_cost)}` : ''}</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <Select value={phase.status} onValueChange={v => updatePhaseStatus(phase.id, v, v === 'completed' ? 100 : phase.completion_pct)}>
                                <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>{PHASE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* MILESTONES */}
            <TabsContent value="milestones">
              {milestones.length === 0 ? (
                <Card><CardContent className="py-12 text-center">
                  <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">No Milestones</h3>
                  <p className="text-sm text-muted-foreground">Run AI analysis to generate milestones.</p>
                </CardContent></Card>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Gate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {milestones.map(ms => (
                      <TableRow key={ms.id}>
                        <TableCell><Badge variant="outline" className="text-[10px]">{ms.milestone_type}</Badge></TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-foreground">{ms.title}</span>
                          {ms.description && <p className="text-[10px] text-muted-foreground">{ms.description}</p>}
                        </TableCell>
                        <TableCell>{ms.payment_amount > 0 ? <span className="text-sm font-medium">{fmt(ms.payment_amount)} ({fmtPct(ms.payment_pct)})</span> : '—'}</TableCell>
                        <TableCell>{ms.gate_id || '—'}</TableCell>
                        <TableCell><Badge variant={STATUS_VARIANT(ms.status) as any} className="text-[10px]">{ms.status}</Badge></TableCell>
                        <TableCell>
                          <Select value={ms.status} onValueChange={v => updateMilestoneStatus(ms.id, v)}>
                            <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">pending</SelectItem>
                              <SelectItem value="in-progress">in-progress</SelectItem>
                              <SelectItem value="completed">completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* GATES */}
            <TabsContent value="gates">
              {gates.length === 0 ? (
                <Card><CardContent className="py-12 text-center">
                  <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">No Control Gates</h3>
                  <p className="text-sm text-muted-foreground">Run AI analysis to generate G0-G6 control gates.</p>
                </CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {gates.map(gate => (
                    <Card key={gate.id} className={gate.status === 'passed' ? 'border-primary/30' : gate.status === 'failed' ? 'border-destructive/30' : ''}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Shield className={`h-4 w-4 ${gate.status === 'passed' ? 'text-primary' : 'text-muted-foreground'}`} />
                            {gate.gate_number}: {gate.gate_name}
                          </CardTitle>
                          <Select value={gate.status} onValueChange={v => updateGateStatus(gate.id, v)}>
                            <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">pending</SelectItem>
                              <SelectItem value="passed">passed</SelectItem>
                              <SelectItem value="failed">failed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {gate.description && <p className="text-xs text-muted-foreground mb-2">{gate.description}</p>}
                        {gate.required_inputs?.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">Required Inputs:</p>
                            <div className="flex flex-wrap gap-1">
                              {(gate.required_inputs as string[]).map((inp: string, i: number) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{inp}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {gate.risks_if_not_passed && (
                          <div className="text-[10px] text-destructive mt-1">
                            <AlertTriangle className="h-3 w-3 inline mr-1" />Risk if not passed: {gate.risks_if_not_passed}
                          </div>
                        )}
                        {gate.responsible && <p className="text-[10px] text-muted-foreground mt-1">Responsible: {gate.responsible}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* FINANCIALS */}
            <TabsContent value="financials">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card><CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Total Budget</p>
                  <p className="text-xl font-bold text-foreground">{fmt(totalBudget)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Actual Costs</p>
                  <p className={`text-xl font-bold ${totalActualCost > totalBudget ? 'text-destructive' : 'text-foreground'}`}>{fmt(totalActualCost)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Projected Margin</p>
                  <p className="text-xl font-bold text-foreground">{selectedProject.contract_value > 0 ? fmtPct(((selectedProject.contract_value - totalActualCost) / selectedProject.contract_value) * 100) : '—'}</p>
                </CardContent></Card>
              </div>

              {costs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Line Item</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.map(c => {
                      const variance = c.budget_amount > 0 ? ((c.actual_amount - c.budget_amount) / c.budget_amount) * 100 : 0;
                      return (
                        <TableRow key={c.id}>
                          <TableCell><Badge variant="outline" className="text-[10px]">{c.category}</Badge></TableCell>
                          <TableCell className="text-sm text-foreground">{c.line_item}</TableCell>
                          <TableCell className="text-right text-sm">{fmt(c.budget_amount || 0)}</TableCell>
                          <TableCell className="text-right text-sm">{fmt(c.actual_amount || 0)}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${variance > 5 ? 'text-destructive' : variance < -5 ? 'text-primary' : 'text-foreground'}`}>{variance !== 0 ? `${variance > 0 ? '+' : ''}${fmtPct(variance)}` : '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{c.status}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <Card><CardContent className="py-12 text-center">
                  <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">No Cost Breakdown</h3>
                  <p className="text-sm text-muted-foreground">Run AI analysis to generate cost structure.</p>
                </CardContent></Card>
              )}

              {/* Invoicing schedule from milestones */}
              {paymentMilestones.length > 0 && (
                <Card className="mt-6">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Invoicing Schedule</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Milestone</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead>Invoiced</TableHead>
                          <TableHead>Paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentMilestones.map(ms => (
                          <TableRow key={ms.id}>
                            <TableCell className="text-sm text-foreground">{ms.title}</TableCell>
                            <TableCell className="text-right text-sm">{fmt(ms.payment_amount)}</TableCell>
                            <TableCell className="text-right text-sm">{fmtPct(ms.payment_pct)}</TableCell>
                            <TableCell>{ms.is_invoiced ? <CheckCircle className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-muted-foreground" />}</TableCell>
                            <TableCell>{ms.is_paid ? <CheckCircle className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-muted-foreground" />}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* RISKS */}
            <TabsContent value="risks">
              {risks.length === 0 ? (
                <Card><CardContent className="py-12 text-center">
                  <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">No Risks Identified</h3>
                  <p className="text-sm text-muted-foreground">Run AI analysis to generate risk register.</p>
                </CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {risks.map(risk => (
                    <Card key={risk.id} className={risk.probability === 'high' && risk.impact === 'high' ? 'border-destructive/30' : ''}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <AlertTriangle className={`h-4 w-4 ${risk.probability === 'high' ? 'text-destructive' : risk.probability === 'medium' ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                              <span className="font-medium text-foreground">{risk.risk_title}</span>
                              <Badge variant="outline" className="text-[10px]">{risk.category}</Badge>
                              <Badge variant={risk.status === 'mitigated' ? 'default' : risk.status === 'open' ? 'destructive' : 'secondary'} className="text-[10px]">{risk.status}</Badge>
                            </div>
                            {risk.description && <p className="text-xs text-muted-foreground mb-2">{risk.description}</p>}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-1">
                              <span>Probability: <strong className="text-foreground">{risk.probability}</strong></span>
                              <span>Impact: <strong className="text-foreground">{risk.impact}</strong></span>
                              {risk.risk_score > 0 && <span>Score: <strong className="text-foreground">{risk.risk_score}</strong></span>}
                              {risk.owner && <span>Owner: <strong className="text-foreground">{risk.owner}</strong></span>}
                            </div>
                            {risk.mitigation_action && (
                              <div className="text-xs mt-1">
                                <span className="text-muted-foreground">Mitigation: </span>
                                <span className="text-foreground">{risk.mitigation_action}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* INTELLIGENCE */}
            <TabsContent value="intelligence">
              {aiAnalysis.executiveSummary ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> AI Executive Summary</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{aiAnalysis.executiveSummary}</p></CardContent>
                  </Card>

                  {aiAnalysis.criticalPath?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Critical Path</CardTitle></CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {(aiAnalysis.criticalPath as string[]).map((item: string, i: number) => (
                            <div key={i} className="flex items-center gap-1.5">
                              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                              <span className="text-xs px-2 py-1 bg-primary/10 rounded text-primary font-medium">{item}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {aiAnalysis.changeManagementNotes && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Change Management</CardTitle></CardHeader>
                      <CardContent><p className="text-sm text-muted-foreground">{aiAnalysis.changeManagementNotes}</p></CardContent>
                    </Card>
                  )}

                  {/* Health check alerts */}
                  {aiAnalysis.alerts?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Alerts</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {(aiAnalysis.alerts as any[]).map((alert: any, i: number) => (
                            <div key={i} className={`p-2 rounded text-xs border ${alert.severity === 'critical' ? 'bg-destructive/5 border-destructive/30' : alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800' : 'bg-muted border-border'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px]">{alert.severity}</Badge>
                                <span className="font-medium text-foreground">{alert.area}</span>
                              </div>
                              <p className="text-muted-foreground">{alert.message}</p>
                              {alert.recommendedAction && <p className="text-primary mt-1">→ {alert.recommendedAction}</p>}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {aiAnalysis.recommendations?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Recommendations</CardTitle></CardHeader>
                      <CardContent>
                        <ul className="space-y-1">
                          {(aiAnalysis.recommendations as string[]).map((rec: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card><CardContent className="py-12 text-center">
                  <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">No AI Analysis Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Generate an execution plan or run a health check to see AI insights.</p>
                </CardContent></Card>
              )}
            </TabsContent>
            {/* CHANGE ORDERS */}
            <TabsContent value="changes">
              <div className="space-y-4">
                {/* Summary KPIs */}
                {changeOrders.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card><CardContent className="pt-3 pb-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{changeOrders.length}</p>
                      <p className="text-[10px] text-muted-foreground">Total Changes</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-3 pb-3 text-center">
                      <p className={`text-2xl font-bold ${changeOrders.reduce((s: number, c: any) => s + (c.cost_impact || 0), 0) > 0 ? 'text-destructive' : 'text-primary'}`}>
                        {fmt(changeOrders.reduce((s: number, c: any) => s + (c.cost_impact || 0), 0))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Total Cost Impact</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-3 pb-3 text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {changeOrders.reduce((s: number, c: any) => s + (c.schedule_impact_days || 0), 0)}d
                      </p>
                      <p className="text-[10px] text-muted-foreground">Schedule Impact</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-3 pb-3 text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {changeOrders.filter((c: any) => c.status === 'pending').length}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Pending Approval</p>
                    </CardContent></Card>
                  </div>
                )}

                {/* New Change Order Form */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" /> Change Orders</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => setShowNewCO(!showNewCO)} className="gap-1">
                        <Plus className="h-3 w-3" /> New Change Order
                      </Button>
                    </div>
                  </CardHeader>
                  {showNewCO && (
                    <CardContent className="border-t pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">CO Number</label>
                          <Input value={newCO.change_order_number} onChange={e => setNewCO({ ...newCO, change_order_number: e.target.value })} placeholder="CO-001" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Title</label>
                          <Input value={newCO.title} onChange={e => setNewCO({ ...newCO, title: e.target.value })} placeholder="Change description" />
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs font-medium text-muted-foreground">Description</label>
                          <Textarea value={newCO.description} onChange={e => setNewCO({ ...newCO, description: e.target.value })} rows={2} placeholder="Detailed scope change description, justification, and affected areas..." />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Category</label>
                          <Select value={newCO.category} onValueChange={v => setNewCO({ ...newCO, category: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scope">Scope</SelectItem>
                              <SelectItem value="schedule">Schedule</SelectItem>
                              <SelectItem value="cost">Cost</SelectItem>
                              <SelectItem value="technical">Technical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Priority</label>
                          <Select value={newCO.priority} onValueChange={v => setNewCO({ ...newCO, priority: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Requested By</label>
                          <Input value={newCO.requested_by} onChange={e => setNewCO({ ...newCO, requested_by: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Cost Impact (€)</label>
                          <Input type="number" value={newCO.cost_impact} onChange={e => setNewCO({ ...newCO, cost_impact: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Schedule Impact (days)</label>
                          <Input type="number" value={newCO.schedule_impact_days} onChange={e => setNewCO({ ...newCO, schedule_impact_days: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Risk Impact</label>
                          <Select value={newCO.risk_impact} onValueChange={v => setNewCO({ ...newCO, risk_impact: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-end mt-3">
                        <Button size="sm" onClick={async () => {
                          if (!selectedProject || !newCO.title) return;
                          const { error } = await supabase.from('change_orders').insert({
                            ...newCO, project_id: selectedProject.id,
                          });
                          if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
                          toast({ title: 'Change order created' });
                          setShowNewCO(false);
                          setNewCO({ change_order_number: '', title: '', description: '', category: 'scope', priority: 'medium', requested_by: '', cost_impact: 0, schedule_impact_days: 0, margin_impact_pct: 0, risk_impact: 'none' });
                          loadProjectDetails(selectedProject.id);
                        }} className="gap-1"><Save className="h-3 w-3" /> Save Change Order</Button>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Change Orders Table */}
                {changeOrders.length === 0 ? (
                  <Card><CardContent className="py-12 text-center">
                    <GitBranch className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold text-foreground mb-2">No Change Orders</h3>
                    <p className="text-sm text-muted-foreground">Create change orders to track scope modifications and their impact.</p>
                  </CardContent></Card>
                ) : (
                  <Card>
                    <CardContent className="pt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">CO #</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Cost Impact</TableHead>
                            <TableHead>Days</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {changeOrders.map((co: any) => (
                            <TableRow key={co.id}>
                              <TableCell className="font-mono text-xs">{co.change_order_number || '—'}</TableCell>
                              <TableCell>
                                <span className="text-sm font-medium text-foreground">{co.title}</span>
                                {co.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{co.description}</p>}
                                {co.requested_by && <p className="text-[10px] text-muted-foreground">By: {co.requested_by}</p>}
                              </TableCell>
                              <TableCell><Badge variant="outline" className="text-[10px]">{co.category}</Badge></TableCell>
                              <TableCell>
                                <Badge variant={co.priority === 'critical' ? 'destructive' : co.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                                  {co.priority}
                                </Badge>
                              </TableCell>
                              <TableCell className={`text-sm font-medium ${(co.cost_impact || 0) > 0 ? 'text-destructive' : (co.cost_impact || 0) < 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                                {co.cost_impact ? fmt(co.cost_impact) : '—'}
                              </TableCell>
                              <TableCell className={`text-sm ${(co.schedule_impact_days || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {co.schedule_impact_days ? `+${co.schedule_impact_days}d` : '—'}
                              </TableCell>
                              <TableCell>
                                <Select value={co.status} onValueChange={async (v) => {
                                  const updates: any = { status: v };
                                  if (v === 'approved') { updates.approved_date = new Date().toISOString().split('T')[0]; }
                                  await supabase.from('change_orders').update(updates).eq('id', co.id);
                                  loadProjectDetails(selectedProject.id);
                                }}>
                                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="implemented">Implemented</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={async () => {
                                  await supabase.from('change_orders').delete().eq('id', co.id);
                                  loadProjectDetails(selectedProject.id);
                                }}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* DELAY IMPACT SIMULATION */}
            <TabsContent value="simulation">
              <DelaySimulation phases={phases} milestones={milestones} gates={gates} project={selectedProject} />
            </TabsContent>

          </Tabs>
        </>
      )}
    </div>
  );
}
