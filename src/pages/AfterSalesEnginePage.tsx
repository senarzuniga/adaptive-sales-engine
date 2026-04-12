import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
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
import { Switch } from '@/components/ui/switch';
import {
  Wrench, Plus, Trash2, Brain, TrendingUp, AlertTriangle, Shield, Settings,
  DollarSign, BarChart3, Lightbulb, Save, Loader2, Radio, Cpu, Package,
  Calendar, Users, Activity, Target, Zap, Eye, ArrowUpRight, RefreshCw
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const LIFECYCLE_STAGES = ['commissioning', 'active', 'mid-life', 'end-of-life'];
const CONNECTION_STATUSES = ['connected', 'registered', 'unknown'];
const VALUE_SEGMENTS = ['premium', 'standard', 'basic'];
const RISK_LEVELS = ['high', 'medium', 'low'];
const CONTRACT_TYPES = ['basic', 'advanced', 'premium', 'full-care', 'pay-per-use'];
const INTERVENTION_TYPES = ['reactive', 'preventive', 'predictive', 'remote', 'ar-assisted'];

export default function AfterSalesEnginePage() {
  const { language } = useLanguage();
  const { activeCompanyId } = useData();
  const isEs = language === 'es';

  const [activeTab, setActiveTab] = useState('dashboard');
  const [assets, setAssets] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [showInterventionForm, setShowInterventionForm] = useState(false);

  // Form states
  const [assetForm, setAssetForm] = useState({ serial_number: '', asset_name: '', asset_type: 'machine', customer_name: '', location: '', country: '', region: '', lifecycle_stage: 'active', connection_status: 'registered', usage_intensity: 'normal', customer_value_segment: 'standard', risk_level: 'medium', notes: '' });
  const [contractForm, setContractForm] = useState({ contract_type: 'basic', contract_name: '', customer_name: '', annual_value: 0, recurring_revenue_type: 'subscription', status: 'active', sla_response_hours: 24, includes_parts: false, includes_remote: false, includes_predictive: false, notes: '', asset_id: '' });
  const [interventionForm, setInterventionForm] = useState({ intervention_type: 'reactive', description: '', technician: '', duration_hours: 0, cost: 0, resolution: '', was_remote: false, notes: '', asset_id: '' });

  const loadData = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const [a, c, i, o] = await Promise.all([
        supabase.from('installed_base_assets').select('*').eq('company_id', activeCompanyId).order('created_at', { ascending: false }),
        supabase.from('service_contracts').select('*').eq('company_id', activeCompanyId).order('created_at', { ascending: false }),
        supabase.from('service_interventions').select('*').eq('company_id', activeCompanyId).order('created_at', { ascending: false }),
        supabase.from('after_sales_opportunities').select('*').eq('company_id', activeCompanyId).order('created_at', { ascending: false }),
      ]);
      if (a.data) setAssets(a.data);
      if (c.data) setContracts(c.data);
      if (i.data) setInterventions(i.data);
      if (o.data) setOpportunities(o.data);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveAsset = async () => {
    if (!activeCompanyId) return;
    const { error } = await supabase.from('installed_base_assets').insert({ ...assetForm, company_id: activeCompanyId });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: isEs ? 'Activo registrado' : 'Asset registered' });
    setShowAssetForm(false);
    setAssetForm({ serial_number: '', asset_name: '', asset_type: 'machine', customer_name: '', location: '', country: '', region: '', lifecycle_stage: 'active', connection_status: 'registered', usage_intensity: 'normal', customer_value_segment: 'standard', risk_level: 'medium', notes: '' });
    loadData();
  };

  const saveContract = async () => {
    if (!activeCompanyId) return;
    const payload: any = { ...contractForm, company_id: activeCompanyId };
    if (!payload.asset_id) delete payload.asset_id;
    const { error } = await supabase.from('service_contracts').insert(payload);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: isEs ? 'Contrato guardado' : 'Contract saved' });
    setShowContractForm(false);
    loadData();
  };

  const saveIntervention = async () => {
    if (!activeCompanyId) return;
    const payload: any = { ...interventionForm, company_id: activeCompanyId };
    if (!payload.asset_id) delete payload.asset_id;
    const { error } = await supabase.from('service_interventions').insert(payload);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: isEs ? 'Intervención registrada' : 'Intervention recorded' });
    setShowInterventionForm(false);
    loadData();
  };

  const deleteAsset = async (id: string) => {
    await supabase.from('installed_base_assets').delete().eq('id', id);
    loadData();
  };

  const runDiagnostic = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('after-sales-intelligence', {
        body: { assets, contracts, interventions, analysisType: 'full_diagnostic' },
      });
      if (error) throw error;
      if (data?.analysis) {
        setDiagnosis(data.analysis);
        // Save AI-generated opportunities
        if (data.analysis.revenueOpportunities?.length > 0 && activeCompanyId) {
          const opps = data.analysis.revenueOpportunities.slice(0, 10).map((o: any) => ({
            company_id: activeCompanyId,
            opportunity_type: o.type || 'upsell',
            title: o.title,
            description: o.description,
            estimated_value: o.estimatedValue || 0,
            probability: o.probability || 50,
            trigger_signal: o.triggerSignal || '',
            recommended_action: o.recommendedAction || '',
            status: 'identified',
            ai_generated: true,
          }));
          await supabase.from('after_sales_opportunities').insert(opps);
          loadData();
        }
        setActiveTab('intelligence');
        toast({ title: isEs ? 'Diagnóstico completado' : 'Diagnostic complete' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  // Dashboard metrics
  const totalAssets = assets.length;
  const connectedAssets = assets.filter(a => a.connection_status === 'connected').length;
  const connectedPct = totalAssets > 0 ? (connectedAssets / totalAssets) * 100 : 0;
  const activeContracts = contracts.filter(c => c.status === 'active');
  const totalARR = activeContracts.reduce((s, c) => s + (c.annual_value || 0), 0);
  const contractPenetration = totalAssets > 0 ? (activeContracts.length / totalAssets) * 100 : 0;
  const reactiveInterventions = interventions.filter(i => i.intervention_type === 'reactive').length;
  const predictiveInterventions = interventions.filter(i => ['predictive', 'remote'].includes(i.intervention_type)).length;
  const totalInterventions = interventions.length;
  const predictiveRatio = totalInterventions > 0 ? (predictiveInterventions / totalInterventions) * 100 : 0;
  const totalOppValue = opportunities.reduce((s, o) => s + (o.estimated_value || 0), 0);

  const lifecycleCounts = LIFECYCLE_STAGES.map(s => ({ stage: s, count: assets.filter(a => a.lifecycle_stage === s).length }));
  const riskCounts = RISK_LEVELS.map(r => ({ level: r, count: assets.filter(a => a.risk_level === r).length }));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            {isEs ? 'Motor Post-Venta' : 'After-Sales Profit Engine'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isEs ? 'De centro de costes reactivo a motor de ingresos escalable y predecible' : 'From reactive cost center to scalable, predictable revenue engine'}
          </p>
        </div>
        <Button onClick={runDiagnostic} disabled={analyzing}>
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
          {isEs ? 'Diagnóstico IA Completo' : 'Full AI Diagnostic'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="installed-base">{isEs ? 'Base Instalada' : 'Installed Base'}</TabsTrigger>
          <TabsTrigger value="contracts">{isEs ? 'Contratos' : 'Contracts'}</TabsTrigger>
          <TabsTrigger value="service">{isEs ? 'Servicio' : 'Service'}</TabsTrigger>
          <TabsTrigger value="intelligence">{isEs ? 'Inteligencia' : 'Intelligence'}</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Radio className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{totalAssets}</p>
                <p className="text-xs text-muted-foreground">{isEs ? 'Activos Registrados' : 'Registered Assets'}</p>
                <p className="text-xs text-primary mt-1">{fmtPct(connectedPct)} {isEs ? 'conectados' : 'connected'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <DollarSign className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{fmt(totalARR)}</p>
                <p className="text-xs text-muted-foreground">{isEs ? 'Ingresos Recurrentes (ARR)' : 'Annual Recurring Revenue'}</p>
                <p className="text-xs text-primary mt-1">{activeContracts.length} {isEs ? 'contratos activos' : 'active contracts'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Activity className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{fmtPct(contractPenetration)}</p>
                <p className="text-xs text-muted-foreground">{isEs ? 'Penetración Contratos' : 'Contract Penetration'}</p>
                <p className="text-xs text-primary mt-1">{fmtPct(predictiveRatio)} {isEs ? 'predictivo' : 'predictive'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{fmt(totalOppValue)}</p>
                <p className="text-xs text-muted-foreground">{isEs ? 'Pipeline Oportunidades' : 'Opportunity Pipeline'}</p>
                <p className="text-xs text-primary mt-1">{opportunities.length} {isEs ? 'oportunidades' : 'opportunities'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Service Maturity + Lifecycle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />{isEs ? 'Madurez del Servicio' : 'Service Maturity'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: isEs ? 'Reactivo' : 'Reactive', count: reactiveInterventions, color: 'bg-destructive' },
                  { label: isEs ? 'Preventivo' : 'Preventive', count: interventions.filter(i => i.intervention_type === 'preventive').length, color: 'bg-yellow-500' },
                  { label: isEs ? 'Predictivo' : 'Predictive', count: interventions.filter(i => i.intervention_type === 'predictive').length, color: 'bg-primary' },
                  { label: isEs ? 'Remoto' : 'Remote', count: interventions.filter(i => i.intervention_type === 'remote' || i.was_remote).length, color: 'bg-green-500' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-sm w-24">{item.label}</span>
                    <Progress value={totalInterventions > 0 ? (item.count / totalInterventions) * 100 : 0} className="flex-1 h-2" />
                    <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                  </div>
                ))}
                {totalInterventions === 0 && <p className="text-sm text-muted-foreground text-center py-4">{isEs ? 'Sin intervenciones registradas' : 'No interventions recorded'}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4 text-primary" />{isEs ? 'Ciclo de Vida' : 'Lifecycle Distribution'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {lifecycleCounts.map(({ stage, count }) => (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-sm w-32 capitalize">{stage.replace('-', ' ')}</span>
                    <Progress value={totalAssets > 0 ? (count / totalAssets) * 100 : 0} className="flex-1 h-2" />
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                ))}
                {totalAssets === 0 && <p className="text-sm text-muted-foreground text-center py-4">{isEs ? 'Sin activos registrados' : 'No assets registered'}</p>}
              </CardContent>
            </Card>
          </div>

          {/* Top Opportunities */}
          {opportunities.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-primary" />{isEs ? 'Oportunidades Principales' : 'Top Opportunities'}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {opportunities.slice(0, 5).map(o => (
                    <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Badge variant={o.urgency === 'high' || o.ai_generated ? 'default' : 'outline'} className="text-xs">
                          {o.opportunity_type}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{o.title}</p>
                          <p className="text-xs text-muted-foreground">{o.customer_name || o.trigger_signal}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{fmt(o.estimated_value)}</p>
                        {o.ai_generated && <Badge variant="secondary" className="text-xs"><Brain className="h-3 w-3 mr-1" />AI</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* INSTALLED BASE */}
        <TabsContent value="installed-base" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{isEs ? 'Base Instalada' : 'Installed Base Registry'}</h3>
            <Dialog open={showAssetForm} onOpenChange={setShowAssetForm}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />{isEs ? 'Registrar Activo' : 'Register Asset'}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{isEs ? 'Nuevo Activo' : 'New Asset'}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium">{isEs ? 'Nº Serie' : 'Serial #'}</label><Input value={assetForm.serial_number} onChange={e => setAssetForm(p => ({ ...p, serial_number: e.target.value }))} /></div>
                  <div><label className="text-xs font-medium">{isEs ? 'Nombre' : 'Name'}</label><Input value={assetForm.asset_name} onChange={e => setAssetForm(p => ({ ...p, asset_name: e.target.value }))} /></div>
                  <div><label className="text-xs font-medium">{isEs ? 'Cliente' : 'Customer'}</label><Input value={assetForm.customer_name} onChange={e => setAssetForm(p => ({ ...p, customer_name: e.target.value }))} /></div>
                  <div><label className="text-xs font-medium">{isEs ? 'Ubicación' : 'Location'}</label><Input value={assetForm.location} onChange={e => setAssetForm(p => ({ ...p, location: e.target.value }))} /></div>
                  <div><label className="text-xs font-medium">{isEs ? 'País' : 'Country'}</label><Input value={assetForm.country} onChange={e => setAssetForm(p => ({ ...p, country: e.target.value }))} /></div>
                  <div><label className="text-xs font-medium">{isEs ? 'Región' : 'Region'}</label><Input value={assetForm.region} onChange={e => setAssetForm(p => ({ ...p, region: e.target.value }))} /></div>
                  <div>
                    <label className="text-xs font-medium">{isEs ? 'Ciclo de Vida' : 'Lifecycle'}</label>
                    <Select value={assetForm.lifecycle_stage} onValueChange={v => setAssetForm(p => ({ ...p, lifecycle_stage: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{LIFECYCLE_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">{isEs ? 'Conexión' : 'Connection'}</label>
                    <Select value={assetForm.connection_status} onValueChange={v => setAssetForm(p => ({ ...p, connection_status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CONNECTION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">{isEs ? 'Segmento Valor' : 'Value Segment'}</label>
                    <Select value={assetForm.customer_value_segment} onValueChange={v => setAssetForm(p => ({ ...p, customer_value_segment: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{VALUE_SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">{isEs ? 'Nivel Riesgo' : 'Risk Level'}</label>
                    <Select value={assetForm.risk_level} onValueChange={v => setAssetForm(p => ({ ...p, risk_level: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{RISK_LEVELS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><label className="text-xs font-medium">{isEs ? 'Notas' : 'Notes'}</label><Textarea value={assetForm.notes} onChange={e => setAssetForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
                </div>
                <Button onClick={saveAsset} className="w-full mt-3"><Save className="h-4 w-4 mr-2" />{isEs ? 'Guardar' : 'Save'}</Button>
              </DialogContent>
            </Dialog>
          </div>

          {/* Risk segmentation summary */}
          {assets.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {riskCounts.map(({ level, count }) => (
                <Card key={level} className={level === 'high' ? 'border-destructive/50' : level === 'medium' ? 'border-yellow-500/50' : 'border-green-500/50'}>
                  <CardContent className="pt-4 text-center">
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground capitalize">{isEs ? 'Riesgo' : 'Risk'} {level}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="pt-4">
              {assets.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{isEs ? 'Sin activos registrados. Registra tu base instalada para activar el motor.' : 'No assets registered. Register your installed base to activate the engine.'}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isEs ? 'Nº Serie' : 'Serial'}</TableHead>
                        <TableHead>{isEs ? 'Nombre' : 'Name'}</TableHead>
                        <TableHead>{isEs ? 'Cliente' : 'Customer'}</TableHead>
                        <TableHead>{isEs ? 'Ciclo' : 'Lifecycle'}</TableHead>
                        <TableHead>{isEs ? 'Conexión' : 'Connection'}</TableHead>
                        <TableHead>{isEs ? 'Riesgo' : 'Risk'}</TableHead>
                        <TableHead>{isEs ? 'Segmento' : 'Segment'}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assets.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">{a.serial_number || '-'}</TableCell>
                          <TableCell className="font-medium">{a.asset_name}</TableCell>
                          <TableCell>{a.customer_name}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize text-xs">{a.lifecycle_stage}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={a.connection_status === 'connected' ? 'default' : 'secondary'} className="text-xs">
                              {a.connection_status === 'connected' && <Radio className="h-3 w-3 mr-1" />}
                              {a.connection_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={a.risk_level === 'high' ? 'destructive' : a.risk_level === 'medium' ? 'secondary' : 'outline'} className="text-xs">{a.risk_level}</Badge>
                          </TableCell>
                          <TableCell className="capitalize text-xs">{a.customer_value_segment}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => deleteAsset(a.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTRACTS */}
        <TabsContent value="contracts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{isEs ? 'Contratos de Servicio' : 'Service Contracts'}</h3>
            <Dialog open={showContractForm} onOpenChange={setShowContractForm}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />{isEs ? 'Nuevo Contrato' : 'New Contract'}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{isEs ? 'Nuevo Contrato' : 'New Contract'}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium">{isEs ? 'Nombre' : 'Name'}</label><Input value={contractForm.contract_name} onChange={e => setContractForm(p => ({ ...p, contract_name: e.target.value }))} /></div>
                  <div><label className="text-xs font-medium">{isEs ? 'Cliente' : 'Customer'}</label><Input value={contractForm.customer_name} onChange={e => setContractForm(p => ({ ...p, customer_name: e.target.value }))} /></div>
                  <div>
                    <label className="text-xs font-medium">{isEs ? 'Tipo' : 'Type'}</label>
                    <Select value={contractForm.contract_type} onValueChange={v => setContractForm(p => ({ ...p, contract_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CONTRACT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><label className="text-xs font-medium">{isEs ? 'Valor Anual (€)' : 'Annual Value (€)'}</label><Input type="number" value={contractForm.annual_value} onChange={e => setContractForm(p => ({ ...p, annual_value: Number(e.target.value) }))} /></div>
                  <div><label className="text-xs font-medium">SLA ({isEs ? 'horas respuesta' : 'response hours'})</label><Input type="number" value={contractForm.sla_response_hours} onChange={e => setContractForm(p => ({ ...p, sla_response_hours: Number(e.target.value) }))} /></div>
                  <div>
                    <label className="text-xs font-medium">{isEs ? 'Activo vinculado' : 'Linked Asset'}</label>
                    <Select value={contractForm.asset_id} onValueChange={v => setContractForm(p => ({ ...p, asset_id: v }))}>
                      <SelectTrigger><SelectValue placeholder={isEs ? 'Seleccionar...' : 'Select...'} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-</SelectItem>
                        {assets.map(a => <SelectItem key={a.id} value={a.id}>{a.asset_name} ({a.serial_number})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-4 col-span-2">
                    <label className="flex items-center gap-2 text-xs"><Switch checked={contractForm.includes_parts} onCheckedChange={v => setContractForm(p => ({ ...p, includes_parts: v }))} />{isEs ? 'Incluye repuestos' : 'Includes parts'}</label>
                    <label className="flex items-center gap-2 text-xs"><Switch checked={contractForm.includes_remote} onCheckedChange={v => setContractForm(p => ({ ...p, includes_remote: v }))} />{isEs ? 'Servicio remoto' : 'Remote service'}</label>
                    <label className="flex items-center gap-2 text-xs"><Switch checked={contractForm.includes_predictive} onCheckedChange={v => setContractForm(p => ({ ...p, includes_predictive: v }))} />{isEs ? 'Predictivo' : 'Predictive'}</label>
                  </div>
                  <div className="col-span-2"><label className="text-xs font-medium">{isEs ? 'Notas' : 'Notes'}</label><Textarea value={contractForm.notes} onChange={e => setContractForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
                </div>
                <Button onClick={saveContract} className="w-full mt-3"><Save className="h-4 w-4 mr-2" />{isEs ? 'Guardar' : 'Save'}</Button>
              </DialogContent>
            </Dialog>
          </div>

          {/* Contract tier summary */}
          {contracts.length > 0 && (
            <div className="grid grid-cols-5 gap-3">
              {CONTRACT_TYPES.map(type => {
                const count = contracts.filter(c => c.contract_type === type).length;
                const value = contracts.filter(c => c.contract_type === type).reduce((s, c) => s + (c.annual_value || 0), 0);
                return (
                  <Card key={type}>
                    <CardContent className="pt-4 text-center">
                      <p className="text-sm font-bold capitalize">{type}</p>
                      <p className="text-lg font-bold text-foreground">{count}</p>
                      <p className="text-xs text-muted-foreground">{fmt(value)}/yr</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Card>
            <CardContent className="pt-4">
              {contracts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{isEs ? 'Sin contratos. Crea contratos de servicio productizados.' : 'No contracts. Create productized service contracts.'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEs ? 'Contrato' : 'Contract'}</TableHead>
                      <TableHead>{isEs ? 'Cliente' : 'Customer'}</TableHead>
                      <TableHead>{isEs ? 'Tipo' : 'Type'}</TableHead>
                      <TableHead>{isEs ? 'Valor/año' : 'Value/yr'}</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>{isEs ? 'Incluye' : 'Includes'}</TableHead>
                      <TableHead>{isEs ? 'Estado' : 'Status'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.contract_name}</TableCell>
                        <TableCell>{c.customer_name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize text-xs">{c.contract_type}</Badge></TableCell>
                        <TableCell className="font-medium">{fmt(c.annual_value)}</TableCell>
                        <TableCell>{c.sla_response_hours}h</TableCell>
                        <TableCell className="text-xs">
                          {c.includes_parts && <Badge variant="secondary" className="mr-1 text-xs">{isEs ? 'Rep.' : 'Parts'}</Badge>}
                          {c.includes_remote && <Badge variant="secondary" className="mr-1 text-xs">{isEs ? 'Rem.' : 'Remote'}</Badge>}
                          {c.includes_predictive && <Badge variant="secondary" className="text-xs">{isEs ? 'Pred.' : 'Pred.'}</Badge>}
                        </TableCell>
                        <TableCell><Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SERVICE INTERVENTIONS */}
        <TabsContent value="service" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{isEs ? 'Intervenciones de Servicio' : 'Service Interventions'}</h3>
            <Dialog open={showInterventionForm} onOpenChange={setShowInterventionForm}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />{isEs ? 'Nueva Intervención' : 'New Intervention'}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{isEs ? 'Nueva Intervención' : 'New Intervention'}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">{isEs ? 'Tipo' : 'Type'}</label>
                    <Select value={interventionForm.intervention_type} onValueChange={v => setInterventionForm(p => ({ ...p, intervention_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{INTERVENTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">{isEs ? 'Activo' : 'Asset'}</label>
                    <Select value={interventionForm.asset_id} onValueChange={v => setInterventionForm(p => ({ ...p, asset_id: v }))}>
                      <SelectTrigger><SelectValue placeholder={isEs ? 'Seleccionar...' : 'Select...'} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-</SelectItem>
                        {assets.map(a => <SelectItem key={a.id} value={a.id}>{a.asset_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><label className="text-xs font-medium">{isEs ? 'Técnico' : 'Technician'}</label><Input value={interventionForm.technician} onChange={e => setInterventionForm(p => ({ ...p, technician: e.target.value }))} /></div>
                  <div><label className="text-xs font-medium">{isEs ? 'Duración (h)' : 'Duration (h)'}</label><Input type="number" value={interventionForm.duration_hours} onChange={e => setInterventionForm(p => ({ ...p, duration_hours: Number(e.target.value) }))} /></div>
                  <div><label className="text-xs font-medium">{isEs ? 'Coste (€)' : 'Cost (€)'}</label><Input type="number" value={interventionForm.cost} onChange={e => setInterventionForm(p => ({ ...p, cost: Number(e.target.value) }))} /></div>
                  <div className="flex items-center gap-2 pt-5"><Switch checked={interventionForm.was_remote} onCheckedChange={v => setInterventionForm(p => ({ ...p, was_remote: v }))} /><span className="text-xs">{isEs ? 'Remoto' : 'Remote'}</span></div>
                  <div className="col-span-2"><label className="text-xs font-medium">{isEs ? 'Descripción' : 'Description'}</label><Textarea value={interventionForm.description} onChange={e => setInterventionForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
                  <div className="col-span-2"><label className="text-xs font-medium">{isEs ? 'Resolución' : 'Resolution'}</label><Input value={interventionForm.resolution} onChange={e => setInterventionForm(p => ({ ...p, resolution: e.target.value }))} /></div>
                </div>
                <Button onClick={saveIntervention} className="w-full mt-3"><Save className="h-4 w-4 mr-2" />{isEs ? 'Guardar' : 'Save'}</Button>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-4">
              {interventions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{isEs ? 'Sin intervenciones registradas' : 'No interventions recorded'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEs ? 'Fecha' : 'Date'}</TableHead>
                      <TableHead>{isEs ? 'Tipo' : 'Type'}</TableHead>
                      <TableHead>{isEs ? 'Descripción' : 'Description'}</TableHead>
                      <TableHead>{isEs ? 'Técnico' : 'Technician'}</TableHead>
                      <TableHead>{isEs ? 'Duración' : 'Duration'}</TableHead>
                      <TableHead>{isEs ? 'Coste' : 'Cost'}</TableHead>
                      <TableHead>{isEs ? 'Remoto' : 'Remote'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interventions.map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="text-xs">{new Date(i.created_at).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant={i.intervention_type === 'reactive' ? 'destructive' : i.intervention_type === 'predictive' ? 'default' : 'secondary'} className="text-xs">{i.intervention_type}</Badge></TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{i.description}</TableCell>
                        <TableCell>{i.technician}</TableCell>
                        <TableCell>{i.duration_hours}h</TableCell>
                        <TableCell>{fmt(i.cost)}</TableCell>
                        <TableCell>{i.was_remote ? '✓' : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI INTELLIGENCE */}
        <TabsContent value="intelligence" className="space-y-4">
          {!diagnosis ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">{isEs ? 'Ejecuta el diagnóstico IA completo para obtener inteligencia de post-venta' : 'Run full AI diagnostic to get after-sales intelligence'}</p>
                <Button onClick={runDiagnostic} disabled={analyzing}>
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                  {isEs ? 'Lanzar Diagnóstico' : 'Run Diagnostic'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Executive Summary */}
              {diagnosis.executiveSummary && (
                <Card className="border-primary/50">
                  <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" />{isEs ? 'Resumen Ejecutivo' : 'Executive Summary'}</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{diagnosis.executiveSummary}</p></CardContent>
                </Card>
              )}

              {/* Installed Base Health */}
              {diagnosis.installedBaseHealth && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5 text-primary" />{isEs ? 'Salud Base Instalada' : 'Installed Base Health'}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center"><p className="text-2xl font-bold">{diagnosis.installedBaseHealth.totalAssets}</p><p className="text-xs text-muted-foreground">{isEs ? 'Activos' : 'Assets'}</p></div>
                      <div className="text-center"><p className="text-2xl font-bold">{fmtPct(diagnosis.installedBaseHealth.connectedPct || 0)}</p><p className="text-xs text-muted-foreground">{isEs ? 'Conectados' : 'Connected'}</p></div>
                      <div className="text-center"><p className="text-2xl font-bold">{fmtPct(diagnosis.serviceMaturity?.contractPenetration || 0)}</p><p className="text-xs text-muted-foreground">{isEs ? 'Penetración' : 'Penetration'}</p></div>
                    </div>
                    {diagnosis.installedBaseHealth.coverageGaps?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">{isEs ? 'Brechas de Cobertura' : 'Coverage Gaps'}</p>
                        {diagnosis.installedBaseHealth.coverageGaps.map((g: string, i: number) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1"><AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0 mt-0.5" />{g}</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Service Maturity AI */}
              {diagnosis.serviceMaturity && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />{isEs ? 'Madurez del Servicio' : 'Service Maturity'}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4">
                      <p className="text-sm">{isEs ? 'Nivel actual' : 'Current Level'}:</p>
                      <Badge className="capitalize text-sm">{diagnosis.serviceMaturity.currentLevel}</Badge>
                      <p className="text-sm">Score: <span className="font-bold text-primary">{diagnosis.serviceMaturity.maturityScore}/100</span></p>
                    </div>
                    <Progress value={diagnosis.serviceMaturity.maturityScore || 0} className="h-3" />
                    {diagnosis.serviceMaturity.recommendations?.map((r: string, i: number) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-start gap-1"><Lightbulb className="h-3 w-3 text-yellow-500 flex-shrink-0 mt-0.5" />{r}</p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Revenue Opportunities */}
              {diagnosis.revenueOpportunities?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />{isEs ? 'Oportunidades de Ingreso' : 'Revenue Opportunities'}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {diagnosis.revenueOpportunities.map((o: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Badge variant={o.urgency === 'high' ? 'destructive' : 'outline'} className="text-xs mt-0.5">{o.type}</Badge>
                          <div>
                            <p className="text-sm font-medium">{o.title}</p>
                            <p className="text-xs text-muted-foreground">{o.description}</p>
                            {o.recommendedAction && <p className="text-xs text-primary mt-1">→ {o.recommendedAction}</p>}
                          </div>
                        </div>
                        <p className="text-sm font-bold whitespace-nowrap ml-4">{fmt(o.estimatedValue || 0)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Productization Advice */}
              {diagnosis.productizationAdvice?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />{isEs ? 'Servicios Productizados' : 'Productized Services'}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {diagnosis.productizationAdvice.map((p: any, i: number) => (
                        <Card key={i}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-sm">{p.packageName}</p>
                              <Badge variant="outline" className="capitalize text-xs">{p.type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{p.description}</p>
                            <div className="flex justify-between text-xs">
                              <span>{isEs ? 'Modelo' : 'Model'}: {p.pricingModel}</span>
                              <span className="font-bold">{fmt(p.estimatedAnnualRevenue || 0)}/yr</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recurring Revenue */}
              {diagnosis.recurringRevenueAnalysis && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" />{isEs ? 'Modelo de Ingresos Recurrentes' : 'Recurring Revenue Model'}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">{isEs ? 'ARR Actual' : 'Current ARR'}</p>
                        <p className="text-xl font-bold">{fmt(diagnosis.recurringRevenueAnalysis.currentARR || 0)}</p>
                      </div>
                      <div className="text-center p-4 bg-primary/10 rounded-lg">
                        <p className="text-xs text-muted-foreground">{isEs ? 'ARR Potencial' : 'Potential ARR'}</p>
                        <p className="text-xl font-bold text-primary">{fmt(diagnosis.recurringRevenueAnalysis.potentialARR || 0)}</p>
                      </div>
                    </div>
                    {diagnosis.recurringRevenueAnalysis.growthLevers?.map((l: string, i: number) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-start gap-1 mb-1"><ArrowUpRight className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />{l}</p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* AI Agent Recommendations */}
              {diagnosis.aiAgentRecommendations?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5 text-primary" />{isEs ? 'Recomendaciones de Agentes IA' : 'AI Agent Recommendations'}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {diagnosis.aiAgentRecommendations.map((r: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 flex items-start gap-3">
                        <Badge variant={r.priority === 'high' ? 'destructive' : 'outline'} className="text-xs mt-0.5">{r.agentType}</Badge>
                        <div>
                          <p className="text-sm">{r.action}</p>
                          <p className="text-xs text-primary mt-1">{isEs ? 'Impacto' : 'Impact'}: {r.expectedImpact}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
