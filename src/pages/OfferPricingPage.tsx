import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  Calculator, Plus, Trash2, Brain, TrendingUp, AlertTriangle, Shield,
  DollarSign, BarChart3, Lightbulb, ChevronDown, ChevronUp, Save, FileText, Loader2,
  FolderKanban, ArrowRight
} from 'lucide-react';

type CostLine = {
  id: string;
  category: string;
  lineItem: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  surchargePct: number;
  hours: number;
  hourlyRate: number;
  days: number;
  resources: number;
  notes: string;
};

type OfferItem = {
  id: string;
  name: string;
  type: 'product' | 'service' | 'package';
  quantity: number;
  description: string;
  costLines: CostLine[];
};

type Scenario = {
  type: string;
  totalCost: number;
  sellingPrice: number;
  marginAmount: number;
  marginPct: number;
  riskLevel: string;
  adjustments?: string;
};

type AnalysisResult = {
  scenarios: Scenario[];
  scoring: { marginScore: string; marginValue?: number; riskScore: string; riskValue?: number; globalScore: number; explanation: string };
  riskFactors: { category: string; description: string; severity: string; impact?: string }[];
  recommendations: { type: string; title: string; description: string; estimatedImpact?: string }[];
  costAnalysis?: { materialsRatio: number; engineeringRatio: number; installationRatio: number; alerts?: string[] };
  pricingStrategies?: { costPlus?: { price: number; margin: number }; valueBased?: { price: number; margin: number; rationale: string }; benchmarking?: { price: number; margin: number; rationale: string } };
};

const CATEGORIES = [
  { value: 'materials', label: 'Materials & Equipment' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'subcontracting', label: 'Subcontracting' },
  { value: 'installation', label: 'Installation' },
  { value: 'transport', label: 'Transport & Logistics' },
  { value: 'indirect', label: 'Indirect Costs & Fees' },
];

const CATEGORIES_ES: Record<string, string> = {
  materials: 'Materiales y Equipos',
  engineering: 'Ingeniería',
  subcontracting: 'Subcontratación',
  installation: 'Instalación',
  transport: 'Transporte y Logística',
  indirect: 'Costes Indirectos y Tasas',
};

const newCostLine = (category: string): CostLine => ({
  id: crypto.randomUUID(),
  category,
  lineItem: '',
  quantity: 1,
  unitCost: 0,
  totalCost: 0,
  surchargePct: 0,
  hours: 0,
  hourlyRate: 0,
  days: 0,
  resources: 0,
  notes: '',
});

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function OfferPricingPage() {
  const { language } = useLanguage();
  const { activeCompanyId: selectedCompanyId } = useData();
  const isEs = language === 'es';

  const [offerTitle, setOfferTitle] = useState('');
  const [offerNumber, setOfferNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [targetMargin, setTargetMargin] = useState(20);

  const [items, setItems] = useState<OfferItem[]>([{
    id: crypto.randomUUID(), name: '', type: 'product', quantity: 1, description: '',
    costLines: CATEGORIES.map(c => newCostLine(c.value)),
  }]);

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set([items[0].id]));
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOffers, setSavedOffers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('builder');

  useEffect(() => {
    if (selectedCompanyId) loadOffers();
  }, [selectedCompanyId]);

  const loadOffers = async () => {
    if (!selectedCompanyId) return;
    const { data } = await supabase.from('offers').select('*').eq('company_id', selectedCompanyId).order('created_at', { ascending: false });
    if (data) setSavedOffers(data);
  };

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addItem = () => {
    const item: OfferItem = {
      id: crypto.randomUUID(), name: '', type: 'product', quantity: 1, description: '',
      costLines: CATEGORIES.map(c => newCostLine(c.value)),
    };
    setItems(prev => [...prev, item]);
    setExpandedItems(prev => new Set(prev).add(item.id));
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const addCostLine = (itemId: string, category: string) => {
    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, costLines: [...i.costLines, newCostLine(category)] } : i
    ));
  };

  const updateCostLine = (itemId: string, lineId: string, field: string, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        costLines: item.costLines.map(cl => {
          if (cl.id !== lineId) return cl;
          const updated = { ...cl, [field]: value };
          if (updated.category === 'engineering') {
            updated.totalCost = updated.hours * updated.hourlyRate;
          } else if (updated.category === 'installation') {
            const baseCost = updated.days * updated.resources * updated.unitCost;
            updated.totalCost = baseCost + (baseCost * updated.surchargePct / 100);
          } else {
            const base = updated.quantity * updated.unitCost;
            updated.totalCost = base + (base * updated.surchargePct / 100);
          }
          return updated;
        }),
      };
    }));
  };

  const removeCostLine = (itemId: string, lineId: string) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, costLines: item.costLines.filter(cl => cl.id !== lineId) } : item
    ));
  };

  const totals = useMemo(() => {
    const byCat: Record<string, number> = {};
    let total = 0;
    items.forEach(item => {
      item.costLines.forEach(cl => {
        byCat[cl.category] = (byCat[cl.category] || 0) + cl.totalCost * item.quantity;
        total += cl.totalCost * item.quantity;
      });
    });
    return { byCat, total, sellingPrice: total * (1 + targetMargin / 100), margin: total * targetMargin / 100 };
  }, [items, targetMargin]);

  const runAnalysis = async () => {
    if (totals.total === 0) {
      toast({ title: isEs ? 'Sin datos de costes' : 'No cost data', description: isEs ? 'Añade líneas de coste primero' : 'Add cost lines first', variant: 'destructive' });
      return;
    }
    setAnalyzing(true);
    try {
      const costBreakdown = {
        items: items.map(item => ({
          name: item.name || 'Unnamed Item',
          type: item.type,
          quantity: item.quantity,
          costs: Object.fromEntries(
            CATEGORIES.map(c => [c.value, item.costLines.filter(cl => cl.category === c.value).map(cl => ({
              lineItem: cl.lineItem, quantity: cl.quantity, unitCost: cl.unitCost, totalCost: cl.totalCost,
              hours: cl.hours, hourlyRate: cl.hourlyRate, days: cl.days, resources: cl.resources, surchargePct: cl.surchargePct,
            }))])
          ),
        })),
        totalCost: totals.total,
        targetMargin,
        currency,
      };

      const { data, error } = await supabase.functions.invoke('analyze-offer', {
        body: {
          costBreakdown,
          offerContext: { title: offerTitle, customer: customerName, project: projectDesc, offerNumber },
        },
      });

      if (error) throw error;
      if (data?.analysis) {
        setAnalysis(data.analysis);
        setActiveTab('analysis');
        toast({ title: isEs ? 'Análisis completado' : 'Analysis complete' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const saveOffer = async () => {
    if (!selectedCompanyId) {
      toast({ title: isEs ? 'Seleccione empresa' : 'Select a company', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: offer, error: offerErr } = await supabase.from('offers').insert({
        company_id: selectedCompanyId, offer_number: offerNumber, title: offerTitle,
        customer_name: customerName, project_description: projectDesc, currency, status: 'draft',
      }).select().single();
      if (offerErr) throw offerErr;

      for (const item of items) {
        const { data: dbItem, error: itemErr } = await supabase.from('offer_items').insert({
          offer_id: offer.id, item_name: item.name, item_type: item.type,
          quantity: item.quantity, description: item.description,
        }).select().single();
        if (itemErr) throw itemErr;

        const costRows = item.costLines.filter(cl => cl.totalCost > 0).map(cl => ({
          offer_item_id: dbItem.id, category: cl.category, line_item: cl.lineItem,
          quantity: cl.quantity, unit_cost: cl.unitCost, total_cost: cl.totalCost,
          surcharge_pct: cl.surchargePct, hours: cl.hours, hourly_rate: cl.hourlyRate,
          days: cl.days, resources: cl.resources, notes: cl.notes,
        }));
        if (costRows.length > 0) {
          const { error: costErr } = await supabase.from('cost_breakdowns').insert(costRows);
          if (costErr) throw costErr;
        }
      }

      if (analysis) {
        for (const s of analysis.scenarios) {
          await supabase.from('offer_scenarios').insert({
            offer_id: offer.id, scenario_type: s.type, total_cost: s.totalCost,
            selling_price: s.sellingPrice, margin_amount: s.marginAmount,
            margin_pct: s.marginPct, risk_level: s.riskLevel, ai_analysis: { adjustments: s.adjustments },
          });
        }
        await supabase.from('offer_scores').insert({
          offer_id: offer.id, margin_score: analysis.scoring.marginScore,
          risk_score: analysis.scoring.riskScore, global_score: analysis.scoring.globalScore,
          risk_factors: analysis.riskFactors, recommendations: analysis.recommendations,
          ai_explanation: analysis.scoring.explanation,
        });
      }

      toast({ title: isEs ? 'Oferta guardada' : 'Offer saved' });
      loadOffers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const scoreColor = (score: string) => {
    if (score === 'high') return 'text-green-600';
    if (score === 'medium') return 'text-yellow-600';
    return 'text-red-600';
  };

  const severityBadge = (s: string) => {
    const v = s === 'high' ? 'destructive' : s === 'medium' ? 'secondary' : 'outline';
    return <Badge variant={v as any}>{s.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            {isEs ? 'Costes, Ofertas y Pricing Intelligence' : 'Offer Costing & Pricing Intelligence'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isEs ? 'Analiza costes, simula escenarios, evalúa riesgos y optimiza precios con IA' : 'Analyze costs, simulate scenarios, evaluate risks and optimize pricing with AI'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={saveOffer} disabled={saving || !offerTitle}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isEs ? 'Guardar' : 'Save'}
          </Button>
          <Button onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
            {isEs ? 'Analizar con IA' : 'AI Analysis'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="builder">{isEs ? 'Constructor' : 'Builder'}</TabsTrigger>
          <TabsTrigger value="analysis">{isEs ? 'Análisis' : 'Analysis'}</TabsTrigger>
          <TabsTrigger value="history">{isEs ? 'Historial' : 'History'}</TabsTrigger>
          <TabsTrigger value="summary">{isEs ? 'Resumen' : 'Summary'}</TabsTrigger>
        </TabsList>

        {/* BUILDER TAB */}
        <TabsContent value="builder" className="space-y-4">
          {/* Offer header */}
          <Card>
            <CardHeader><CardTitle className="text-lg">{isEs ? 'Datos de la Oferta' : 'Offer Details'}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">{isEs ? 'Título' : 'Title'}</label>
                <Input value={offerTitle} onChange={e => setOfferTitle(e.target.value)} placeholder={isEs ? 'Ej: Línea de ensamblaje' : 'E.g: Assembly line'} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{isEs ? 'Nº Oferta' : 'Offer #'}</label>
                <Input value={offerNumber} onChange={e => setOfferNumber(e.target.value)} placeholder="OFF-2026-001" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{isEs ? 'Cliente' : 'Customer'}</label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">{isEs ? 'Descripción del proyecto' : 'Project Description'}</label>
                <Textarea value={projectDesc} onChange={e => setProjectDesc(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-foreground">{isEs ? 'Moneda' : 'Currency'}</label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">{isEs ? 'Margen objetivo (%)' : 'Target Margin (%)'}</label>
                  <Input type="number" value={targetMargin} onChange={e => setTargetMargin(Number(e.target.value))} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          {items.map((item, idx) => (
            <Card key={item.id} className="border-l-4 border-l-primary">
              <CardHeader className="cursor-pointer" onClick={() => toggleItem(item.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedItems.has(item.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <CardTitle className="text-base">
                      {item.name || `${isEs ? 'Elemento' : 'Item'} ${idx + 1}`}
                    </CardTitle>
                    <Badge variant="outline">{item.type}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {fmt(item.costLines.reduce((s, cl) => s + cl.totalCost, 0) * item.quantity)}
                    </span>
                  </div>
                  {items.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); removeItem(item.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              {expandedItems.has(item.id) && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">{isEs ? 'Nombre' : 'Name'}</label>
                      <Input value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground">{isEs ? 'Tipo' : 'Type'}</label>
                      <Select value={item.type} onValueChange={v => updateItem(item.id, 'type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product">{isEs ? 'Producto' : 'Product'}</SelectItem>
                          <SelectItem value="service">{isEs ? 'Servicio' : 'Service'}</SelectItem>
                          <SelectItem value="package">{isEs ? 'Paquete' : 'Package'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground">{isEs ? 'Cantidad' : 'Quantity'}</label>
                      <Input type="number" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} min={1} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground">{isEs ? 'Descripción' : 'Description'}</label>
                      <Input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} />
                    </div>
                  </div>

                  {CATEGORIES.map(cat => {
                    const lines = item.costLines.filter(cl => cl.category === cat.value);
                    return (
                      <div key={cat.value} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground">
                            {isEs ? CATEGORIES_ES[cat.value] : cat.label}
                            <span className="ml-2 text-muted-foreground font-normal">
                              ({fmt(lines.reduce((s, cl) => s + cl.totalCost, 0))})
                            </span>
                          </h4>
                          <Button variant="ghost" size="sm" onClick={() => addCostLine(item.id, cat.value)}>
                            <Plus className="h-3 w-3 mr-1" />{isEs ? 'Añadir' : 'Add'}
                          </Button>
                        </div>
                        {lines.length > 0 && (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[200px]">{isEs ? 'Concepto' : 'Line Item'}</TableHead>
                                  {cat.value === 'engineering' ? (
                                    <>
                                      <TableHead>{isEs ? 'Horas' : 'Hours'}</TableHead>
                                      <TableHead>{isEs ? '€/h' : '€/h'}</TableHead>
                                    </>
                                  ) : cat.value === 'installation' ? (
                                    <>
                                      <TableHead>{isEs ? 'Días' : 'Days'}</TableHead>
                                      <TableHead>{isEs ? 'Recursos' : 'Resources'}</TableHead>
                                      <TableHead>{isEs ? 'Coste/día' : 'Cost/day'}</TableHead>
                                      <TableHead>{isEs ? 'Recargo %' : 'Surcharge %'}</TableHead>
                                    </>
                                  ) : (
                                    <>
                                      <TableHead>{isEs ? 'Cant.' : 'Qty'}</TableHead>
                                      <TableHead>{isEs ? 'Coste ud.' : 'Unit Cost'}</TableHead>
                                      <TableHead>{isEs ? 'Recargo %' : 'Surcharge %'}</TableHead>
                                    </>
                                  )}
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead className="w-[40px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {lines.map(cl => (
                                  <TableRow key={cl.id}>
                                    <TableCell>
                                      <Input className="h-8 text-xs" value={cl.lineItem} onChange={e => updateCostLine(item.id, cl.id, 'lineItem', e.target.value)} />
                                    </TableCell>
                                    {cat.value === 'engineering' ? (
                                      <>
                                        <TableCell><Input className="h-8 text-xs w-20" type="number" value={cl.hours} onChange={e => updateCostLine(item.id, cl.id, 'hours', Number(e.target.value))} /></TableCell>
                                        <TableCell><Input className="h-8 text-xs w-20" type="number" value={cl.hourlyRate} onChange={e => updateCostLine(item.id, cl.id, 'hourlyRate', Number(e.target.value))} /></TableCell>
                                      </>
                                    ) : cat.value === 'installation' ? (
                                      <>
                                        <TableCell><Input className="h-8 text-xs w-16" type="number" value={cl.days} onChange={e => updateCostLine(item.id, cl.id, 'days', Number(e.target.value))} /></TableCell>
                                        <TableCell><Input className="h-8 text-xs w-16" type="number" value={cl.resources} onChange={e => updateCostLine(item.id, cl.id, 'resources', Number(e.target.value))} /></TableCell>
                                        <TableCell><Input className="h-8 text-xs w-20" type="number" value={cl.unitCost} onChange={e => updateCostLine(item.id, cl.id, 'unitCost', Number(e.target.value))} /></TableCell>
                                        <TableCell><Input className="h-8 text-xs w-16" type="number" value={cl.surchargePct} onChange={e => updateCostLine(item.id, cl.id, 'surchargePct', Number(e.target.value))} /></TableCell>
                                      </>
                                    ) : (
                                      <>
                                        <TableCell><Input className="h-8 text-xs w-16" type="number" value={cl.quantity} onChange={e => updateCostLine(item.id, cl.id, 'quantity', Number(e.target.value))} /></TableCell>
                                        <TableCell><Input className="h-8 text-xs w-24" type="number" value={cl.unitCost} onChange={e => updateCostLine(item.id, cl.id, 'unitCost', Number(e.target.value))} /></TableCell>
                                        <TableCell><Input className="h-8 text-xs w-16" type="number" value={cl.surchargePct} onChange={e => updateCostLine(item.id, cl.id, 'surchargePct', Number(e.target.value))} /></TableCell>
                                      </>
                                    )}
                                    <TableCell className="text-right font-medium">{fmt(cl.totalCost)}</TableCell>
                                    <TableCell>
                                      <Button variant="ghost" size="sm" onClick={() => removeCostLine(item.id, cl.id)}>
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          ))}

          <Button variant="outline" className="w-full" onClick={addItem}>
            <Plus className="h-4 w-4 mr-2" />
            {isEs ? 'Añadir Producto/Servicio' : 'Add Product/Service'}
          </Button>

          {/* Totals card */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? 'Coste Total' : 'Total Cost'}</p>
                  <p className="text-xl font-bold text-foreground">{fmt(totals.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? 'Precio Venta' : 'Selling Price'}</p>
                  <p className="text-xl font-bold text-primary">{fmt(totals.sellingPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? 'Margen' : 'Margin'}</p>
                  <p className="text-xl font-bold text-green-600">{fmt(totals.margin)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? 'Margen %' : 'Margin %'}</p>
                  <p className="text-xl font-bold text-green-600">{fmtPct(totals.total > 0 ? (totals.margin / totals.sellingPrice) * 100 : 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYSIS TAB */}
        <TabsContent value="analysis" className="space-y-4">
          {!analysis ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{isEs ? 'Ejecuta el análisis IA para ver resultados' : 'Run AI analysis to see results'}</p>
            </CardContent></Card>
          ) : (
            <>
              {/* Scenarios */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />{isEs ? 'Escenarios' : 'Scenarios'}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analysis.scenarios.map(s => (
                      <Card key={s.type} className={s.type === 'base' ? 'border-primary border-2' : ''}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm capitalize flex items-center justify-between">
                            {s.type === 'conservative' ? (isEs ? 'Conservador' : 'Conservative') : s.type === 'base' ? 'Base' : (isEs ? 'Optimizado' : 'Optimized')}
                            {severityBadge(s.riskLevel)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">{isEs ? 'Coste' : 'Cost'}</span><span className="font-medium">{fmt(s.totalCost)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{isEs ? 'Precio' : 'Price'}</span><span className="font-medium">{fmt(s.sellingPrice)}</span></div>
                          <Separator />
                          <div className="flex justify-between"><span className="text-muted-foreground">{isEs ? 'Margen' : 'Margin'}</span><span className="font-bold text-green-600">{fmt(s.marginAmount)} ({fmtPct(s.marginPct)})</span></div>
                          {s.adjustments && <p className="text-xs text-muted-foreground mt-2">{s.adjustments}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Scoring */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />{isEs ? 'Scoring' : 'Scoring'}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">{isEs ? 'Margen' : 'Margin'}</p>
                      <p className={`text-2xl font-bold uppercase ${scoreColor(analysis.scoring.marginScore)}`}>{analysis.scoring.marginScore}</p>
                      {analysis.scoring.marginValue != null && <Progress value={analysis.scoring.marginValue} className="h-2" />}
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">{isEs ? 'Riesgo' : 'Risk'}</p>
                      <p className={`text-2xl font-bold uppercase ${scoreColor(analysis.scoring.riskScore === 'low' ? 'high' : analysis.scoring.riskScore === 'high' ? 'low' : 'medium')}`}>{analysis.scoring.riskScore}</p>
                      {analysis.scoring.riskValue != null && <Progress value={analysis.scoring.riskValue} className="h-2" />}
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">Global</p>
                      <p className="text-2xl font-bold text-primary">{analysis.scoring.globalScore}/100</p>
                      <Progress value={analysis.scoring.globalScore} className="h-2" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">{analysis.scoring.explanation}</p>
                </CardContent>
              </Card>

              {/* Pricing Strategies */}
              {analysis.pricingStrategies && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" />{isEs ? 'Estrategias de Precio' : 'Pricing Strategies'}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {analysis.pricingStrategies.costPlus && (
                        <div className="space-y-1">
                          <p className="font-medium text-sm">Cost-Plus</p>
                          <p className="text-lg font-bold">{fmt(analysis.pricingStrategies.costPlus.price)}</p>
                          <p className="text-xs text-muted-foreground">{isEs ? 'Margen' : 'Margin'}: {fmtPct(analysis.pricingStrategies.costPlus.margin)}</p>
                        </div>
                      )}
                      {analysis.pricingStrategies.valueBased && (
                        <div className="space-y-1">
                          <p className="font-medium text-sm">Value-Based</p>
                          <p className="text-lg font-bold">{fmt(analysis.pricingStrategies.valueBased.price)}</p>
                          <p className="text-xs text-muted-foreground">{analysis.pricingStrategies.valueBased.rationale}</p>
                        </div>
                      )}
                      {analysis.pricingStrategies.benchmarking && (
                        <div className="space-y-1">
                          <p className="font-medium text-sm">Benchmarking</p>
                          <p className="text-lg font-bold">{fmt(analysis.pricingStrategies.benchmarking.price)}</p>
                          <p className="text-xs text-muted-foreground">{analysis.pricingStrategies.benchmarking.rationale}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Risk Factors */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />{isEs ? 'Riesgos Detectados' : 'Detected Risks'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {analysis.riskFactors.map((r, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      {severityBadge(r.severity)}
                      <div>
                        <p className="text-sm font-medium">{r.category}</p>
                        <p className="text-sm text-muted-foreground">{r.description}</p>
                        {r.impact && <p className="text-xs text-muted-foreground mt-1">{isEs ? 'Impacto' : 'Impact'}: {r.impact}</p>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-500" />{isEs ? 'Recomendaciones' : 'Recommendations'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {analysis.recommendations.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{r.type.replace('_', ' ')}</Badge>
                        <p className="text-sm font-medium">{r.title}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{r.description}</p>
                      {r.estimatedImpact && <p className="text-xs text-primary mt-1">{isEs ? 'Impacto estimado' : 'Est. impact'}: {r.estimatedImpact}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />{isEs ? 'Ofertas Guardadas' : 'Saved Offers'}</CardTitle></CardHeader>
            <CardContent>
              {savedOffers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{isEs ? 'Sin ofertas guardadas' : 'No saved offers'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEs ? 'Nº Oferta' : 'Offer #'}</TableHead>
                      <TableHead>{isEs ? 'Título' : 'Title'}</TableHead>
                      <TableHead>{isEs ? 'Cliente' : 'Customer'}</TableHead>
                      <TableHead>{isEs ? 'Estado' : 'Status'}</TableHead>
                      <TableHead>{isEs ? 'Fecha' : 'Date'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {savedOffers.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-sm">{o.offer_number || '-'}</TableCell>
                        <TableCell>{o.title}</TableCell>
                        <TableCell>{o.customer_name}</TableCell>
                        <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUMMARY TAB */}
        <TabsContent value="summary">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />{isEs ? 'Resumen Económico' : 'Economic Summary'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">{isEs ? 'Coste Total' : 'Total Cost'}</p>
                  <p className="text-xl font-bold">{fmt(totals.total)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">{isEs ? 'Precio Venta' : 'Selling Price'}</p>
                  <p className="text-xl font-bold text-primary">{fmt(totals.sellingPrice)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">{isEs ? 'Margen €' : 'Margin €'}</p>
                  <p className="text-xl font-bold text-green-600">{fmt(totals.margin)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">{isEs ? 'Margen %' : 'Margin %'}</p>
                  <p className="text-xl font-bold text-green-600">{fmtPct(totals.total > 0 ? (totals.margin / totals.sellingPrice) * 100 : 0)}</p>
                </div>
              </div>

              <Separator />
              <h3 className="font-semibold text-foreground">{isEs ? 'Desglose por categoría' : 'Breakdown by Category'}</h3>
              <div className="space-y-2">
                {CATEGORIES.map(c => {
                  const val = totals.byCat[c.value] || 0;
                  const pct = totals.total > 0 ? (val / totals.total) * 100 : 0;
                  return (
                    <div key={c.value} className="flex items-center gap-3">
                      <span className="text-sm w-40 truncate">{isEs ? CATEGORIES_ES[c.value] : c.label}</span>
                      <Progress value={pct} className="flex-1 h-2" />
                      <span className="text-sm font-medium w-24 text-right">{fmt(val)}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">{fmtPct(pct)}</span>
                    </div>
                  );
                })}
              </div>

              <Separator />
              <h3 className="font-semibold text-foreground">{isEs ? 'Elementos de la oferta' : 'Offer Items'}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEs ? 'Nombre' : 'Name'}</TableHead>
                    <TableHead>{isEs ? 'Tipo' : 'Type'}</TableHead>
                    <TableHead>{isEs ? 'Cant.' : 'Qty'}</TableHead>
                    <TableHead className="text-right">{isEs ? 'Coste ud.' : 'Unit Cost'}</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => {
                    const unitCost = item.costLines.reduce((s, cl) => s + cl.totalCost, 0);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.name || '-'}</TableCell>
                        <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-right">{fmt(unitCost)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(unitCost * item.quantity)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
