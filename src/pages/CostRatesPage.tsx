import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_INGECART_POLICY } from '@/lib/utils';
import {
  Settings2, Plus, Trash2, Save, Loader2, History, Filter,
  DollarSign, Percent, Clock, Shield, TrendingUp, AlertTriangle
} from 'lucide-react';

const RATE_TYPES = [
  { value: 'labour', label: 'Labour Rate', labelEs: 'Tasa de Mano de Obra', icon: Clock },
  { value: 'overhead', label: 'Overhead Rate', labelEs: 'Tasa de Gastos Generales', icon: Percent },
  { value: 'machine', label: 'Machine Rate', labelEs: 'Tasa de Máquina', icon: Settings2 },
  { value: 'freight', label: 'Freight & Logistics', labelEs: 'Flete y Logística', icon: TrendingUp },
  { value: 'insurance_liability', label: 'Liability Insurance', labelEs: 'Seguro de Responsabilidad', icon: Shield },
  { value: 'insurance_transport', label: 'Transport Insurance', labelEs: 'Seguro de Transporte', icon: Shield },
  { value: 'insurance_currency', label: 'Currency Exchange Insurance', labelEs: 'Seguro de Cambio', icon: Shield },
  { value: 'financial', label: 'Financial Costs', labelEs: 'Costes Financieros', icon: DollarSign },
  { value: 'contingency', label: 'Contingency', labelEs: 'Contingencia', icon: AlertTriangle },
  { value: 'efficiency', label: 'Efficiency Rate', labelEs: 'Tasa de Eficiencia', icon: TrendingUp },
  { value: 'risk_factor', label: 'Risk Factor Rate', labelEs: 'Factor de Riesgo', icon: AlertTriangle },
  { value: 'margin_minimum', label: 'Minimum Margin', labelEs: 'Margen Mínimo', icon: DollarSign },
  { value: 'margin_target', label: 'Target Margin', labelEs: 'Margen Objetivo', icon: TrendingUp },
];

const RATE_UNITS = [
  { value: 'eur_per_hour', label: '€/hour' },
  { value: 'percentage', label: '%' },
  { value: 'flat', label: '€ (flat)' },
  { value: 'eur_per_day', label: '€/day' },
  { value: 'eur_per_km', label: '€/km' },
];

type CostRate = {
  id: string;
  company_id: string;
  rate_type: string;
  rate_name: string;
  rate_value: number;
  rate_unit: string;
  department: string;
  project_type: string;
  geography: string;
  version: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

const fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);

export default function CostRatesPage() {
  const { language } = useLanguage();
  const { activeCompanyId } = useData();
  const isEs = language === 'es';

  const [rates, setRates] = useState<CostRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterDept, setFilterDept] = useState('');
  const [activeTab, setActiveTab] = useState('rates');
  const [policy, setPolicy] = useState(DEFAULT_INGECART_POLICY);

  const applyIngecartDefaults = () => {
    setPolicy(DEFAULT_INGECART_POLICY);
    toast({
      title: isEs ? 'Configuración Ingecart aplicada' : 'Ingecart defaults applied',
      description: isEs ? 'Se han cargado los valores base de costes, viajes y instalación.' : 'The default cost, travel and installation values have been loaded.',
    });
  };

  const savePolicyToRates = async () => {
    if (!activeCompanyId) return;
    const rows = [
      { rate_type: 'financial', rate_name: 'Financial cost', rate_value: policy.financialPct, rate_unit: 'percentage', department: 'Finance', project_type: 'All', geography: 'Global' },
      { rate_type: 'contingency', rate_name: 'Warranty & guarantee', rate_value: policy.warrantyPct, rate_unit: 'percentage', department: 'Commercial', project_type: 'All', geography: 'Global' },
      { rate_type: 'overhead', rate_name: 'Commercial management', rate_value: policy.commercialMgmtPct, rate_unit: 'percentage', department: 'Sales', project_type: 'All', geography: 'Global' },
      { rate_type: 'material', rate_name: 'Material structure overhead', rate_value: policy.materialStructurePct, rate_unit: 'percentage', department: 'Procurement', project_type: 'All', geography: 'Global' },
      { rate_type: 'labour', rate_name: 'Installation labor rate', rate_value: policy.installationLaborRate, rate_unit: 'eur_per_hour', department: 'Installation', project_type: 'Field', geography: 'Spain' },
      { rate_type: 'transport', rate_name: 'Hotel Europe', rate_value: policy.hotelEurope, rate_unit: 'flat', department: 'Travel', project_type: 'Field', geography: 'Europe' },
      { rate_type: 'transport', rate_name: 'Hotel USA', rate_value: policy.hotelUsa, rate_unit: 'flat', department: 'Travel', project_type: 'Field', geography: 'USA' },
      { rate_type: 'transport', rate_name: 'Flight Europe', rate_value: policy.flightEurope, rate_unit: 'flat', department: 'Travel', project_type: 'Field', geography: 'Europe' },
      { rate_type: 'transport', rate_name: 'Flight USA', rate_value: policy.flightUsa, rate_unit: 'flat', department: 'Travel', project_type: 'Field', geography: 'USA' },
      { rate_type: 'transport', rate_name: 'Rental car', rate_value: policy.rentalCarPerDay, rate_unit: 'eur_per_day', department: 'Travel', project_type: 'Field', geography: 'Global' },
      { rate_type: 'freight', rate_name: 'Mileage', rate_value: policy.kmRate, rate_unit: 'eur_per_km', department: 'Travel', project_type: 'Field', geography: 'Global' },
    ];

    setSaving(true);
    try {
      const { error } = await supabase.from('cost_rates').upsert(
        rows.map((row, index) => ({
          id: `${activeCompanyId}-${row.rate_type}-${index}-${row.rate_name}`.replace(/\s+/g, '-').toLowerCase(),
          company_id: activeCompanyId,
          rate_type: row.rate_type,
          rate_name: row.rate_name,
          rate_value: row.rate_value,
          rate_unit: row.rate_unit,
          department: row.department,
          project_type: row.project_type,
          geography: row.geography,
          version: 1,
          is_active: true,
          valid_from: new Date().toISOString().split('T')[0],
          valid_until: null,
          notes: 'Applied from Ingecart commercial policy',
        }))
      );
      if (error) throw error;
      toast({ title: isEs ? 'Política guardada' : 'Policy saved', description: isEs ? 'Los valores base han quedado disponibles para ofertas y costes.' : 'The base values are now available in offers and cost controls.' });
      loadRates();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { if (activeCompanyId) loadRates(); }, [activeCompanyId]);

  const loadRates = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('cost_rates')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('rate_type')
      .order('version', { ascending: false });
    if (data) setRates(data as CostRate[]);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    setLoading(false);
  };

  const addRate = () => {
    if (!activeCompanyId) return;
    const newRate: CostRate = {
      id: crypto.randomUUID(),
      company_id: activeCompanyId,
      rate_type: 'labour',
      rate_name: '',
      rate_value: 0,
      rate_unit: 'eur_per_hour',
      department: '',
      project_type: '',
      geography: '',
      version: 1,
      is_active: true,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: null,
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setRates(prev => [newRate, ...prev]);
  };

  const updateRate = (id: string, field: string, value: any) => {
    setRates(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const deleteRate = async (id: string) => {
    const rate = rates.find(r => r.id === id);
    if (rate?.created_at !== rate?.updated_at) {
      await supabase.from('cost_rates').delete().eq('id', id);
    }
    setRates(prev => prev.filter(r => r.id !== id));
    toast({ title: isEs ? 'Tasa eliminada' : 'Rate deleted' });
  };

  const saveAll = async () => {
    if (!activeCompanyId) return;
    setSaving(true);
    try {
      for (const rate of rates) {
        const payload = {
          company_id: activeCompanyId,
          rate_type: rate.rate_type,
          rate_name: rate.rate_name,
          rate_value: rate.rate_value,
          rate_unit: rate.rate_unit,
          department: rate.department || '',
          project_type: rate.project_type || '',
          geography: rate.geography || '',
          version: rate.version,
          is_active: rate.is_active,
          valid_from: rate.valid_from,
          valid_until: rate.valid_until,
          notes: rate.notes || '',
        };
        const { error } = await supabase.from('cost_rates').upsert({ id: rate.id, ...payload });
        if (error) throw error;
      }
      toast({ title: isEs ? 'Tasas guardadas' : 'Rates saved' });
      loadRates();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const newVersion = (rate: CostRate) => {
    const newR: CostRate = {
      ...rate,
      id: crypto.randomUUID(),
      version: rate.version + 1,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Deactivate the old version
    updateRate(rate.id, 'is_active', false);
    updateRate(rate.id, 'valid_until', new Date().toISOString().split('T')[0]);
    setRates(prev => [newR, ...prev]);
  };

  const filteredRates = useMemo(() => {
    return rates.filter(r => {
      if (filterType !== 'all' && r.rate_type !== filterType) return false;
      if (filterDept && r.department && !r.department.toLowerCase().includes(filterDept.toLowerCase())) return false;
      return true;
    });
  }, [rates, filterType, filterDept]);

  const activeRates = useMemo(() => rates.filter(r => r.is_active), [rates]);
  const inactiveRates = useMemo(() => rates.filter(r => !r.is_active), [rates]);

  const ratesByType = useMemo(() => {
    const grouped: Record<string, CostRate[]> = {};
    activeRates.forEach(r => {
      if (!grouped[r.rate_type]) grouped[r.rate_type] = [];
      grouped[r.rate_type].push(r);
    });
    return grouped;
  }, [activeRates]);

  const getTypeInfo = (type: string) => RATE_TYPES.find(t => t.value === type);

  if (!activeCompanyId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {isEs ? 'Seleccione una empresa primero' : 'Select a company first'}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            {isEs ? 'Control de Tasas y Costes' : 'Cost & Rate Control'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isEs ? 'Gestiona tasas laborales, overheads, seguros, contingencias y márgenes' : 'Manage labour rates, overheads, insurance, contingencies and margins'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addRate}>
            <Plus className="h-4 w-4 mr-2" />{isEs ? 'Nueva Tasa' : 'New Rate'}
          </Button>
          <Button onClick={saveAll} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isEs ? 'Guardar Todo' : 'Save All'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rates">{isEs ? 'Tasas Activas' : 'Active Rates'} ({activeRates.length})</TabsTrigger>
          <TabsTrigger value="policy">{isEs ? 'Política' : 'Policy'}</TabsTrigger>
          <TabsTrigger value="overview">{isEs ? 'Vista General' : 'Overview'}</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />{isEs ? 'Historial' : 'History'} ({inactiveRates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{isEs ? 'Configuración de costes comerciales' : 'Commercial cost configuration'}</CardTitle>
              <CardDescription>
                {isEs ? 'Valores base para garantías, financiación, gestión comercial, estructura de materiales y viajes de instalación.' : 'Base values for warranty, financing, commercial management, material structure and installation travel.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={applyIngecartDefaults}>{isEs ? 'Cargar plantilla Ingecart' : 'Load Ingecart template'}</Button>
                <Button onClick={savePolicyToRates} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}{isEs ? 'Guardar política' : 'Save policy'}</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Garantía (%)' : 'Warranty (%)'}</label>
                  <Input type="number" value={policy.warrantyPct} onChange={(e) => setPolicy({ ...policy, warrantyPct: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Gastos financieros (%)' : 'Financial cost (%)'}</label>
                  <Input type="number" value={policy.financialPct} onChange={(e) => setPolicy({ ...policy, financialPct: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Gestión comercial (%)' : 'Commercial management (%)'}</label>
                  <Input type="number" value={policy.commercialMgmtPct} onChange={(e) => setPolicy({ ...policy, commercialMgmtPct: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Estructura empresa (%)' : 'Company structure (%)'}</label>
                  <Input type="number" value={policy.materialStructurePct} onChange={(e) => setPolicy({ ...policy, materialStructurePct: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Coste hora montaje' : 'Assembly hourly rate'}</label>
                  <Input type="number" value={policy.installationLaborRate} onChange={(e) => setPolicy({ ...policy, installationLaborRate: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Hora extra labor' : 'Labor supplement'}</label>
                  <Input type="number" value={policy.laborSupplement} onChange={(e) => setPolicy({ ...policy, laborSupplement: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Complemento festivo' : 'Festive supplement'}</label>
                  <Input type="number" value={policy.festiveSupplement} onChange={(e) => setPolicy({ ...policy, festiveSupplement: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Dieta España (€)' : 'Diet Spain (€)'}</label>
                  <Input type="number" value={policy.dietSpain} onChange={(e) => setPolicy({ ...policy, dietSpain: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Dieta internacional (€)' : 'Overseas diet (€)'}</label>
                  <Input type="number" value={policy.dietInternational} onChange={(e) => setPolicy({ ...policy, dietInternational: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Hotel Europa (€)' : 'Hotel Europe (€)'}</label>
                  <Input type="number" value={policy.hotelEurope} onChange={(e) => setPolicy({ ...policy, hotelEurope: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Hotel USA (€)' : 'Hotel USA (€)'}</label>
                  <Input type="number" value={policy.hotelUsa} onChange={(e) => setPolicy({ ...policy, hotelUsa: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Avión Europa (€)' : 'Flight Europe (€)'}</label>
                  <Input type="number" value={policy.flightEurope} onChange={(e) => setPolicy({ ...policy, flightEurope: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Avión USA (€)' : 'Flight USA (€)'}</label>
                  <Input type="number" value={policy.flightUsa} onChange={(e) => setPolicy({ ...policy, flightUsa: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Coche alquiler (€ / día)' : 'Rental car (€ / day)'}</label>
                  <Input type="number" value={policy.rentalCarPerDay} onChange={(e) => setPolicy({ ...policy, rentalCarPerDay: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-medium">{isEs ? 'Km (€ / km)' : 'Mileage (€ / km)'}</label>
                  <Input type="number" value={policy.kmRate} onChange={(e) => setPolicy({ ...policy, kmRate: Number(e.target.value) })} />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="font-medium mb-2">{isEs ? 'Bloques de instalación recomendados' : 'Recommended installation blocks'}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {policy.serviceBlocks.map((block) => (
                    <div key={block.name} className="rounded-md border bg-background p-2 text-sm">
                      <div className="font-medium">{block.name}</div>
                      <div>{block.days} {isEs ? 'días' : 'days'} · {block.technicians} {isEs ? 'técnicos' : 'techs'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVE RATES TAB */}
        <TabsContent value="rates" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <label className="text-xs font-medium text-foreground">{isEs ? 'Tipo de Tasa' : 'Rate Type'}</label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isEs ? 'Todos' : 'All'}</SelectItem>
                      {RATE_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{isEs ? t.labelEs : t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">{isEs ? 'Departamento' : 'Department'}</label>
                  <Input className="w-40" value={filterDept} onChange={e => setFilterDept(e.target.value)} placeholder={isEs ? 'Filtrar...' : 'Filter...'} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rate table */}
          {loading ? (
            <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
          ) : filteredRates.filter(r => r.is_active).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{isEs ? 'No hay tasas configuradas. Añade tasas para controlar los costes de tus ofertas.' : 'No rates configured. Add rates to control your offer costs.'}</p>
                <Button variant="outline" className="mt-4" onClick={addRate}>
                  <Plus className="h-4 w-4 mr-2" />{isEs ? 'Añadir Primera Tasa' : 'Add First Rate'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">{isEs ? 'Tipo' : 'Type'}</TableHead>
                        <TableHead className="w-[180px]">{isEs ? 'Nombre' : 'Name'}</TableHead>
                        <TableHead className="w-[100px]">{isEs ? 'Valor' : 'Value'}</TableHead>
                        <TableHead className="w-[110px]">{isEs ? 'Unidad' : 'Unit'}</TableHead>
                        <TableHead className="w-[120px]">{isEs ? 'Depto.' : 'Dept.'}</TableHead>
                        <TableHead className="w-[120px]">{isEs ? 'Tipo Proy.' : 'Proj. Type'}</TableHead>
                        <TableHead className="w-[100px]">{isEs ? 'Geografía' : 'Geography'}</TableHead>
                        <TableHead className="w-[90px]">V.</TableHead>
                        <TableHead className="w-[100px]">{isEs ? 'Desde' : 'From'}</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRates.filter(r => r.is_active).map(rate => (
                        <TableRow key={rate.id}>
                          <TableCell>
                            <Select value={rate.rate_type} onValueChange={v => updateRate(rate.id, 'rate_type', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {RATE_TYPES.map(t => (
                                  <SelectItem key={t.value} value={t.value}>{isEs ? t.labelEs : t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 text-xs" value={rate.rate_name} onChange={e => updateRate(rate.id, 'rate_name', e.target.value)} placeholder={isEs ? 'Ej: Técnico Senior' : 'E.g: Senior Technician'} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 text-xs w-20" type="number" value={rate.rate_value} onChange={e => updateRate(rate.id, 'rate_value', Number(e.target.value))} />
                          </TableCell>
                          <TableCell>
                            <Select value={rate.rate_unit} onValueChange={v => updateRate(rate.id, 'rate_unit', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {RATE_UNITS.map(u => (
                                  <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 text-xs" value={rate.department} onChange={e => updateRate(rate.id, 'department', e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 text-xs" value={rate.project_type} onChange={e => updateRate(rate.id, 'project_type', e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 text-xs" value={rate.geography} onChange={e => updateRate(rate.id, 'geography', e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">v{rate.version}</Badge>
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 text-xs" type="date" value={rate.valid_from || ''} onChange={e => updateRate(rate.id, 'valid_from', e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => newVersion(rate)} title={isEs ? 'Nueva versión' : 'New version'}>
                                <History className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteRate(rate.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          {Object.keys(ratesByType).length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              {isEs ? 'Sin tasas activas' : 'No active rates'}
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {RATE_TYPES.map(type => {
                const typeRates = ratesByType[type.value];
                if (!typeRates || typeRates.length === 0) return null;
                const Icon = type.icon;
                return (
                  <Card key={type.value}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        {isEs ? type.labelEs : type.label}
                      </CardTitle>
                      <CardDescription>{typeRates.length} {isEs ? 'tasa(s) activa(s)' : 'active rate(s)'}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {typeRates.map(r => (
                        <div key={r.id} className="flex justify-between items-center text-sm p-2 rounded bg-muted/50">
                          <div>
                            <p className="font-medium">{r.rate_name || '-'}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.department && `${r.department} • `}
                              {r.geography && `${r.geography} • `}
                              v{r.version}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">{fmt(r.rate_value)}</p>
                            <p className="text-xs text-muted-foreground">
                              {RATE_UNITS.find(u => u.value === r.rate_unit)?.label || r.rate_unit}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>{isEs ? 'Historial de Versiones' : 'Rate Version History'}</CardTitle></CardHeader>
            <CardContent>
              {inactiveRates.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{isEs ? 'Sin versiones anteriores' : 'No previous versions'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEs ? 'Tipo' : 'Type'}</TableHead>
                      <TableHead>{isEs ? 'Nombre' : 'Name'}</TableHead>
                      <TableHead>{isEs ? 'Valor' : 'Value'}</TableHead>
                      <TableHead>{isEs ? 'Unidad' : 'Unit'}</TableHead>
                      <TableHead>V.</TableHead>
                      <TableHead>{isEs ? 'Válido desde' : 'Valid from'}</TableHead>
                      <TableHead>{isEs ? 'Válido hasta' : 'Valid until'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveRates.map(r => (
                      <TableRow key={r.id} className="opacity-60">
                        <TableCell>{getTypeInfo(r.rate_type)?.[isEs ? 'labelEs' : 'label'] || r.rate_type}</TableCell>
                        <TableCell>{r.rate_name}</TableCell>
                        <TableCell>{fmt(r.rate_value)}</TableCell>
                        <TableCell>{RATE_UNITS.find(u => u.value === r.rate_unit)?.label || r.rate_unit}</TableCell>
                        <TableCell><Badge variant="outline">v{r.version}</Badge></TableCell>
                        <TableCell>{r.valid_from || '-'}</TableCell>
                        <TableCell>{r.valid_until || '-'}</TableCell>
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
