import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Brain, Building2, ClipboardCopy, FolderOpen, Layers, Loader2, Plus, Sparkles, Target } from 'lucide-react';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { readWorkspaceRows, writeWorkspaceRows } from '@/lib/workspaceStorage';
import { EXTERNAL_KNOWLEDGE_LIBRARY } from '@/lib/externalKnowledgeLibrary';
import { type AssistantHistoryEntry, type AssistantRequestType, buildAssistantBridgePrompt, buildAssistantLeadAndContact, buildAssistantOfferDraft, buildAssistantTask, buildBilingualIngecartHtmlReport, getAssistantHistoryStorageKey, inferAssistantDestination, inferAssistantRequestType, parseAssistantFields } from '@/lib/aiAssistantWorkspace';

const REQUEST_TYPES: Array<{ value: AssistantRequestType; label: string }> = [
  { value: 'auto', label: 'Auto-orchestrate' },
  { value: 'customer', label: 'Customer / account' },
  { value: 'action', label: 'Closed-loop action' },
  { value: 'offer', label: 'Offer draft' },
  { value: 'content', label: 'Marketing content' },
  { value: 'report', label: 'Report / intelligence' },
  { value: 'application-change', label: 'Application change bridge' },
];

export default function AIAssistantPage() {
  const { activeCompanyId, data, setContacts, setLeads, addTask } = useData();
  const [activeTab, setActiveTab] = useState('assistant');
  const [requestType, setRequestType] = useState<AssistantRequestType>('auto');
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<AssistantHistoryEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!activeCompanyId) return;
    try { const raw = localStorage.getItem(getAssistantHistoryStorageKey(activeCompanyId)); setHistory(raw ? JSON.parse(raw) : []); } catch { setHistory([]); }
  }, [activeCompanyId]);

  const knownAccounts = useMemo(() => Array.from(new Set([
    ...data.orders.map((row) => row.customerName),
    ...data.opportunities.map((row) => row.customerName),
    ...data.contacts.map((row) => row.companyName),
    ...data.leads.map((row) => row.companyName),
    ...readWorkspaceRows<any>('offers', activeCompanyId).map((row) => row.customer_name),
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b)), [activeCompanyId, data.contacts, data.leads, data.opportunities, data.orders]);

  const externalKnowledge = useMemo(() => EXTERNAL_KNOWLEDGE_LIBRARY.filter((entry) => {
    const companyName = String(data.companyProfile.company_name || '').toLowerCase();
    return entry.company === 'General' || entry.company.toLowerCase() === companyName || companyName.includes(entry.company.toLowerCase()) || entry.targetAccount;
  }).slice(0, 30), [data.companyProfile.company_name]);

  const assetSummary = useMemo(() => {
    if (!activeCompanyId) return { contacts: 0, tasks: 0, offers: 0, content: 0, reports: 0 };
    return { contacts: data.contacts.length, tasks: data.tasks.length, offers: readWorkspaceRows<any>('offers', activeCompanyId).length, content: readWorkspaceRows<any>('marketing_content', activeCompanyId).length, reports: readWorkspaceRows<any>('business_intelligence_reports', activeCompanyId).length };
  }, [activeCompanyId, data.contacts.length, data.tasks.length]);

  const filteredHistory = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return history;
    return history.filter((entry) => [entry.prompt, entry.resultTitle, entry.summary, entry.targetAccount, entry.resolvedType].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [history, search]);

  const saveHistory = (entries: AssistantHistoryEntry[]) => {
    if (!activeCompanyId) return;
    localStorage.setItem(getAssistantHistoryStorageKey(activeCompanyId), JSON.stringify(entries));
    setHistory(entries);
  };

  const nextOfferNumber = () => {
    const year = new Date().getFullYear();
    const prefix = 'OFF-' + year + '-';
    const values = [...data.orders.map((row) => row.oppNumber), ...data.opportunities.map((row) => row.oppNumber), ...readWorkspaceRows<any>('offers', activeCompanyId).map((row) => row.offer_number)].map((value) => String(value || ''));
    const max = values.reduce((acc, value) => { const match = value.toUpperCase().match(new RegExp('^' + prefix + '(\\d+)')); return match ? Math.max(acc, Number(match[1])) : acc; }, 0);
    return prefix + String(max + 1).padStart(3, '0');
  };

  const buildMarketingRecord = (requestPrompt: string, destination: string, targetAccount: string) => {
    const parsed = parseAssistantFields(requestPrompt);
    const companyName = data.companyProfile.company_name || 'Ingecart';
    const title = parsed.title || 'AI Assistant content';
    const html = buildBilingualIngecartHtmlReport({
      title,
      subtitle: destination === 'account-content' ? 'Customer-facing commercial content' : destination === 'product-content' ? 'Product / solution content' : 'Marketing and commercial content',
      companyName,
      esSummary: 'Contenido generado por AI Assistant con estructura bilingue preparada para revision y uso comercial.',
      enSummary: 'Content generated by AI Assistant with a bilingual structure prepared for commercial review and use.',
      sections: [
        { titleEs: 'Objetivo', titleEn: 'Objective', bodyEs: requestPrompt, bodyEn: requestPrompt },
        { titleEs: 'Contexto comercial', titleEn: 'Commercial context', bodyEs: 'Empresa: ' + companyName + '. Destino: ' + destination + (targetAccount ? '. Cuenta: ' + targetAccount : '.'), bodyEn: 'Company: ' + companyName + '. Destination: ' + destination + (targetAccount ? '. Account: ' + targetAccount : '.') },
        { titleEs: 'Siguiente accion', titleEn: 'Next action', bodyEs: 'Validar, editar si procede y activar el contenido desde Marketing Content.', bodyEn: 'Validate, edit if needed and activate the content from Marketing Content.' },
      ],
    });
    return { id: crypto.randomUUID(), company_id: activeCompanyId, title, body: html, summary: 'AI Assistant generated bilingual content.', content_type: destination === 'product-content' ? 'product_report' : destination === 'account-content' ? 'account_content' : 'ai_report', platform: 'newsletter', hashtags: ['ASE', 'AI Assistant', companyName.replace(/\s+/g, '')], call_to_action: 'Review, approve and activate the next commercial step.', suggested_image_description: 'Executive industrial visual aligned with the requested content.', alternative_versions: [], intelligence_sources: { source: 'AI Assistant', storage_bucket: destination, target_account: targetAccount || null, template: 'ingetrans-mastercorr-bilingual' }, status: 'draft', scheduled_at: null, published_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  };

  const buildReportRecord = (requestPrompt: string) => {
    const parsed = parseAssistantFields(requestPrompt);
    const html = buildBilingualIngecartHtmlReport({ title: parsed.title || 'AI Assistant intelligence report', subtitle: 'Strategic intelligence and commercial recommendations', companyName: data.companyProfile.company_name || 'Ingecart', esSummary: 'Informe ejecutivo generado por AI Assistant con foco en evidencia, hipotesis y accion recomendada.', enSummary: 'Executive report generated by AI Assistant with focus on evidence, hypotheses and recommended action.', sections: [{ titleEs: 'Contexto', titleEn: 'Context', bodyEs: requestPrompt, bodyEn: requestPrompt }, { titleEs: 'Hallazgos', titleEn: 'Findings', bodyEs: 'Revisar señales, riesgos y oportunidades relacionadas con el tema solicitado.', bodyEn: 'Review signals, risks and opportunities related to the requested topic.' }, { titleEs: 'Acciones sugeridas', titleEn: 'Suggested actions', bodyEs: 'Convertir el informe en acciones cerradas y seguimiento comercial.', bodyEn: 'Convert the report into closed-loop actions and commercial follow-up.' }] });
    return { id: crypto.randomUUID(), target_company_name: parsed.companyName || parsed.title || 'AI Assistant subject', target_company_website: parsed.website, report_type: 'ai-assistant:intelligence', status: 'completed', executive_summary: 'AI Assistant generated this market intelligence report and linked the bilingual HTML version for executive use.', company_profile: { sector: 'Industrial automation', company_type: 'Target subject', confidence_level: 'MEDIUM' }, financial_analysis: { revenue_estimate: 'N/A', confidence_level: 'LOW' }, product_analysis: { overall_assessment: requestPrompt }, market_analysis: { market_attractiveness: 'Medium', trends: ['Validate demand drivers', 'Review buyer timing'], opportunities: ['Convert findings into action plan'] }, competitive_analysis: { competitive_pressure: 'Medium', key_competitors: [] }, strategic_analysis: { strengths: ['Context captured'], weaknesses: ['Requires validation'], opportunities: ['Commercial activation'], threats: ['Unvalidated assumptions'] }, valuation: { estimated_value: parsed.estimatedValue ? 'EUR ' + parsed.estimatedValue.toLocaleString() : 'N/A', confidence_level: 'LOW' }, sale_propensity: { probability: /urgent|high|alta/i.test(requestPrompt) ? 'HIGH' : 'MEDIUM' }, future_scenarios: { best_case: 'Validated and converted into action.', base_case: 'Used as internal decision support.', downside_case: 'Requires more evidence.' }, recommendations: ['Validate sources', 'Assign an owner', 'Create a closed-loop next action'], data_sources: { source: 'AI Assistant', storage_bucket: 'market-intelligence', template: 'ingetrans-mastercorr-bilingual', html_body: html }, hypothesis_log: [{ hypothesis: requestPrompt, score: 78, evidence: 'User request + company context' }], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), company_id: activeCompanyId };
  };

  const processRequest = async () => {
    if (!activeCompanyId) { toast({ title: 'Select a company first', variant: 'destructive' }); return; }
    if (!prompt.trim()) { toast({ title: 'Describe what AI Assistant should do', variant: 'destructive' }); return; }
    setProcessing(true);
    try {
      const resolvedType = inferAssistantRequestType(prompt, requestType);
      const { destination, account } = inferAssistantDestination(prompt, data.companyProfile.company_name || '', knownAccounts);
      let resultTitle = '';
      let summary = '';
      let status: AssistantHistoryEntry['status'] = 'applied';
      let targetRoute = '/';
      let targetRecordId = '';
      let bridgePrompt = '';
      if (resolvedType === 'customer') {
        const { lead, contact, companyName } = buildAssistantLeadAndContact(prompt, data.companyProfile);
        await setContacts([...data.contacts.filter((row) => row.companyName.toLowerCase() !== companyName.toLowerCase() || row.email !== contact.email), contact]);
        await setLeads([...data.leads.filter((row) => row.companyName.toLowerCase() !== companyName.toLowerCase() || row.email !== lead.email), lead]);
        resultTitle = companyName; summary = 'Customer and contact were added to the company workspace.'; targetRoute = '/kam'; targetRecordId = companyName;
      } else if (resolvedType === 'action') {
        const task = buildAssistantTask(prompt, account); await addTask(task); resultTitle = task.title; summary = 'Closed-loop action created and routed into the operational queue.'; targetRoute = '/commercial-actions-repository'; targetRecordId = task.id;
      } else if (resolvedType === 'offer') {
        const bundle = buildAssistantOfferDraft(prompt, activeCompanyId, nextOfferNumber(), account); writeWorkspaceRows('offers', activeCompanyId, [bundle.offer, ...readWorkspaceRows<any>('offers', activeCompanyId).filter((row) => row.id !== bundle.offer.id)]); writeWorkspaceRows('offer_items', activeCompanyId, [bundle.item, ...readWorkspaceRows<any>('offer_items', activeCompanyId).filter((row) => row.id !== bundle.item.id)]); writeWorkspaceRows('offer_commercial_terms', activeCompanyId, [bundle.commercialTerms, ...readWorkspaceRows<any>('offer_commercial_terms', activeCompanyId).filter((row) => row.offer_id !== bundle.offer.id)]); resultTitle = bundle.offer.title; summary = 'Editable offer draft created in the pricing workspace.'; targetRoute = '/offer-pricing'; targetRecordId = bundle.offer.id;
      } else if (resolvedType === 'content') {
        const record = buildMarketingRecord(prompt, destination, account); writeWorkspaceRows('marketing_content', activeCompanyId, [record, ...readWorkspaceRows<any>('marketing_content', activeCompanyId)]); resultTitle = record.title; summary = 'Bilingual Ingecart-format content saved into Marketing Content.'; targetRoute = '/marketing-content'; targetRecordId = record.id;
      } else if (resolvedType === 'report') {
        if (destination === 'market-intelligence') { const report = buildReportRecord(prompt); writeWorkspaceRows('business_intelligence_reports', activeCompanyId, [report, ...readWorkspaceRows<any>('business_intelligence_reports', activeCompanyId)]); resultTitle = report.target_company_name; summary = 'Strategic report saved into Market Intelligence.'; targetRoute = '/business-intelligence'; targetRecordId = report.id; }
        else { const record = buildMarketingRecord(prompt, destination, account); writeWorkspaceRows('marketing_content', activeCompanyId, [record, ...readWorkspaceRows<any>('marketing_content', activeCompanyId)]); resultTitle = record.title; summary = destination === 'account-content' ? 'Customer report saved into the account content library.' : 'Product / company report saved into Marketing Content.'; targetRoute = '/marketing-content'; targetRecordId = record.id; }
      } else {
        bridgePrompt = buildAssistantBridgePrompt(prompt, data.companyProfile.company_name || 'Active company'); resultTitle = 'Application change request'; summary = 'Bridge packet created for a Copilot implementation session.'; status = 'bridge-ready'; targetRoute = '/ai-assistant';
      }
      const historyEntry: AssistantHistoryEntry = { id: crypto.randomUUID(), companyId: activeCompanyId, createdAt: new Date().toISOString(), requestType, resolvedType, destination, prompt, summary, resultTitle, status, targetRoute, targetRecordId, targetAccount: account, bridgePrompt };
      saveHistory([historyEntry, ...history].slice(0, 80));
      toast({ title: 'AI Assistant updated the workspace', description: summary });
      setPrompt(''); setActiveTab('assets');
    } finally { setProcessing(false); }
  };

  if (!activeCompanyId) return <div className="p-6 lg:p-8"><Card><CardContent className="py-12 text-center"><Bot className="h-10 w-10 mx-auto text-muted-foreground mb-3" /><p className="text-sm text-muted-foreground">Select a company to activate AI Assistant.</p></CardContent></Card></div>;

  return <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6"><div className="flex items-start justify-between gap-4 flex-wrap"><div><h1 className="text-2xl font-semibold flex items-center gap-2"><Bot className="h-6 w-6 text-primary" /> AI Assistant</h1><p className="text-sm text-muted-foreground mt-1">Operational assistant for customers, actions, offers, content, reports and application change handoffs.</p></div><div className="flex gap-2 flex-wrap"><Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3" /> {data.companyProfile.company_name || 'Active company'}</Badge><Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> Ingetrans bilingual template enabled</Badge></div></div><div className="grid grid-cols-2 md:grid-cols-5 gap-3"><Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Contacts</p><p className="text-xl font-bold">{assetSummary.contacts}</p></CardContent></Card><Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Actions</p><p className="text-xl font-bold">{assetSummary.tasks}</p></CardContent></Card><Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Offers</p><p className="text-xl font-bold">{assetSummary.offers}</p></CardContent></Card><Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Marketing Content</p><p className="text-xl font-bold">{assetSummary.content}</p></CardContent></Card><Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Market Intelligence</p><p className="text-xl font-bold">{assetSummary.reports}</p></CardContent></Card></div><Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="assistant" className="gap-2"><Brain className="h-4 w-4" /> Assistant</TabsTrigger><TabsTrigger value="assets" className="gap-2"><Layers className="h-4 w-4" /> Assets</TabsTrigger><TabsTrigger value="knowledge" className="gap-2"><FolderOpen className="h-4 w-4" /> Knowledge</TabsTrigger></TabsList><TabsContent value="assistant" className="space-y-4"><Card><CardHeader><CardTitle>Request orchestrator</CardTitle><CardDescription>Describe what you need. AI Assistant will route it into customers, actions, offers, marketing content, market intelligence or an application-change bridge.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid md:grid-cols-[240px,1fr] gap-4"><div><p className="text-sm font-medium mb-2">Request type</p><Select value={requestType} onValueChange={(value) => setRequestType(value as AssistantRequestType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REQUEST_TYPES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div><p className="text-sm font-medium mb-2">Prompt</p><Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-[180px]" placeholder="Example:\nCustomer: Linetex\nContact: Mike\nEmail: ...\nNeed: create customer, action and account content" /></div></div><div className="flex gap-2 flex-wrap"><Button onClick={() => void processRequest()} disabled={processing || !prompt.trim()}>{processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Run AI Assistant</Button><Button variant="outline" onClick={() => setPrompt('Create a closed-loop action for RapidBond and Mike to reactivate USA dealer follow-up with executive email draft and next milestone.')}>Quick dealer action</Button><Button variant="outline" onClick={() => setPrompt('Create a bilingual Ingecart product report for Ingetrans Smart with executive summary, applications and next sales actions.')}>Quick product report</Button></div></CardContent></Card></TabsContent><TabsContent value="assets" className="space-y-4"><Card><CardHeader><CardTitle>AI Assistant session history</CardTitle><CardDescription>Everything created or prepared by AI Assistant stays saved in the active company workspace.</CardDescription></CardHeader><CardContent className="space-y-4"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests, accounts or generated assets" aria-label="Search AI Assistant history" /><div className="space-y-3">{filteredHistory.length === 0 ? <p className="text-sm text-muted-foreground">No AI Assistant requests yet.</p> : filteredHistory.map((entry) => <div key={entry.id} className="rounded-lg border p-4 space-y-3"><div className="flex items-start justify-between gap-3 flex-wrap"><div><p className="font-medium">{entry.resultTitle}</p><p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()} · {entry.resolvedType} · {entry.destination}</p></div><div className="flex gap-2 flex-wrap"><Badge variant={entry.status === 'applied' ? 'secondary' : 'outline'}>{entry.status}</Badge>{entry.targetAccount ? <Badge variant="outline">{entry.targetAccount}</Badge> : null}</div></div><p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.summary}</p><div className="rounded-md bg-muted/30 p-3 text-xs whitespace-pre-wrap">{entry.prompt}</div><div className="flex gap-2 flex-wrap">{entry.targetRoute ? <Button asChild size="sm" variant="outline"><Link to={entry.targetRoute}><Target className="h-3 w-3 mr-1" />Open target area</Link></Button> : null}{entry.bridgePrompt ? <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(entry.bridgePrompt).then(() => toast({ title: 'Bridge prompt copied' }))}><ClipboardCopy className="h-3 w-3 mr-1" />Copy bridge prompt</Button> : null}</div></div>)}</div></CardContent></Card></TabsContent><TabsContent value="knowledge" className="space-y-4"><Card><CardHeader><CardTitle>External knowledge references</CardTitle><CardDescription>Visible references from AI Factory V2, Backoffice and Ingesite that AI Assistant can use as content and reporting context.</CardDescription></CardHeader><CardContent className="grid gap-3">{externalKnowledge.map((entry) => <div key={entry.id} className="rounded-lg border p-3 flex items-start justify-between gap-3"><div><p className="font-medium text-sm">{entry.title}</p><p className="text-xs text-muted-foreground">{entry.source} · {entry.area} · {entry.extension.toUpperCase()}</p><p className="text-[11px] text-muted-foreground break-all mt-1">{entry.path}</p></div><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(entry.path).then(() => toast({ title: 'Path copied' }))}><ClipboardCopy className="h-3 w-3 mr-1" />Copy path</Button></div>)}</CardContent></Card></TabsContent></Tabs></div>;
}
