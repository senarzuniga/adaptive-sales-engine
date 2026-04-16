import { useState, useMemo } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CompanySelector } from '@/components/CompanySelector';
import {
  Search, Plus, FileText, TrendingUp, TrendingDown, Shield, Target,
  Building2, DollarSign, Package, Globe, Swords, Brain, Diamond,
  AlertTriangle, ArrowRight, Loader2, ChevronRight, BarChart3,
  Clock, CheckCircle2, XCircle, Lightbulb, Eye
} from 'lucide-react';
import { buildFallbackIntelligenceReport } from '@/lib/businessIntelligenceFallback';

type Report = {
  id: string;
  target_company_name: string;
  target_company_website: string;
  report_type: string;
  status: string;
  executive_summary: string;
  company_profile: any;
  financial_analysis: any;
  product_analysis: any;
  market_analysis: any;
  competitive_analysis: any;
  strategic_analysis: any;
  valuation: any;
  sale_propensity: any;
  future_scenarios: any;
  recommendations: any;
  data_sources: any;
  hypothesis_log: any;
  created_at: string;
  updated_at: string;
  company_id: string;
};

const ConfidenceBadge = ({ level }: { level: string }) => {
  const color = level === 'HIGH' ? 'bg-green-500/10 text-green-700' :
    level === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-700' : 'bg-red-500/10 text-red-700';
  return <Badge className={`${color} text-xs`}>{level}</Badge>;
};

const SectionCard = ({ icon: Icon, title, children, className = '' }: any) => (
  <Card className={className}>
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="text-sm space-y-3">{children}</CardContent>
  </Card>
);

export default function BusinessIntelligencePage() {
  const { activeCompanyId: selectedCompanyId, data: workspaceData } = useData();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyWebsite, setNewCompanyWebsite] = useState('');
  const [subjectType, setSubjectType] = useState('company');
  const [analysisType, setAnalysisType] = useState('full');
  const [analysisBrief, setAnalysisBrief] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState('reports');

  const subjectPresets = [
    { label: language === 'es' ? 'Región geográfica' : 'Geographical region', subjectType: 'geographical', analysisType: 'geographic-market', name: 'Southern Europe packaging market', brief: 'Analyze demand, industry segments, typical company profiles, and commercial access routes.' },
    { label: language === 'es' ? 'Sector industrial' : 'Industry sector', subjectType: 'sector', analysisType: 'sector-landscape', name: 'Carton board sector', brief: 'Review sector structure, key players, growth logic, and strategic opportunities by region.' },
    { label: language === 'es' ? 'Proceso productivo' : 'Production process', subjectType: 'process', analysisType: 'process-analysis', name: 'Carton board production process', brief: 'Analyze production stages, bottlenecks, supplier relevance, value drivers, and commercial opportunities.' },
    { label: language === 'es' ? 'Trade show' : 'Trade show', subjectType: 'trade-show', analysisType: 'trade-show', name: 'Packaging trade show in Germany', brief: 'Assess participant profile, takeaways, key themes, and relevance for business development.' },
  ];

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['bi-reports', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const { data, error } = await supabase
        .from('business_intelligence_reports')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Report[];
    },
    enabled: !!selectedCompanyId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId || !newCompanyName.trim()) throw new Error('Missing data');

      const reportType = `${subjectType}:${analysisType}`;
      const { data: report, error: insertErr } = await supabase
        .from('business_intelligence_reports')
        .insert({
          company_id: selectedCompanyId,
          target_company_name: newCompanyName.trim(),
          target_company_website: newCompanyWebsite.trim(),
          report_type: reportType,
          status: 'pending',
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      try {
        const { data, error } = await supabase.functions.invoke('business-intelligence', {
          body: {
            reportId: report.id,
            targetCompanyName: newCompanyName.trim(),
            targetCompanyWebsite: newCompanyWebsite.trim(),
            companyId: selectedCompanyId,
            analysisType,
            targetSubjectType: subjectType,
            analysisBrief,
          },
        });

        if (error) throw error;
        return { fallback: false, data };
      } catch (edgeError: any) {
        const fallbackReport = buildFallbackIntelligenceReport({
          targetName: newCompanyName.trim(),
          targetWebsite: newCompanyWebsite.trim(),
          analysisType,
          subjectType: subjectType as any,
          analysisBrief,
          companyContext: workspaceData.companyProfile,
        });

        const { error: updateErr } = await supabase
          .from('business_intelligence_reports')
          .update({
            status: 'completed',
            executive_summary: fallbackReport.executive_summary,
            company_profile: fallbackReport.company_profile as any,
            financial_analysis: fallbackReport.financial_analysis as any,
            product_analysis: fallbackReport.product_analysis as any,
            market_analysis: fallbackReport.market_analysis as any,
            competitive_analysis: fallbackReport.competitive_analysis as any,
            strategic_analysis: fallbackReport.strategic_analysis as any,
            valuation: fallbackReport.valuation as any,
            sale_propensity: fallbackReport.sale_propensity as any,
            future_scenarios: fallbackReport.future_scenarios as any,
            recommendations: fallbackReport.recommendations as any,
            data_sources: fallbackReport.data_sources as any,
            hypothesis_log: fallbackReport.hypothesis_log as any,
          })
          .eq('id', report.id);

        if (updateErr) throw updateErr;
        return { fallback: true, data: { report: fallbackReport, error: edgeError?.message || 'Edge fallback used' } };
      }
    },
    onSuccess: (result: any) => {
      toast.success(result?.fallback
        ? (language === 'es' ? 'Informe generado en modo local con el nuevo alcance temático' : 'Intelligence report generated locally with expanded subject coverage')
        : (language === 'es' ? 'Informe generado con éxito' : 'Intelligence report generated successfully'));
      queryClient.invalidateQueries({ queryKey: ['bi-reports'] });
      setNewCompanyName('');
      setNewCompanyWebsite('');
      setAnalysisBrief('');
      setActiveTab('reports');
    },
    onError: (e: any) => {
      toast.error(e.message || 'Failed to generate report');
      queryClient.invalidateQueries({ queryKey: ['bi-reports'] });
    },
  });

  if (!selectedCompanyId) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Business Intelligence & Assessment</h1>
        <CompanySelector />
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {language === 'es' ? 'Selecciona una empresa base para usarla como contexto del análisis de inteligencia' : 'Select a base company to use as context for the intelligence analysis'}
          </p>
        </Card>
      </div>
    );
  }

  const statusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (s === 'generating') return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    if (s === 'failed') return <XCircle className="h-4 w-4 text-red-600" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Business Intelligence & Assessment
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'es' ? 'Sistema de inteligencia estratégica para empresas, regiones, sectores, productos y eventos' : 'Strategic intelligence system for companies, regions, sectors, products, and events'}
          </p>
        </div>
        <CompanySelector />
      </div>

      <Tabs value={selectedReport ? 'report-detail' : activeTab} onValueChange={(v) => { if (v !== 'report-detail') { setSelectedReport(null); setActiveTab(v); } }}>
        <TabsList>
          <TabsTrigger value="reports">
            <FileText className="h-4 w-4 mr-1" />
            {language === 'es' ? 'Informes' : 'Reports'}
          </TabsTrigger>
          <TabsTrigger value="new-analysis">
            <Plus className="h-4 w-4 mr-1" />
            {language === 'es' ? 'Nuevo Análisis' : 'New Analysis'}
          </TabsTrigger>
          {selectedReport && (
            <TabsTrigger value="report-detail">
              <Eye className="h-4 w-4 mr-1" />
              {selectedReport.target_company_name}
            </TabsTrigger>
          )}
        </TabsList>

        {/* REPORTS LIST */}
        <TabsContent value="reports" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : reports.length === 0 ? (
            <Card className="p-8 text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{language === 'es' ? 'No hay informes aún. Crea tu primer análisis.' : 'No reports yet. Create your first analysis.'}</p>
              <Button className="mt-4" onClick={() => setActiveTab('new-analysis')}>
                <Plus className="h-4 w-4 mr-1" /> {language === 'es' ? 'Nuevo Análisis' : 'New Analysis'}
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {reports.map((r) => (
                <Card key={r.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setSelectedReport(r); }}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {statusIcon(r.status)}
                      <div>
                        <p className="font-semibold">{r.target_company_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} · {String(r.report_type || '').replace(/:/g, ' · ')}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{r.status}</Badge>
                    </div>
                    {r.status === 'completed' && (
                      <div className="flex items-center gap-3 text-xs">
                        {r.sale_propensity?.probability && (
                          <Badge className={r.sale_propensity.probability === 'HIGH' ? 'bg-red-500/10 text-red-700' : r.sale_propensity.probability === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-700' : 'bg-green-500/10 text-green-700'}>
                            {language === 'es' ? 'Venta' : 'Sale'}: {r.sale_propensity.probability}
                          </Badge>
                        )}
                        {r.valuation?.estimated_value && (
                          <span className="text-muted-foreground font-mono">{r.valuation.estimated_value}</span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* NEW ANALYSIS */}
        <TabsContent value="new-analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'es' ? 'Nuevo Análisis de Inteligencia' : 'New Intelligence Analysis'}</CardTitle>
              <CardDescription>{language === 'es' ? 'Analiza empresas, regiones, sectores, procesos, productos o trade shows con IA estratégica' : 'Deep-analyze companies, regions, sectors, processes, products, or trade shows with strategic AI'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{language === 'es' ? 'Tipo de Sujeto' : 'Subject Type'}</Label>
                  <Select value={subjectType} onValueChange={setSubjectType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">{language === 'es' ? 'Empresa' : 'Company'}</SelectItem>
                      <SelectItem value="geographical">{language === 'es' ? 'Región geográfica' : 'Geographical region'}</SelectItem>
                      <SelectItem value="sector">{language === 'es' ? 'Sector / industria' : 'Sector / industry'}</SelectItem>
                      <SelectItem value="product">{language === 'es' ? 'Producto / solución' : 'Product / solution'}</SelectItem>
                      <SelectItem value="process">{language === 'es' ? 'Proceso productivo' : 'Production process'}</SelectItem>
                      <SelectItem value="trade-show">{language === 'es' ? 'Trade show / feria' : 'Trade show / event'}</SelectItem>
                      <SelectItem value="custom">{language === 'es' ? 'Tema libre' : 'Custom topic'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{language === 'es' ? 'Tipo de análisis' : 'Analysis type'}</Label>
                  <Select value={analysisType} onValueChange={setAnalysisType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">{language === 'es' ? 'Informe completo' : 'Full report'}</SelectItem>
                      <SelectItem value="geographic-market">{language === 'es' ? 'Análisis geográfico / mercado' : 'Geographic / market analysis'}</SelectItem>
                      <SelectItem value="sector-landscape">{language === 'es' ? 'Landscape sectorial' : 'Sector landscape'}</SelectItem>
                      <SelectItem value="product-process">{language === 'es' ? 'Producto / proceso' : 'Product / process'}</SelectItem>
                      <SelectItem value="trade-show">{language === 'es' ? 'Trade show intelligence' : 'Trade show intelligence'}</SelectItem>
                      <SelectItem value="strategic">{language === 'es' ? 'Análisis estratégico' : 'Strategic analysis'}</SelectItem>
                      <SelectItem value="financial">{language === 'es' ? 'Análisis financiero' : 'Financial analysis'}</SelectItem>
                      <SelectItem value="valuation">{language === 'es' ? 'Valoración / atractivo' : 'Valuation / attractiveness'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{language === 'es' ? 'Objetivo o sujeto a analizar' : 'Target or subject to analyze'}</Label>
                  <Input
                    placeholder={language === 'es' ? 'Ej.: carton board sector, Sur de Europa, feria de packaging, proceso productivo…' : 'e.g. carton board sector, Southern Europe, packaging trade show, production process…'}
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{language === 'es' ? 'Sitio web o fuente (opcional)' : 'Website or source (optional)'}</Label>
                  <Input
                    placeholder="https://www.example.com"
                    value={newCompanyWebsite}
                    onChange={(e) => setNewCompanyWebsite(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>{language === 'es' ? 'Brief / contexto adicional' : 'Brief / additional context'}</Label>
                <Textarea
                  value={analysisBrief}
                  onChange={(e) => setAnalysisBrief(e.target.value)}
                  placeholder={language === 'es'
                    ? 'Ej.: analizar Francia por sector, tipo de empresas, competidores, takeaways de feria, participants clave, procesos productivos, etc.'
                    : 'e.g. analyze France by sector, company types, competitors, trade-show participants, key takeaways, production process, etc.'}
                  className="min-h-[110px]"
                />
              </div>

              <div className="space-y-2">
                <Label>{language === 'es' ? 'Ejemplos rápidos' : 'Quick examples'}</Label>
                <div className="flex flex-wrap gap-2">
                  {subjectPresets.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSubjectType(preset.subjectType);
                        setAnalysisType(preset.analysisType);
                        setNewCompanyName(preset.name);
                        setAnalysisBrief(preset.brief);
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => generateMutation.mutate()}
                disabled={!newCompanyName.trim() || generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {language === 'es' ? 'Generando Informe...' : 'Generating Report...'}</>
                ) : (
                  <><Brain className="h-4 w-4 mr-2" /> {language === 'es' ? 'Generar análisis de inteligencia' : 'Generate intelligence analysis'}</>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Building2, label: language === 'es' ? 'Empresas' : 'Companies' },
              { icon: Globe, label: language === 'es' ? 'Regiones' : 'Regions' },
              { icon: Swords, label: language === 'es' ? 'Sectores' : 'Sectors' },
              { icon: Package, label: language === 'es' ? 'Productos' : 'Products' },
              { icon: Brain, label: language === 'es' ? 'Procesos' : 'Processes' },
              { icon: Target, label: language === 'es' ? 'Trade shows' : 'Trade shows' },
              { icon: DollarSign, label: language === 'es' ? 'Atractivo' : 'Attractiveness' },
              { icon: Diamond, label: language === 'es' ? 'Recomendación' : 'Recommendation' },
            ].map((m) => (
              <Card key={m.label} className="p-3 text-center">
                <m.icon className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-xs font-medium">{m.label}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* REPORT DETAIL */}
        <TabsContent value="report-detail" className="space-y-4">
          {selectedReport && selectedReport.status === 'completed' && <ReportDetail report={selectedReport} language={language} />}
          {selectedReport && selectedReport.status === 'generating' && (
            <Card className="p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg font-semibold">{language === 'es' ? 'Generando informe...' : 'Generating report...'}</p>
              <p className="text-sm text-muted-foreground mt-1">{language === 'es' ? 'Esto puede tardar 1-2 minutos' : 'This may take 1-2 minutes'}</p>
            </Card>
          )}
          {selectedReport && selectedReport.status === 'failed' && (
            <Card className="p-12 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-lg font-semibold">{language === 'es' ? 'Error al generar' : 'Generation failed'}</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportDetail({ report, language }: { report: Report; language: string }) {
  const r = report;
  const fin = r.financial_analysis || {};
  const comp = r.company_profile || {};
  const prod = r.product_analysis || {};
  const mkt = r.market_analysis || {};
  const compet = r.competitive_analysis || {};
  const strat = r.strategic_analysis || {};
  const val = r.valuation || {};
  const sale = r.sale_propensity || {};
  const future = r.future_scenarios || {};
  const recs = Array.isArray(r.recommendations) ? r.recommendations : [];

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.executive_summary}</p>
        </CardContent>
      </Card>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{language === 'es' ? 'Valor Estimado' : 'Estimated Value'}</p>
          <p className="text-lg font-bold text-primary">{val.estimated_value || 'N/A'}</p>
          {val.confidence_level && <ConfidenceBadge level={val.confidence_level} />}
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{language === 'es' ? 'Prob. Venta' : 'Sale Prob.'}</p>
          <p className={`text-lg font-bold ${sale.probability === 'HIGH' ? 'text-red-600' : sale.probability === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'}`}>
            {sale.probability || 'N/A'}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{language === 'es' ? 'Facturación Est.' : 'Revenue Est.'}</p>
          <p className="text-lg font-bold">{fin.revenue_estimate || 'N/A'}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{language === 'es' ? 'Sector' : 'Sector'}</p>
          <p className="text-lg font-bold">{comp.sector || 'N/A'}</p>
        </Card>
      </div>

      {/* Detail Sections in Tabs */}
      <Tabs defaultValue="company">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="company" className="text-xs"><Building2 className="h-3 w-3 mr-1" /> {language === 'es' ? 'Perfil' : 'Profile'}</TabsTrigger>
          <TabsTrigger value="financial" className="text-xs"><DollarSign className="h-3 w-3 mr-1" /> {language === 'es' ? 'Finanzas' : 'Financial'}</TabsTrigger>
          <TabsTrigger value="product" className="text-xs"><Package className="h-3 w-3 mr-1" /> {language === 'es' ? 'Producto' : 'Product'}</TabsTrigger>
          <TabsTrigger value="market" className="text-xs"><Globe className="h-3 w-3 mr-1" /> {language === 'es' ? 'Mercado' : 'Market'}</TabsTrigger>
          <TabsTrigger value="competition" className="text-xs"><Swords className="h-3 w-3 mr-1" /> {language === 'es' ? 'Competencia' : 'Competition'}</TabsTrigger>
          <TabsTrigger value="strategy" className="text-xs"><Brain className="h-3 w-3 mr-1" /> SWOT</TabsTrigger>
          <TabsTrigger value="valuation" className="text-xs"><Diamond className="h-3 w-3 mr-1" /> {language === 'es' ? 'Valoración' : 'Valuation'}</TabsTrigger>
          <TabsTrigger value="sale" className="text-xs"><Target className="h-3 w-3 mr-1" /> {language === 'es' ? 'Venta' : 'Sale'}</TabsTrigger>
          <TabsTrigger value="future" className="text-xs"><TrendingUp className="h-3 w-3 mr-1" /> {language === 'es' ? 'Futuro' : 'Future'}</TabsTrigger>
          <TabsTrigger value="actions" className="text-xs"><Lightbulb className="h-3 w-3 mr-1" /> {language === 'es' ? 'Acciones' : 'Actions'}</TabsTrigger>
        </TabsList>

        {/* Company Profile */}
        <TabsContent value="company">
          <SectionCard icon={Building2} title={language === 'es' ? 'Perfil del Sujeto Analizado' : 'Analyzed Subject Profile'}>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                [language === 'es' ? 'Sector' : 'Sector', comp.sector],
                [language === 'es' ? 'Subsector' : 'Sub-sector', comp.sub_sector],
                [language === 'es' ? 'Tipo' : 'Type', comp.company_type],
                [language === 'es' ? 'Fundada' : 'Founded', comp.founded_year],
                [language === 'es' ? 'Tamaño' : 'Size', comp.size_category],
                [language === 'es' ? 'Empleados' : 'Employees', comp.employee_estimate],
                [language === 'es' ? 'Sede' : 'HQ', comp.headquarters],
                [language === 'es' ? 'Posicionamiento' : 'Positioning', comp.market_positioning],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-muted-foreground">{k}</p>
                  <p className="font-medium">{(v as string) || 'N/A'}</p>
                </div>
              ))}
            </div>
            {comp.products_services?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">{language === 'es' ? 'Productos/Servicios' : 'Products/Services'}</p>
                <div className="flex flex-wrap gap-1">
                  {comp.products_services.map((p: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{p}</Badge>)}
                </div>
              </div>
            )}
            {comp.confidence_level && <ConfidenceBadge level={comp.confidence_level} />}
          </SectionCard>
        </TabsContent>

        {/* Financial */}
        <TabsContent value="financial">
          <SectionCard icon={DollarSign} title={language === 'es' ? 'Análisis Financiero' : 'Financial Analysis'}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {[
                [language === 'es' ? 'Facturación' : 'Revenue', fin.revenue_estimate],
                ['EBITDA', fin.ebitda_estimate],
                [language === 'es' ? 'Beneficio Neto' : 'Net Profit', fin.net_profit_estimate],
                [language === 'es' ? 'Crecimiento' : 'Growth', fin.growth_rate],
                [language === 'es' ? 'Margen' : 'Margin', fin.margin_estimate],
                [language === 'es' ? 'Endeudamiento' : 'Debt', fin.debt_level],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-muted-foreground">{k}</p>
                  <p className="font-medium">{(v as string) || 'N/A'}</p>
                </div>
              ))}
            </div>
            {fin.financial_health && <p className="text-xs mt-2">{fin.financial_health}</p>}
            {fin.confidence_level && <ConfidenceBadge level={fin.confidence_level} />}
          </SectionCard>
        </TabsContent>

        {/* Product */}
        <TabsContent value="product">
          <SectionCard icon={Package} title={language === 'es' ? 'Análisis de Producto' : 'Product Analysis'}>
            {prod.products?.length > 0 ? prod.products.map((p: any, i: number) => (
              <Card key={i} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-xs">{p.name}</p>
                  <Badge variant="outline" className="text-xs">{p.classification}</Badge>
                  {p.lifecycle_stage && <Badge className="text-xs bg-primary/10 text-primary">{p.lifecycle_stage}</Badge>}
                </div>
                {p.differentiation && <p className="text-xs text-muted-foreground">{p.differentiation}</p>}
              </Card>
            )) : <p className="text-xs text-muted-foreground">No product data</p>}
            {prod.overall_assessment && <p className="text-xs mt-2">{prod.overall_assessment}</p>}
          </SectionCard>
        </TabsContent>

        {/* Market */}
        <TabsContent value="market">
          <SectionCard icon={Globe} title={language === 'es' ? 'Análisis de Mercado' : 'Market Analysis'}>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                [language === 'es' ? 'Tamaño' : 'Size', mkt.market_size],
                [language === 'es' ? 'Crecimiento' : 'Growth', mkt.market_growth],
                [language === 'es' ? 'Atractividad' : 'Attractiveness', mkt.market_attractiveness],
                [language === 'es' ? 'Competencia' : 'Competition', mkt.competition_level],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-muted-foreground">{k}</p>
                  <p className="font-medium">{(v as string) || 'N/A'}</p>
                </div>
              ))}
            </div>
            {mkt.trends?.length > 0 && (
              <div><p className="text-xs text-muted-foreground mb-1">{language === 'es' ? 'Tendencias' : 'Trends'}</p>
                <ul className="text-xs list-disc pl-4 space-y-0.5">{mkt.trends.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            {mkt.opportunities?.length > 0 && (
              <div><p className="text-xs text-muted-foreground mb-1">{language === 'es' ? 'Oportunidades' : 'Opportunities'}</p>
                <ul className="text-xs list-disc pl-4 space-y-0.5">{mkt.opportunities.map((o: string, i: number) => <li key={i}>{o}</li>)}</ul>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* Competition */}
        <TabsContent value="competition">
          <SectionCard icon={Swords} title={language === 'es' ? 'Análisis Competitivo' : 'Competitive Analysis'}>
            {compet.competitors?.length > 0 ? compet.competitors.map((c: any, i: number) => (
              <Card key={i} className="p-3">
                <p className="font-medium text-xs mb-1">{c.name} — <span className="text-muted-foreground">{c.positioning}</span></p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-green-700 font-medium">{language === 'es' ? 'Fortalezas' : 'Strengths'}</p>
                    <ul className="list-disc pl-4">{c.strengths?.map((s: string, j: number) => <li key={j}>{s}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-red-700 font-medium">{language === 'es' ? 'Debilidades' : 'Weaknesses'}</p>
                    <ul className="list-disc pl-4">{c.weaknesses?.map((w: string, j: number) => <li key={j}>{w}</li>)}</ul>
                  </div>
                </div>
              </Card>
            )) : <p className="text-xs text-muted-foreground">No competitor data</p>}
            {compet.competitive_map_summary && <p className="text-xs mt-2 p-3 bg-muted/50 rounded">{compet.competitive_map_summary}</p>}
          </SectionCard>
        </TabsContent>

        {/* SWOT / Strategy */}
        <TabsContent value="strategy">
          <SectionCard icon={Brain} title={language === 'es' ? 'Análisis Estratégico (SWOT)' : 'Strategic Analysis (SWOT)'}>
            {strat.swot && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'strengths', label: language === 'es' ? 'Fortalezas' : 'Strengths', color: 'bg-green-500/10 border-green-500/30' },
                  { key: 'weaknesses', label: language === 'es' ? 'Debilidades' : 'Weaknesses', color: 'bg-red-500/10 border-red-500/30' },
                  { key: 'opportunities', label: language === 'es' ? 'Oportunidades' : 'Opportunities', color: 'bg-blue-500/10 border-blue-500/30' },
                  { key: 'threats', label: language === 'es' ? 'Amenazas' : 'Threats', color: 'bg-yellow-500/10 border-yellow-500/30' },
                ].map((s) => (
                  <Card key={s.key} className={`p-3 ${s.color} border`}>
                    <p className="font-semibold text-xs mb-2">{s.label}</p>
                    <ul className="text-xs space-y-1">
                      {(strat.swot[s.key] || []).map((item: string, i: number) => <li key={i} className="flex items-start gap-1"><ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />{item}</li>)}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
            {strat.diagnosis && (
              <div className="mt-3 p-3 bg-muted/50 rounded">
                <p className="text-xs font-medium mb-1">{language === 'es' ? 'Diagnóstico' : 'Diagnosis'}</p>
                <p className="text-xs">{strat.diagnosis}</p>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* Valuation */}
        <TabsContent value="valuation">
          <SectionCard icon={Diamond} title={language === 'es' ? 'Valor / Atractivo Estratégico' : 'Strategic Value / Attractiveness'}>
            <div className="grid grid-cols-3 gap-4 text-center">
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Min</p>
                <p className="font-bold text-lg">{val.value_range_min || 'N/A'}</p>
              </Card>
              <Card className="p-3 border-primary/50 bg-primary/5">
                <p className="text-xs text-muted-foreground">{language === 'es' ? 'Estimado' : 'Estimated'}</p>
                <p className="font-bold text-lg text-primary">{val.estimated_value || 'N/A'}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Max</p>
                <p className="font-bold text-lg">{val.value_range_max || 'N/A'}</p>
              </Card>
            </div>
            {val.methods_used?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {val.methods_used.map((m: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{m}</Badge>)}
              </div>
            )}
            {val.valuation_notes && <p className="text-xs">{val.valuation_notes}</p>}
            {val.confidence_level && <ConfidenceBadge level={val.confidence_level} />}
          </SectionCard>
        </TabsContent>

        {/* Sale Propensity */}
        <TabsContent value="sale">
          <SectionCard icon={Target} title={language === 'es' ? 'Atractivo Comercial / Señales Estratégicas' : 'Commercial Attractiveness / Strategic Signals'}>
            <div className="flex items-center gap-4 mb-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{language === 'es' ? 'Probabilidad' : 'Probability'}</p>
                <p className={`text-2xl font-bold ${sale.probability === 'HIGH' ? 'text-red-600' : sale.probability === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'}`}>
                  {sale.probability || 'N/A'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{language === 'es' ? 'Recomendación' : 'Recommendation'}</p>
                <Badge className="text-sm">{sale.recommendation?.replace(/_/g, ' ') || 'N/A'}</Badge>
              </div>
            </div>
            {[
              { key: 'financial_signals', label: language === 'es' ? 'Señales Financieras' : 'Financial Signals', icon: DollarSign },
              { key: 'strategic_signals', label: language === 'es' ? 'Señales Estratégicas' : 'Strategic Signals', icon: Brain },
              { key: 'organizational_signals', label: language === 'es' ? 'Señales Organizativas' : 'Organizational Signals', icon: Building2 },
              { key: 'contextual_signals', label: language === 'es' ? 'Señales Contextuales' : 'Contextual Signals', icon: Globe },
            ].map((s) => (
              sale[s.key]?.length > 0 && (
                <div key={s.key}>
                  <p className="text-xs font-medium flex items-center gap-1"><s.icon className="h-3 w-3" />{s.label}</p>
                  <ul className="text-xs list-disc pl-4">{sale[s.key].map((sig: string, i: number) => <li key={i}>{sig}</li>)}</ul>
                </div>
              )
            ))}
            {sale.potential_buyer_types?.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">{language === 'es' ? 'Tipos de Comprador' : 'Buyer Types'}</p>
                <div className="flex flex-wrap gap-1">{sale.potential_buyer_types.map((b: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{b}</Badge>)}</div>
              </div>
            )}
            {sale.reasoning && <p className="text-xs p-3 bg-muted/50 rounded">{sale.reasoning}</p>}
          </SectionCard>
        </TabsContent>

        {/* Future Scenarios */}
        <TabsContent value="future">
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: language === 'es' ? '5 Años' : '5 Years', data: future.five_year },
              { label: language === 'es' ? '10 Años' : '10 Years', data: future.ten_year },
            ].map((s) => (
              <SectionCard key={s.label} icon={TrendingUp} title={`${language === 'es' ? 'Escenarios' : 'Scenarios'} — ${s.label}`}>
                {s.data ? ['best_case', 'worst_case', 'most_probable'].map((c) => (
                  <div key={c} className="p-2 bg-muted/30 rounded">
                    <p className="text-xs font-medium capitalize flex items-center gap-1">
                      {c === 'best_case' ? <TrendingUp className="h-3 w-3 text-green-600" /> :
                        c === 'worst_case' ? <TrendingDown className="h-3 w-3 text-red-600" /> :
                          <ArrowRight className="h-3 w-3 text-blue-600" />}
                      {c.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs">{s.data[c] || 'N/A'}</p>
                  </div>
                )) : <p className="text-xs text-muted-foreground">No data</p>}
              </SectionCard>
            ))}
          </div>
        </TabsContent>

        {/* Recommendations */}
        <TabsContent value="actions">
          <SectionCard icon={Lightbulb} title={language === 'es' ? 'Recomendaciones y Acciones' : 'Recommendations & Actions'}>
            {recs.length > 0 ? recs.map((rec: any, i: number) => (
              <Card key={i} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs capitalize">{rec.type}</Badge>
                  <Badge className={`text-xs ${rec.priority === 'high' ? 'bg-red-500/10 text-red-700' : rec.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-700' : 'bg-green-500/10 text-green-700'}`}>
                    {rec.priority}
                  </Badge>
                  {rec.timeline && <span className="text-xs text-muted-foreground">{rec.timeline}</span>}
                </div>
                <p className="text-xs font-medium">{rec.action}</p>
                {rec.rationale && <p className="text-xs text-muted-foreground mt-1">{rec.rationale}</p>}
              </Card>
            )) : <p className="text-xs text-muted-foreground">No recommendations</p>}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
