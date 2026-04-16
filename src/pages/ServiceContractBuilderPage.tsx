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
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Plus, Trash2, Brain, Save, Loader2, Package, DollarSign,
  BarChart3, ArrowLeft, Wrench, TrendingUp, AlertTriangle, Settings,
  Calculator, Zap, Target, Box, CheckCircle, Clock, Users
} from 'lucide-react';
import { buildFallbackServiceContractAnalysis, classifyEdgeRuntimeError } from '@/lib/edgeStability';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const CONTRACT_TIERS = [
  { key: 'basic', label: 'Basic', color: 'bg-muted', includes: ['Monitoring', 'Remote diagnostics'], partsCoverage: 0 },
  { key: 'advanced', label: 'Advanced', color: 'bg-primary/10', includes: ['Monitoring', 'Remote diagnostics', 'Preventive maintenance', 'Priority support'], partsCoverage: 50 },
  { key: 'premium', label: 'Premium', color: 'bg-primary/20', includes: ['All Advanced', 'Predictive maintenance', 'Included spare parts', '4h SLA'], partsCoverage: 80 },
  { key: 'full-care', label: 'Full-Care', color: 'bg-primary/30', includes: ['All Premium', 'All parts included', 'Uptime guarantee', 'Dedicated technician'], partsCoverage: 100 },
];

const RECURRING_MODELS = ['subscription', 'pay-per-use', 'performance-based', 'hybrid'];

export default function ServiceContractBuilderPage() {
  const { language } = useLanguage();
  const { activeCompanyId } = useData();
  const navigate = useNavigate();
  const isEs = language === 'es';

  const [activeTab, setActiveTab] = useState('definition');
  const [assets, setAssets] = useState<any[]>([]);
  const [spareParts, setSpareParts] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  // Contract definition
  const [contractDef, setContractDef] = useState({
    contract_name: '', customer_name: '', contract_type: 'advanced',
    annual_value: 0, sla_response_hours: 24, recurring_revenue_type: 'subscription',
    includes_parts: false, includes_remote: true, includes_predictive: false,
    start_date: '', end_date: '', asset_id: '', notes: '',
  });

  // Bundled parts
  const [bundledParts, setBundledParts] = useState<Array<{
    part_id: string; part_name: string; part_number: string;
    included_qty_annual: number; is_included: boolean;
    unit_cost: number; selling_price: number; predicted_consumption: number;
  }>>([]);

  // Pricing
  const [marginTarget, setMarginTarget] = useState(25);
  const [baseFee, setBaseFee] = useState(0);

  const loadData = useCallback(async () => {
    if (!activeCompanyId) return;
    const [a, sp, c] = await Promise.all([
      supabase.from('installed_base_assets').select('*').eq('company_id', activeCompanyId),
      supabase.from('spare_parts').select('*').eq('company_id', activeCompanyId).eq('is_active', true),
      supabase.from('service_contracts').select('*').eq('company_id', activeCompanyId).order('created_at', { ascending: false }),
    ]);
    if (a.data) setAssets(a.data);
    if (sp.data) setSpareParts(sp.data);
    if (c.data) setContracts(c.data);
  }, [activeCompanyId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-set tier features when tier changes
  useEffect(() => {
    const tier = CONTRACT_TIERS.find(t => t.key === contractDef.contract_type);
    if (tier) {
      setContractDef(p => ({
        ...p,
        includes_parts: tier.partsCoverage > 0,
        includes_predictive: ['premium', 'full-care'].includes(tier.key),
        includes_remote: true,
        sla_response_hours: tier.key === 'full-care' ? 4 : tier.key === 'premium' ? 8 : tier.key === 'advanced' ? 24 : 48,
      }));
    }
  }, [contractDef.contract_type]);

  const addPart = (partId: string) => {
    const part = spareParts.find(p => p.id === partId);
    if (!part || bundledParts.find(b => b.part_id === partId)) return;
    const tier = CONTRACT_TIERS.find(t => t.key === contractDef.contract_type);
    const isIncluded = (tier?.partsCoverage || 0) >= 80;
    // Predict consumption based on demand trend
    const predicted = part.predicted_demand_monthly * 12 || part.stock_quantity > 0 ? Math.ceil(part.predicted_demand_monthly * 12) : 2;
    setBundledParts(prev => [...prev, {
      part_id: partId, part_name: part.part_name, part_number: part.part_number,
      included_qty_annual: predicted || 2, is_included: isIncluded,
      unit_cost: part.unit_cost, selling_price: part.dynamic_price || part.selling_price,
      predicted_consumption: predicted || 2,
    }]);
  };

  const removePart = (partId: string) => {
    setBundledParts(prev => prev.filter(p => p.part_id !== partId));
  };

  const updatePart = (partId: string, field: string, value: any) => {
    setBundledParts(prev => prev.map(p => p.part_id === partId ? { ...p, [field]: value } : p));
  };

  // Calculate pricing
  const includedPartsCost = bundledParts.filter(p => p.is_included).reduce((s, p) => s + (p.unit_cost * p.included_qty_annual), 0);
  const billablePartsRevenue = bundledParts.filter(p => !p.is_included).reduce((s, p) => s + (p.selling_price * p.predicted_consumption), 0);
  const totalServiceCost = baseFee * 0.6; // assume 60% of base fee is cost
  const totalCost = totalServiceCost + includedPartsCost;
  const totalContractValue = baseFee + includedPartsCost / (1 - marginTarget / 100) - includedPartsCost + billablePartsRevenue;
  const suggestedAnnualFee = totalCost / (1 - marginTarget / 100);
  const actualMargin = suggestedAnnualFee > 0 ? ((suggestedAnnualFee - totalCost) / suggestedAnnualFee) * 100 : 0;

  // Tier comparison
  const tierComparison = CONTRACT_TIERS.map(tier => {
    const coveragePct = tier.partsCoverage;
    const partsCostForTier = includedPartsCost * (coveragePct / 100);
    const tierBaseFee = baseFee * (tier.key === 'basic' ? 0.5 : tier.key === 'advanced' ? 0.75 : tier.key === 'premium' ? 1 : 1.4);
    const tierCost = tierBaseFee * 0.6 + partsCostForTier;
    const tierPrice = tierCost / (1 - marginTarget / 100);
    return { ...tier, annualPrice: tierPrice, margin: tierPrice > 0 ? ((tierPrice - tierCost) / tierPrice) * 100 : 0, partsCost: partsCostForTier };
  });

  const saveContract = async () => {
    if (!activeCompanyId || !contractDef.contract_name) {
      toast({ title: 'Error', description: isEs ? 'Nombre requerido' : 'Name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Save contract
      const contractPayload: any = {
        ...contractDef,
        company_id: activeCompanyId,
        status: 'active',
        estimated_parts_cost: includedPartsCost,
        parts_budget_annual: includedPartsCost * 1.1,
        total_contract_value: suggestedAnnualFee,
        annual_value: suggestedAnnualFee,
        parts_consumption_forecast: { parts: bundledParts.map(p => ({ part_id: p.part_id, predicted: p.predicted_consumption })) },
      };
      if (!contractPayload.asset_id) delete contractPayload.asset_id;
      if (!contractPayload.start_date) delete contractPayload.start_date;
      if (!contractPayload.end_date) delete contractPayload.end_date;

      const { data: savedContract, error } = await supabase.from('service_contracts').insert(contractPayload).select().single();
      if (error) throw error;

      // Save bundled parts
      if (bundledParts.length > 0 && savedContract) {
        const partsPayload = bundledParts.map(p => ({
          contract_id: savedContract.id,
          part_id: p.part_id,
          included_qty_annual: p.included_qty_annual,
          is_included: p.is_included,
          unit_price_override: p.selling_price,
          predicted_consumption_annual: p.predicted_consumption,
          consumption_forecast: { monthly: Array(12).fill(Math.ceil(p.predicted_consumption / 12)) },
        }));
        await supabase.from('service_contract_parts').insert(partsPayload);
      }

      toast({ title: isEs ? 'Contrato creado' : 'Contract created', description: contractDef.contract_name });
      loadData();
      // Reset
      setContractDef({ contract_name: '', customer_name: '', contract_type: 'advanced', annual_value: 0, sla_response_hours: 24, recurring_revenue_type: 'subscription', includes_parts: false, includes_remote: true, includes_predictive: false, start_date: '', end_date: '', asset_id: '', notes: '' });
      setBundledParts([]);
      setBaseFee(0);
      setAnalysis(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('after-sales-intelligence', {
        body: {
          assets, contracts,
          spareParts: spareParts.filter(sp => bundledParts.some(bp => bp.part_id === sp.id)),
          interventions: [],
          analysisType: 'contract_analysis',
          contractDef,
          bundledParts,
          pricing: { baseFee, marginTarget, includedPartsCost, suggestedAnnualFee, tierComparison },
        },
      });
      if (error) throw error;
      if (data?.analysis) {
        setAnalysis(data.analysis);
        setActiveTab('analysis');
        toast({ title: isEs ? 'Análisis completado' : 'Analysis complete' });
      }
    } catch (e: any) {
      const details = classifyEdgeRuntimeError(e, 'local contract analysis');
      setAnalysis(buildFallbackServiceContractAnalysis({ contractDef, suggestedAnnualFee, includedPartsCost, marginTarget }));
      setActiveTab('analysis');
      toast({ title: details.title, description: details.description });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/after-sales')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              {isEs ? 'Constructor de Contratos de Servicio' : 'Service Contract Builder'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isEs ? 'Diseña contratos productizados con repuestos incluidos, pricing por niveles y previsión de consumo' : 'Design productized contracts with bundled parts, tier pricing, and consumption forecasting'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
            {isEs ? 'Analizar IA' : 'AI Analysis'}
          </Button>
          <Button onClick={saveContract} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isEs ? 'Guardar Contrato' : 'Save Contract'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="definition">{isEs ? 'Definición' : 'Definition'}</TabsTrigger>
          <TabsTrigger value="parts">{isEs ? 'Repuestos' : 'Parts Bundle'}</TabsTrigger>
          <TabsTrigger value="pricing">{isEs ? 'Pricing' : 'Pricing'}</TabsTrigger>
          <TabsTrigger value="analysis">{isEs ? 'Análisis IA' : 'AI Analysis'}</TabsTrigger>
          <TabsTrigger value="history">{isEs ? 'Historial' : 'History'}</TabsTrigger>
        </TabsList>

        {/* ===== DEFINITION ===== */}
        <TabsContent value="definition" className="space-y-4">
          {/* Tier Selection */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CONTRACT_TIERS.map(tier => (
              <Card
                key={tier.key}
                className={`cursor-pointer transition-all ${contractDef.contract_type === tier.key ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
                onClick={() => setContractDef(p => ({ ...p, contract_type: tier.key }))}
              >
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm">{tier.label}</h4>
                    {contractDef.contract_type === tier.key && <CheckCircle className="h-4 w-4 text-primary" />}
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {tier.includes.map((item, i) => (
                      <li key={i} className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" />{item}</li>
                    ))}
                  </ul>
                  <div className="mt-3 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">{isEs ? 'Cobertura repuestos' : 'Parts coverage'}: <span className="font-bold text-foreground">{tier.partsCoverage}%</span></p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contract Details */}
          <Card>
            <CardHeader><CardTitle className="text-base">{isEs ? 'Detalles del Contrato' : 'Contract Details'}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><label className="text-xs font-medium">{isEs ? 'Nombre Contrato' : 'Contract Name'}</label><Input value={contractDef.contract_name} onChange={e => setContractDef(p => ({ ...p, contract_name: e.target.value }))} /></div>
                <div><label className="text-xs font-medium">{isEs ? 'Cliente' : 'Customer'}</label><Input value={contractDef.customer_name} onChange={e => setContractDef(p => ({ ...p, customer_name: e.target.value }))} /></div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Activo Vinculado' : 'Linked Asset'}</label>
                  <Select value={contractDef.asset_id} onValueChange={v => setContractDef(p => ({ ...p, asset_id: v }))}>
                    <SelectTrigger><SelectValue placeholder={isEs ? 'Seleccionar...' : 'Select...'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-</SelectItem>
                      {assets.map(a => <SelectItem key={a.id} value={a.id}>{a.asset_name} ({a.serial_number})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Modelo de Ingresos' : 'Revenue Model'}</label>
                  <Select value={contractDef.recurring_revenue_type} onValueChange={v => setContractDef(p => ({ ...p, recurring_revenue_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RECURRING_MODELS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className="text-xs font-medium">SLA ({isEs ? 'horas' : 'hours'})</label><Input type="number" value={contractDef.sla_response_hours} onChange={e => setContractDef(p => ({ ...p, sla_response_hours: Number(e.target.value) }))} /></div>
                <div><label className="text-xs font-medium">{isEs ? 'Fecha Inicio' : 'Start Date'}</label><Input type="date" value={contractDef.start_date} onChange={e => setContractDef(p => ({ ...p, start_date: e.target.value }))} /></div>
                <div><label className="text-xs font-medium">{isEs ? 'Fecha Fin' : 'End Date'}</label><Input type="date" value={contractDef.end_date} onChange={e => setContractDef(p => ({ ...p, end_date: e.target.value }))} /></div>
                <div className="flex items-center gap-6 col-span-2 md:col-span-1 pt-5">
                  <label className="flex items-center gap-2 text-xs"><Switch checked={contractDef.includes_parts} onCheckedChange={v => setContractDef(p => ({ ...p, includes_parts: v }))} />{isEs ? 'Repuestos' : 'Parts'}</label>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={contractDef.includes_remote} onCheckedChange={v => setContractDef(p => ({ ...p, includes_remote: v }))} />{isEs ? 'Remoto' : 'Remote'}</label>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={contractDef.includes_predictive} onCheckedChange={v => setContractDef(p => ({ ...p, includes_predictive: v }))} />{isEs ? 'Predictivo' : 'Predictive'}</label>
                </div>
                <div className="col-span-2 md:col-span-3"><label className="text-xs font-medium">{isEs ? 'Notas' : 'Notes'}</label><Textarea value={contractDef.notes} onChange={e => setContractDef(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PARTS BUNDLE ===== */}
        <TabsContent value="parts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Available Parts */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Box className="h-4 w-4 text-primary" />{isEs ? 'Catálogo' : 'Parts Catalog'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                {spareParts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">{isEs ? 'Sin repuestos. Añádelos en el motor post-venta.' : 'No parts. Add them in the after-sales engine.'}</p>
                ) : spareParts.map(sp => {
                  const alreadyAdded = bundledParts.some(bp => bp.part_id === sp.id);
                  return (
                    <div key={sp.id} className={`p-2 rounded border text-xs flex items-center justify-between ${alreadyAdded ? 'opacity-50' : 'hover:bg-muted/50 cursor-pointer'}`}>
                      <div>
                        <p className="font-medium">{sp.part_name}</p>
                        <p className="text-muted-foreground">{sp.part_number} · {fmt(sp.unit_cost)}</p>
                      </div>
                      <Button size="sm" variant="ghost" disabled={alreadyAdded} onClick={() => addPart(sp.id)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Bundled Parts */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  {isEs ? 'Repuestos en Contrato' : 'Contract Parts Bundle'}
                  <Badge variant="secondary" className="ml-2">{bundledParts.length}</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  {isEs ? 'Tier actual' : 'Current tier'}: <strong className="capitalize">{contractDef.contract_type}</strong> — {CONTRACT_TIERS.find(t => t.key === contractDef.contract_type)?.partsCoverage}% {isEs ? 'cobertura repuestos' : 'parts coverage'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bundledParts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">{isEs ? 'Añade repuestos del catálogo para incluirlos en el contrato' : 'Add parts from the catalog to include in the contract'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{isEs ? 'Pieza' : 'Part'}</TableHead>
                        <TableHead className="text-xs">{isEs ? 'Incl./Facturable' : 'Incl./Billable'}</TableHead>
                        <TableHead className="text-xs">{isEs ? 'Qty/año' : 'Qty/yr'}</TableHead>
                        <TableHead className="text-xs">{isEs ? 'Coste unit.' : 'Unit cost'}</TableHead>
                        <TableHead className="text-xs">{isEs ? 'Consumo prev.' : 'Pred. cons.'}</TableHead>
                        <TableHead className="text-xs">{isEs ? 'Coste anual' : 'Annual cost'}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bundledParts.map(bp => (
                        <TableRow key={bp.part_id}>
                          <TableCell>
                            <p className="text-xs font-medium">{bp.part_name}</p>
                            <p className="text-xs text-muted-foreground">{bp.part_number}</p>
                          </TableCell>
                          <TableCell>
                            <Select value={bp.is_included ? 'included' : 'billable'} onValueChange={v => updatePart(bp.part_id, 'is_included', v === 'included')}>
                              <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="included">{isEs ? 'Incluido' : 'Included'}</SelectItem>
                                <SelectItem value="billable">{isEs ? 'Facturable' : 'Billable'}</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={bp.included_qty_annual} onChange={e => updatePart(bp.part_id, 'included_qty_annual', Number(e.target.value))} className="h-7 w-16 text-xs" />
                          </TableCell>
                          <TableCell className="text-xs">{fmt(bp.unit_cost)}</TableCell>
                          <TableCell className="text-xs font-medium">{bp.predicted_consumption}/yr</TableCell>
                          <TableCell className="text-xs font-medium">{fmt(bp.unit_cost * bp.included_qty_annual)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removePart(bp.part_id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {bundledParts.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">{isEs ? 'Coste repuestos incluidos' : 'Included parts cost'}</p>
                      <p className="text-lg font-bold">{fmt(includedPartsCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{isEs ? 'Ingresos facturables est.' : 'Est. billable revenue'}</p>
                      <p className="text-lg font-bold text-primary">{fmt(billablePartsRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{isEs ? 'Total piezas/año' : 'Total parts/yr'}</p>
                      <p className="text-lg font-bold">{bundledParts.reduce((s, p) => s + p.included_qty_annual, 0)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== PRICING ===== */}
        <TabsContent value="pricing" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pricing Calculator */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" />{isEs ? 'Calculadora de Precios' : 'Pricing Calculator'}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Tarifa Base Servicio (€/año)' : 'Base Service Fee (€/yr)'}</label>
                  <Input type="number" value={baseFee} onChange={e => setBaseFee(Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground mt-1">{isEs ? 'Coste del servicio sin repuestos' : 'Service cost excluding parts'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Margen Objetivo (%)' : 'Target Margin (%)'}</label>
                  <Input type="number" value={marginTarget} onChange={e => setMarginTarget(Number(e.target.value))} />
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">{isEs ? 'Coste servicio' : 'Service cost'}</span><span>{fmt(totalServiceCost)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">{isEs ? 'Coste repuestos incl.' : 'Included parts cost'}</span><span>{fmt(includedPartsCost)}</span></div>
                  <Separator />
                  <div className="flex justify-between text-sm font-medium"><span>{isEs ? 'Coste Total' : 'Total Cost'}</span><span>{fmt(totalCost)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">{isEs ? 'Margen' : 'Margin'} ({marginTarget}%)</span><span>{fmt(suggestedAnnualFee - totalCost)}</span></div>
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>{isEs ? 'Precio Anual Sugerido' : 'Suggested Annual Price'}</span>
                    <span className="text-primary">{fmt(suggestedAnnualFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{isEs ? 'Margen real' : 'Actual margin'}</span>
                    <Badge variant={actualMargin > 25 ? 'default' : actualMargin > 15 ? 'secondary' : 'destructive'}>{fmtPct(actualMargin)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tier Comparison */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />{isEs ? 'Comparativa por Nivel' : 'Tier Comparison'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {tierComparison.map(tier => (
                  <div key={tier.key} className={`p-3 rounded-lg border ${contractDef.contract_type === tier.key ? 'border-primary bg-primary/5' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm">{tier.label}</h4>
                        {contractDef.contract_type === tier.key && <Badge className="text-xs">{isEs ? 'Seleccionado' : 'Selected'}</Badge>}
                      </div>
                      <p className="text-lg font-bold text-primary">{fmt(tier.annualPrice)}<span className="text-xs text-muted-foreground font-normal">/yr</span></p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">{isEs ? 'Repuestos' : 'Parts'}</span>
                        <p className="font-medium">{fmt(tier.partsCost)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{isEs ? 'Cobertura' : 'Coverage'}</span>
                        <p className="font-medium">{tier.partsCoverage}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{isEs ? 'Margen' : 'Margin'}</span>
                        <Badge variant={tier.margin > 25 ? 'default' : tier.margin > 15 ? 'secondary' : 'destructive'} className="text-xs">{fmtPct(tier.margin)}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Consumption Forecast */}
          {bundledParts.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />{isEs ? 'Previsión de Consumo Anual' : 'Annual Consumption Forecast'}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bundledParts.map(bp => {
                    const coveragePct = bp.predicted_consumption > 0 ? Math.min(100, (bp.included_qty_annual / bp.predicted_consumption) * 100) : 100;
                    return (
                      <div key={bp.part_id} className="flex items-center gap-4">
                        <span className="text-xs w-40 truncate">{bp.part_name}</span>
                        <div className="flex-1">
                          <Progress value={coveragePct} className="h-2" />
                        </div>
                        <span className="text-xs w-24 text-right">{bp.included_qty_annual}/{bp.predicted_consumption} {isEs ? 'uds' : 'units'}</span>
                        <Badge variant={coveragePct >= 100 ? 'default' : coveragePct >= 80 ? 'secondary' : 'destructive'} className="text-xs w-16 justify-center">{fmtPct(coveragePct)}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== AI ANALYSIS ===== */}
        <TabsContent value="analysis" className="space-y-4">
          {!analysis ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">{isEs ? 'Ejecuta el análisis IA para evaluar rentabilidad, riesgo y oportunidades del contrato' : 'Run AI analysis to evaluate contract profitability, risk, and opportunities'}</p>
                <Button onClick={runAnalysis} disabled={analyzing}>
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                  {isEs ? 'Analizar Contrato' : 'Analyze Contract'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {analysis.executiveSummary && (
                <Card className="border-primary/50">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4 text-primary" />{isEs ? 'Resumen IA' : 'AI Summary'}</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysis.executiveSummary}</p></CardContent>
                </Card>
              )}

              {analysis.revenueOpportunities?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" />{isEs ? 'Oportunidades Detectadas' : 'Detected Opportunities'}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {analysis.revenueOpportunities.map((o: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Badge variant={o.urgency === 'high' ? 'destructive' : 'outline'} className="text-xs mt-0.5">{o.type}</Badge>
                          <div>
                            <p className="text-sm font-medium">{o.title}</p>
                            <p className="text-xs text-muted-foreground">{o.description}</p>
                            {o.recommendedAction && <p className="text-xs text-primary mt-1">→ {o.recommendedAction}</p>}
                          </div>
                        </div>
                        {o.estimatedValue && <p className="text-sm font-bold whitespace-nowrap ml-4">{fmt(o.estimatedValue)}</p>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {analysis.productizationAdvice?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-primary" />{isEs ? 'Recomendaciones de Productización' : 'Productization Advice'}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {analysis.productizationAdvice.map((p: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border">
                          <p className="font-medium text-sm">{p.packageName}</p>
                          <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                          <div className="flex justify-between mt-2 text-xs">
                            <Badge variant="outline" className="capitalize">{p.pricingModel}</Badge>
                            <span className="font-bold">{fmt(p.estimatedAnnualRevenue || 0)}/yr</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {analysis.aiAgentRecommendations?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />{isEs ? 'Acciones Recomendadas' : 'Recommended Actions'}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {analysis.aiAgentRecommendations.map((r: any, i: number) => (
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

        {/* ===== HISTORY ===== */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{isEs ? 'Contratos Creados' : 'Created Contracts'}</CardTitle></CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{isEs ? 'Sin contratos aún' : 'No contracts yet'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEs ? 'Contrato' : 'Contract'}</TableHead>
                      <TableHead>{isEs ? 'Cliente' : 'Customer'}</TableHead>
                      <TableHead>{isEs ? 'Tipo' : 'Type'}</TableHead>
                      <TableHead>{isEs ? 'Valor/año' : 'Value/yr'}</TableHead>
                      <TableHead>{isEs ? 'Coste Rep.' : 'Parts Cost'}</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>{isEs ? 'Estado' : 'Status'}</TableHead>
                      <TableHead>{isEs ? 'Creado' : 'Created'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.contract_name}</TableCell>
                        <TableCell>{c.customer_name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize text-xs">{c.contract_type}</Badge></TableCell>
                        <TableCell className="font-medium">{fmt(c.total_contract_value || c.annual_value)}</TableCell>
                        <TableCell className="text-xs">{fmt(c.estimated_parts_cost || 0)}</TableCell>
                        <TableCell>{c.sla_response_hours}h</TableCell>
                        <TableCell><Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge></TableCell>
                        <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
