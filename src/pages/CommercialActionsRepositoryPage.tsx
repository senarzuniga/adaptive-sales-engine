import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type ContactRecord, type LeadRecord, type MonitoringTask, type OpportunityRecord, useData } from '@/store/DataStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  DEFAULT_REPOSITORY,
  type ActionsRepository,
  type CommercialAction,
  cloneRepository,
  detectCircularTriggers,
  evaluateKpis,
  filterByWorkingHours,
  flattenActions,
  generateActionByRule,
  getActionsByStage,
  getNextBestAction,
  loadRepositoryFromStorage,
  mergeRepository,
  saveRepositoryToStorage,
  scoreAction,
  toMonitoringTask,
  triggerActions,
  upsertAction,
  validateRepository,
} from '@/lib/commercialActionsRepository';
import { Layers, Play, Plus, Rocket, Save, Target, Timer, Wand2 } from 'lucide-react';
import { isWorkspaceSupabaseConfigured, readWorkspaceRows } from '@/lib/workspaceStorage';

const getPathLabel = (value: string) => value.split(/[\\/]/).pop() || value;

const EVENT_OPTIONS = [
  'new_signal',
  'lead_created',
  'offer_pending',
  'health_score_updated',
  'usage_updated',
  'nps_updated',
  'contract_expiring',
  'planning_cycle',
  'any_input_changed',
];

const emptyAction: CommercialAction = {
  id: '',
  name: '',
  description: '',
  role: 'Sales Agent',
  importance_score: 70,
  strategy_alignment: 70,
  estimated_hours: 2,
  inputs: [],
  outputs: [],
  triggers: [{ event: 'planning_cycle', logic: 'true' }],
  kpis: [{ name: 'Action completion', target: 100, unit: '%' }],
  ai_tags: [],
  goal: '',
  supportive_content: {
    call_script: '',
    email_template: '',
    presentation_notes: '',
  },
};

type OfferPipelineBucket = 'live' | 'cancelled' | 'sold';

interface OfferPipelineEntry {
  id: string;
  offer_number: string;
  title: string;
  customer_name: string;
  company_name: string;
  status: string;
  bucket: OfferPipelineBucket;
  stage: PipelineStage;
  score: number;
  last_update: string;
  context: string;
  next_action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  source_confidence: 'confirmed' | 'inferred';
  documents: string[];
  site: string;
  country: string;
  region: string;
  sector: string;
  kam: string;
  product_type: 'service' | 'equipment';
  product_family: string;
  product_name: string;
  project_folder: string;
  contract_value: number;
}

type PipelineStage = 'contact' | 'qualification' | 'meeting' | 'proposal' | 'negotiation' | 'closing' | 'retention';

const PIPELINE_STAGES: PipelineStage[] = ['contact', 'qualification', 'meeting', 'proposal', 'negotiation', 'closing', 'retention'];

const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  contact: 'Contact',
  qualification: 'Qualification',
  meeting: 'Meeting',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closing: 'Closing',
  retention: 'Retention',
};

const ACCOUNT_KAM_MAP: Record<string, string> = {
  cartogua: 'Linetex',
  cascades: 'Linetex',
  copak: 'Linetex',
  ip: 'Linetex',
  'kelly box': 'Linetex',
  'president container': 'Linetex',
  pmp: 'Linetex',
  torsacor: 'Linetex',
  sigmaq: 'Linetex',
  'smurfit westrock': 'Heriberto',
  'smurfit westrock mexico': 'Heriberto',
  'pcm mexico': 'Heriberto',
  krafir: 'Heriberto',
  papelesultra: 'Heriberto',
  cecso: 'Heriberto',
  cartro: 'Heriberto',
  grupak: 'Heriberto',
  cartograf: 'Heriberto',
  'grupo titan': 'Heriberto',
  proam: 'Heriberto',
  biopapel: 'Heriberto',
  copamex: 'Heriberto',
};

const normalizeText = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizePipelineStage = (status: string, bucket: OfferPipelineBucket): PipelineStage => {
  const normalized = normalizeText(status || '');
  if (bucket === 'sold') return 'closing';
  if (normalized.includes('retention')) return 'retention';
  if (normalized.includes('negotiat')) return 'negotiation';
  if (normalized.includes('meeting')) return 'meeting';
  if (normalized.includes('qualif')) return 'qualification';
  if (normalized.includes('contact') || normalized.includes('prospect')) return 'contact';
  if (normalized.includes('proposal') || normalized.includes('offer') || normalized.includes('cotiz')) return 'proposal';
  if (normalized.includes('close') || normalized.includes('won') || normalized.includes('signed') || normalized.includes('accepted')) return 'closing';
  return bucket === 'cancelled' ? 'qualification' : 'proposal';
};

const inferRegion = (country: string) => {
  const normalized = normalizeText(country || '');
  if (normalized.includes('mex')) return 'Mexico';
  if (normalized.includes('esp') || normalized.includes('spain')) return 'Iberia';
  if (normalized.includes('fran')) return 'France';
  if (normalized.includes('alem') || normalized.includes('german')) return 'Germany';
  return country || 'Unassigned';
};

const inferProductFamily = (text: string): string => {
  const normalized = normalizeText(text || '');
  if (normalized.includes('wip')) return 'WIP';
  if (normalized.includes('bobina') || normalized.includes('splicer')) return 'Carga de Bobinas';
  if (normalized.includes('palet')) return 'Paletizado';
  if (normalized.includes('desperdicio') || normalized.includes('retal')) return 'Sistema de Desperdicio';
  if (normalized.includes('entrada') || normalized.includes('almacen')) return 'Gestion de Entradas Almacen';
  if (normalized.includes('intralog')) return 'Intralogistica';
  if (normalized.includes('exped')) return 'Salidas expedicion';
  return 'Varios/Gestion de Flujo';
};

const inferProductType = (text: string): 'service' | 'equipment' => {
  const normalized = normalizeText(text || '');
  if (normalized.includes('service') || normalized.includes('audit') || normalized.includes('maintenance') || normalized.includes('support')) return 'service';
  return 'equipment';
};

const inferKam = (customerName: string, existingKam: string) => {
  if (existingKam) return existingKam;
  const normalized = normalizeText(customerName || '');
  const match = Object.entries(ACCOUNT_KAM_MAP).find(([account]) => normalized.includes(account));
  return match ? match[1] : 'Ingecart';
};

const pipelineDemoOffers: Array<Record<string, any>> = [
  {
    id: 'demo-ingecart-1',
    offer_number: 'ING-2026-042',
    title: 'Cartonajes Font / packaging line follow-up',
    customer_name: 'Cartonajes Font',
    company_name: 'Ingecart 2018 SL',
    status: 'follow_up',
    bucket: 'live',
    score: 96,
    last_update: 'Today',
    context: 'Commercial follow-up required on technical validation and cost alignment for the active opportunity.',
    next_action: 'Send final technical review and confirm the commercial decision date with the customer.',
    priority: 'critical',
    source: 'Ingecart / cgo@ingecart.es',
  },
  {
    id: 'demo-ingecart-2',
    offer_number: 'ING-2026-055',
    title: 'Cascades Waterloo - technical package and approvals',
    customer_name: 'Cascades Waterloo',
    company_name: 'Ingecart 2018 SL',
    status: 'pending',
    bucket: 'live',
    score: 91,
    last_update: '2 days ago',
    context: 'Pipeline remains active after alignment on plant requirements and engineering documentation.',
    next_action: 'Validate the project gate and prepare the next customer meeting with the engineering team.',
    priority: 'high',
    source: 'Ingecart / isenar.cta@gmail.com',
  },
  {
    id: 'demo-agilpack-1',
    offer_number: 'AGI-2026-018',
    title: 'Agilpack / packaging equipment revision',
    customer_name: 'Agilpack',
    company_name: 'Agilpack',
    status: 'postponed',
    bucket: 'cancelled',
    score: 58,
    last_update: 'Last week',
    context: 'Decision postponed while internal budget is reviewed; commercial action remains active with a recovery path.',
    next_action: 'Re-activate the opportunity with a short budget review and restart the next-step proposal.',
    priority: 'medium',
    source: 'Agilpack / shared mailbox',
  },
  {
    id: 'demo-tween-1',
    offer_number: 'TWN-2026-010',
    title: 'Tween / automation package signed',
    customer_name: 'Tween',
    company_name: 'Tween',
    status: 'won',
    bucket: 'sold',
    score: 88,
    last_update: 'This week',
    context: 'The offer moved to execution; handoff to project management and commercial delivery is required.',
    next_action: 'Activate the project management workflow, confirm milestones, and set the delivery plan.',
    priority: 'high',
    source: 'Tween / commercial follow-up',
  },
  {
    id: 'demo-iar-1',
    offer_number: 'IAR-2026-007',
    title: 'IAR / downstream line quotation',
    customer_name: 'IAR',
    company_name: 'IAR',
    status: 'declined',
    bucket: 'cancelled',
    score: 42,
    last_update: '1 month ago',
    context: 'The customer withdrew the request after a revision of internal priorities; keep as a learning account.',
    next_action: 'Document the lost decision and convert any retained technical information into a reusable proposal template.',
    priority: 'low',
    source: 'IAR / archive',
  },
  {
    id: 'demo-ingecart-3',
    offer_number: 'ING-2026-071',
    title: 'Sterner Global / mastercorr project follow-up',
    customer_name: 'Sterner Global',
    company_name: 'Ingecart 2018 SL',
    status: 'closed',
    bucket: 'sold',
    score: 84,
    last_update: 'Today',
    context: 'Program is moving into execution and requires project owner coordination from the commercial stage.',
    next_action: 'Finalize handoff to project management and confirm the delivery calendar and engineering plan.',
    priority: 'high',
    source: 'Ingecart / portfolio tracking',
  },
];

const normalizeOfferBucket = (status: string): OfferPipelineBucket => {
  const normalized = status.toLowerCase();
  if (['won', 'sold', 'accepted', 'approved', 'closed', 'converted', 'signed'].includes(normalized)) return 'sold';
  if (['cancelled', 'canceled', 'postponed', 'declined', 'lost', 'dead', 'stalled', 'on_hold', 'paused'].includes(normalized)) return 'cancelled';
  return 'live';
};

const normalizeOfferPipelineEntry = (offer: Record<string, any>): OfferPipelineEntry => {
  const status = String(offer.status || 'draft');
  const bucket = normalizeOfferBucket(status);
  const score = Number(offer.global_score - offer.score - (bucket === 'live' ? 90 : bucket === 'sold' ? 82 : 55));
  const title = String(offer.title || offer.offer_number || 'Unnamed offer');
  const customerName = String(offer.customer_name || offer.customerName || 'Customer pending');
  const companyName = String(offer.company_name || offer.companyName || 'Portfolio');
  const documents = Array.isArray(offer.document_paths) ? offer.document_paths.map(String).filter(Boolean) : [];
  const region = String(offer.region || inferRegion(String(offer.country || '')));
  const sector = String(offer.sector || 'Corrugated Packaging');
  const contextText = String(offer.context || '');
  const productName = String(offer.product_name || offer.product || title);
  const productFamily = String(offer.product_family || inferProductFamily(`${title} ${contextText}`));
  const productType = inferProductType(`${title} ${contextText}`);
  const kam = inferKam(customerName, String(offer.kam || ''));
  const stage = offer.stage ? String(offer.stage) as PipelineStage : normalizePipelineStage(status, bucket);

  return {
    id: String(offer.id || `${offer.offer_number || customerName}-${Math.random().toString(16).slice(2)}`),
    offer_number: String(offer.offer_number || offer.offerNumber || 'N/A'),
    title,
    customer_name: customerName,
    company_name: companyName,
    status,
    bucket,
    stage,
    score: Number.isFinite(score) ? score : 0,
    last_update: offer.updated_at ? new Date(offer.updated_at).toLocaleDateString() : 'recently',
    context: String(offer.context || (
      bucket === 'live'
        ? 'Open commercial opportunity requiring active follow-up and decision support.'
        : bucket === 'sold'
          ? 'Offer has been won and requires execution handoff to project management.'
          : 'Decision paused or missed; recovery and learning actions should be documented.'
    )),
    next_action: String(offer.next_action || (
      bucket === 'live'
        ? 'Confirm next meeting, review technical constraints, and push the offer to a decision milestone.'
        : bucket === 'sold'
          ? 'Start the project activation checklist and confirm full delivery ownership.'
          : 'Reassess commercial conditions and decide whether to recover, archive, or convert the opportunity.'
    )),
    priority: score >= 90 ? 'critical' : score >= 75 ? 'high' : score >= 60 ? 'medium' : 'low',
    source: String(offer.source || 'Commercial pipeline'),
    source_confidence: offer.kam || offer.region || offer.sector ? 'confirmed' : 'inferred',
    documents,
    site: String(offer.site || ''),
    country: String(offer.country || ''),
    region,
    sector,
    kam,
    product_type: productType,
    product_family: productFamily,
    product_name: productName,
    project_folder: String(offer.project_folder || ''),
    contract_value: Number(offer.contract_value || 0),
  };
};

const buildPipelineTask = (offer: OfferPipelineEntry): MonitoringTask => ({
  id: `pipeline_${offer.id}`,
  title: `${offer.customer_name} - ${offer.title}`,
  description: `${offer.next_action} Context: ${offer.context}`,
  pillar: offer.bucket === 'sold' ? 'p2' : offer.bucket === 'cancelled' ? 'p1' : 'p0',
  status: 'todo',
  priority: offer.priority === 'critical' ? 'critical' : offer.priority === 'high' ? 'high' : offer.priority === 'medium' ? 'medium' : 'low',
  category: offer.bucket === 'sold' ? 'strategy' : offer.bucket === 'cancelled' ? 'analysis' : 'follow_up',
  assignee: 'sales',
  dueDate: new Date(Date.now() + (offer.priority === 'critical' ? 2 : 4) * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  notes: [offer.context, offer.next_action, `Source: ${offer.source}`],
  actionContent: {
    goal: offer.next_action,
    callScript: `Review the current status of ${offer.customer_name} and focus on the next commercial decision or execution milestone.`,
    emailTemplate: `Subject: Follow-up on ${offer.offer_number}\n\nHi team,\n\nWe are prioritizing the next step for ${offer.customer_name}. The current status is ${offer.status}. Please confirm the decision path, technical points, and required next milestone.`,
    presentationNotes: `${offer.context} ${offer.next_action}`,
  },
});

const sortOfferPipelineEntries = (offers: Array<Record<string, any>>) => offers.map(normalizeOfferPipelineEntry).sort((a, b) => b.score - a.score);

const mergeOfferSources = (...sources: Array<Array<Record<string, any>> | undefined>) => {
  const seen = new Set<string>();
  return sources
    .flatMap((source) => source || [])
    .filter((offer) => {
      const identity = String(offer.id || `${offer.offer_number || offer.offerNumber || 'offer'}|${offer.customer_name || offer.customerName || ''}|${offer.title || ''}`);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
};

const loadBundledCompanyOffers = async (companyName: string) => {
  if (!companyName.toLowerCase().includes('ingecart')) return [];
  try {
    const response = await fetch('/company-packs/Ingecart/ingecart_pack.json');
    if (!response.ok) return [];
    const pack = await response.json();
    return Array.isArray(pack?.workspace?.offers) ? pack.workspace.offers : [];
  } catch {
    return [];
  }
};

const CommercialActionsRepositoryPage = () => {
  const { addTask, activeCompanyId, data, setContacts, setLeads, setOpportunities } = useData();
  const [repository, setRepository] = useState<ActionsRepository>(() => loadRepositoryFromStorage());
  const [selectedStage, setSelectedStage] = useState(repository.lifecycle_stages[0]?.stage || 'PIPELINE_EXECUTION');
  const [workingHours, setWorkingHours] = useState(40);
  const [triggerEvent, setTriggerEvent] = useState('planning_cycle');
  const [healthScore, setHealthScore] = useState(55);
  const [usageGrowth, setUsageGrowth] = useState(25);
  const [churnRisk, setChurnRisk] = useState(0.75);
  const [npsScore, setNpsScore] = useState(20);
  const [simulatedActions, setSimulatedActions] = useState<Array<CommercialAction & { stage: string }>>([]);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [formStage, setFormStage] = useState(selectedStage);
  const [formAction, setFormAction] = useState<CommercialAction>(emptyAction);
  const [offerPipeline, setOfferPipeline] = useState<OfferPipelineEntry[]>([]);
  const [offerPipelineLoading, setOfferPipelineLoading] = useState(true);
  const [selectedPipelineStage, setSelectedPipelineStage] = useState<PipelineStage | 'all'>('all');
  const [pipelineKamFilter, setPipelineKamFilter] = useState('all');
  const [pipelineRegionFilter, setPipelineRegionFilter] = useState('all');
  const [pipelineSectorFilter, setPipelineSectorFilter] = useState('all');
  const [pipelineProductTypeFilter, setPipelineProductTypeFilter] = useState<'all' | 'service' | 'equipment'>('all');
  const [pipelineFamilyFilter, setPipelineFamilyFilter] = useState('all');
  const [pipelineSearch, setPipelineSearch] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadOfferPipeline = async () => {
      setOfferPipelineLoading(true);
      try {
        if (!activeCompanyId) {
          if (isMounted) setOfferPipeline(sortOfferPipelineEntries(pipelineDemoOffers));
          return;
        }

        const localOffers = readWorkspaceRows<Record<string, any>>('offers', activeCompanyId);
        const bundledOffers = await loadBundledCompanyOffers(String(data.companyProfile.company_name || ''));

        if (!isWorkspaceSupabaseConfigured) {
          if (isMounted) setOfferPipeline(sortOfferPipelineEntries(mergeOfferSources(localOffers, bundledOffers)));
          return;
        }

        const { data: remoteOffers, error } = await supabase
          .from('offers')
          .select('*')
          .eq('company_id', activeCompanyId)
          .order('updated_at', { ascending: false })
          .limit(200);

        if (error) {
          throw error;
        }

        if (isMounted) {
          setOfferPipeline(sortOfferPipelineEntries(mergeOfferSources(remoteOffers || [], localOffers, bundledOffers)));
        }
      } catch {
        const localOffers = readWorkspaceRows<Record<string, any>>('offers', activeCompanyId);
        const bundledOffers = await loadBundledCompanyOffers(String(data.companyProfile.company_name || ''));
        if (isMounted) {
          setOfferPipeline(sortOfferPipelineEntries(mergeOfferSources(localOffers, bundledOffers)));
        }
      } finally {
        if (isMounted) {
          setOfferPipelineLoading(false);
        }
      }
    };

    loadOfferPipeline();
    return () => {
      isMounted = false;
    };
  }, [activeCompanyId, data.companyProfile.company_name]);

  const pipelineRecords = useMemo(() => {
    const fromOffers = offerPipeline;

    const fromOpportunities = data.opportunities.map((opportunity) => {
      const status = String(opportunity.status || 'prospect');
      const bucket = normalizeOfferBucket(status);
      const title = String(opportunity.scope || (opportunity.opp_number || opportunity.oppNumber) || 'Opportunity');
      const customerName = String((opportunity.customer_name || opportunity.customerName) || 'Customer pending');
      const sourceText = `${title} ${(opportunity.product_family || opportunity.productFamily) || ''}`;
      return normalizeOfferPipelineEntry({
        id: `opp-${opportunity.id}`,
        offer_number: (opportunity.opp_number || opportunity.oppNumber) || opportunity.id,
        title,
        customer_name: customerName,
        company_name: String((opportunity.customer_name || opportunity.customerName) || customerName),
        status,
        bucket,
        country: String(opportunity.country || ''),
        region: String(opportunity.region || ''),
        sector: String((opportunity.segment || opportunity.sector) || 'Corrugated Packaging'),
        kam: String(opportunity.kam || ''),
        contract_value: Number((opportunity.est_revenue || opportunity.estRevenue) || 0),
        score: Number((opportunity.contract_prob || opportunity.contractProb) || 0),
        source: 'Opportunities',
        context: `Pipeline opportunity with estimated close ${(opportunity.est_purchasing_year || opportunity.estPurchasingYear) || 'n/a'} Q${(opportunity.est_purchasing_quarter || opportunity.estPurchasingQuarter) || '-'}.`,
        next_action: String(opportunity.contact || 'Confirm next customer touchpoint and move the opportunity to the next stage.'),
        product_name: title,
        product_family: String((opportunity.product_family || opportunity.productFamily) || inferProductFamily(sourceText)),
      });
    });

    const fromLeads = data.leads.map((lead) => {
      const status = String(lead.status || 'new');
      const stage = status === 'qualified' ? 'qualification' : 'contact';
      return normalizeOfferPipelineEntry({
        id: `lead-${lead.id}`,
        offer_number: lead.id,
        title: String(lead.source || 'Lead qualification'),
        customer_name: String((lead.company_name || lead.companyName) || 'Prospect'),
        company_name: String((lead.company_name || lead.companyName) || 'Prospect'),
        status,
        bucket: 'live',
        stage,
        country: String(lead.country || ''),
        region: String(lead.region || ''),
        sector: String((lead.segment || lead.sector) || 'Corrugated Packaging'),
        kam: String(lead.owner || ''),
        source: 'Leads',
        score: 50,
        context: 'Prospection lead in pipeline discovery stage.',
        next_action: String(lead.email || 'Reach out to identify key stakeholders and qualification criteria.'),
        product_name: String(lead.source || 'Prospection'),
      });
    });

    const combined = [...fromOffers, ...fromOpportunities, ...fromLeads];
    const deduped = new Map<string, OfferPipelineEntry>();
    combined.forEach((entry) => {
      const key = `${normalizeText(entry.customer_name)}|${normalizeText(entry.title)}|${entry.stage}`;
      if (!deduped.has(key) || (deduped.get(key)?.score || 0) < entry.score) {
        deduped.set(key, entry);
      }
    });
    return Array.from(deduped.values()).sort((a, b) => b.score - a.score);
  }, [offerPipeline, data.leads, data.opportunities]);

  const pipelineFilterOptions = useMemo(() => {
    const valueSet = <T extends string>(values: T[]) => ['all', ...Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))];
    return {
      kam: valueSet(pipelineRecords.map((entry) => entry.kam)),
      region: valueSet(pipelineRecords.map((entry) => entry.region)),
      sector: valueSet(pipelineRecords.map((entry) => entry.sector)),
      family: valueSet(pipelineRecords.map((entry) => entry.product_family)),
    };
  }, [pipelineRecords]);

  const filteredPipelineRecords = useMemo(() => {
    const normalizedSearch = normalizeText(pipelineSearch);
    return pipelineRecords.filter((entry) => {
      if (selectedPipelineStage !== 'all' && entry.stage !== selectedPipelineStage) return false;
      if (pipelineKamFilter !== 'all' && entry.kam !== pipelineKamFilter) return false;
      if (pipelineRegionFilter !== 'all' && entry.region !== pipelineRegionFilter) return false;
      if (pipelineSectorFilter !== 'all' && entry.sector !== pipelineSectorFilter) return false;
      if (pipelineProductTypeFilter !== 'all' && entry.product_type !== pipelineProductTypeFilter) return false;
      if (pipelineFamilyFilter !== 'all' && entry.product_family !== pipelineFamilyFilter) return false;
      if (!normalizedSearch) return true;
      return normalizeText(`${entry.customer_name} ${entry.title} ${entry.product_name} ${entry.offer_number}`).includes(normalizedSearch);
    });
  }, [pipelineRecords, selectedPipelineStage, pipelineKamFilter, pipelineRegionFilter, pipelineSectorFilter, pipelineProductTypeFilter, pipelineFamilyFilter, pipelineSearch]);

  const pipelineStageSummary = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => {
      const stageRecords = filteredPipelineRecords.filter((entry) => entry.stage === stage);
      const stageValue = stageRecords.reduce((acc, entry) => acc + entry.contract_value, 0);
      return {
        stage,
        count: stageRecords.length,
        value: stageValue,
      };
    });
  }, [filteredPipelineRecords]);
  const allActions = useMemo(
    () =>
      flattenActions(repository)
        .map((action) => ({ ...action, computed_score: scoreAction(action, { health_score: healthScore, usage_growth: usageGrowth, churn_risk: churnRisk, nps_score: npsScore }) }))
        .sort((a, b) => b.computed_score - a.computed_score),
    [repository, healthScore, usageGrowth, churnRisk, npsScore],
  );

  const stageActions = useMemo(() => getActionsByStage(repository, selectedStage), [repository, selectedStage]);

  const capacityPlan = useMemo(() => filterByWorkingHours(allActions, workingHours), [allActions, workingHours]);

  const nextBestAction = useMemo(
    () =>
      getNextBestAction(repository, {
        health_score: healthScore,
        usage_growth: usageGrowth,
        churn_risk: churnRisk,
        nps_score: npsScore,
      }),
    [repository, healthScore, usageGrowth, churnRisk, npsScore],
  );

  const validation = useMemo(() => validateRepository(repository), [repository]);
  const cycles = useMemo(() => detectCircularTriggers(repository), [repository]);

  const persist = (nextRepo: ActionsRepository, message?: string) => {
    setRepository(nextRepo);
    saveRepositoryToStorage(nextRepo);
    if (message) toast({ title: message });
  };

  const resetForm = () => {
    setFormAction(emptyAction);
    setEditingActionId(null);
    setFormStage(selectedStage);
  };

  const startEdit = (action: CommercialAction) => {
    setEditingActionId(action.id);
    setFormStage(selectedStage);
    setFormAction(cloneRepository(repository).lifecycle_stages.find((s) => s.stage === selectedStage)?.actions.find((a) => a.id === action.id) || action);
  };

  const saveAction = () => {
    if (!formAction.id.trim() || !formAction.description.trim() || !formAction.role.trim()) {
      toast({ title: 'id, description and role are required', variant: 'destructive' });
      return;
    }

    const actionToSave: CommercialAction = {
      ...formAction,
      inputs: formAction.inputs.filter(Boolean),
      outputs: formAction.outputs.filter(Boolean),
      ai_tags: formAction.ai_tags.filter(Boolean),
      triggers: formAction.triggers.filter((t) => t.event.trim() && t.logic.trim()),
      kpis: formAction.kpis.filter((k) => k.name.trim()),
    };

    const nextRepo = upsertAction(repository, actionToSave, formStage, 'ui_user');
    const report = validateRepository(nextRepo);
    if (!report.valid) {
      toast({ title: 'Validation failed', description: report.issues[0], variant: 'destructive' });
      return;
    }

    persist(nextRepo, editingActionId ? 'Action updated' : 'Action created');
    resetForm();
  };

  const runTriggerSimulation = () => {
    const generated = generateActionByRule({
      churn_risk: churnRisk,
      usage_growth: usageGrowth,
      nps_score: npsScore,
    });

    let workingRepo = repository;
    if (generated.length > 0) {
      workingRepo = mergeRepository(
        repository,
        generated.map((g) => ({ ...g.action, stage: g.stage })),
        'agent_auto_generator',
      );
      persist(workingRepo, 'AI-generated actions added based on risk/opportunity signals');
    }

    const triggered = triggerActions(workingRepo, {
      event: triggerEvent,
      health_score: healthScore,
      usage_growth: usageGrowth,
      churn_risk: churnRisk,
      nps_score: npsScore,
    });

    setSimulatedActions(triggered);
  };

  const addAsTask = async (action: CommercialAction, stage = selectedStage) => {
    await addTask(toMonitoringTask(action, stage));
    toast({ title: `Task created from action: ${action.name}` });
  };

  const addCapacityPlanTasks = async () => {
    for (const action of capacityPlan.selected) {
      await addTask(toMonitoringTask(action, action.stage || selectedStage));
    }
    toast({
      title: `${capacityPlan.selected.length} tasks created for ${workingHours}h capacity`,
      description: `Used ${capacityPlan.usedHours}h of ${workingHours}h`,
    });
  };

  const seedPipelineBaseline = async () => {
    const mexicoProspects = [
      'Smurfit Westrock', 'Torsacor', 'PCM Mexico', 'Smurfit Westrock Mexico', 'Krafir', 'Papelesultra',
      'Cecso', 'Cartro', 'Grupak', 'Cartograf', 'Grupo Titan', 'PROAM', 'Biopapel', 'Copamex',
    ];
    const linetexAccounts = ['Cartogua', 'Cascades', 'COPAK', 'IP', 'Kelly Box', 'President Container', 'PMP', 'Smurfit Torsacor', 'Smurfit planta de Yaqui', 'Sigmaq'];

    const baseLeads: LeadRecord[] = mexicoProspects.map((account) => ({
      leadName: `${account} - Entry contact`,
      companyName: account,
      email: '',
      phone: '',
      region: 'Mexico',
      country: 'Mexico',
      sector: 'Corrugated Packaging',
      status: 'new',
      source: 'Pipeline baseline',
      owner: 'Heriberto',
      estimatedValue: 0,
      notes: 'Prospection account pending first qualification call.',
    }));

    const serviceLeads: LeadRecord[] = [
      {
        leadName: 'CECSO - Retal RDC service entry',
        companyName: 'CECSO',
        email: '',
        phone: '',
        region: 'Mexico',
        country: 'Mexico',
        sector: 'Corrugated Packaging',
        status: 'qualified',
        source: 'Installed base',
        owner: 'Heriberto',
        estimatedValue: 35000,
        notes: 'Installed system: Sistema Retal-RDC. Offer spare package and audits.',
      },
      {
        leadName: 'PCM - Retal service entry',
        companyName: 'PCM Mexico',
        email: '',
        phone: '',
        region: 'Mexico',
        country: 'Mexico',
        sector: 'Corrugated Packaging',
        status: 'qualified',
        source: 'Installed base',
        owner: 'Heriberto',
        estimatedValue: 35000,
        notes: 'Installed systems: Sistema Retal, Ingetrans v0, salida equipo K&H.',
      },
      {
        leadName: 'Biopapel - equipment services entry',
        companyName: 'Biopapel',
        email: '',
        phone: '',
        region: 'Mexico',
        country: 'Mexico',
        sector: 'Corrugated Packaging',
        status: 'qualified',
        source: 'Installed base',
        owner: 'Heriberto',
        estimatedValue: 35000,
        notes: 'Installed systems: 618 FFG, 924 FFG, DRYEND Bwpapersystem, 1228 FFG.',
      },
    ];

    const baseOpportunities: OpportunityRecord[] = linetexAccounts.map((account, index) => ({
      oppNumber: `LTX-2026-${String(index + 1).padStart(3, '0')}`,
      status: index % 2 === 0 ? 'proposal' : 'negotiation',
      region: 'Iberia',
      country: 'Spain',
      customerName: account,
      scope: `${account} follow-up and maintenance proposal`,
      productFamily: index % 2 === 0 ? 'Varios/Gestion de Flujo' : 'Salidas expedicion',
      segment: 'Corrugated Packaging',
      estPurchasingYear: String(new Date().getFullYear()),
      estPurchasingQuarter: index % 2 === 0 ? 'Q3' : 'Q4',
      estRevenue: index % 2 === 0 ? 120000 : 85000,
      contractProb: index % 2 === 0 ? 65 : 55,
      margin: 28,
      contact: 'Schedule customer review meeting.',
      kam: 'Linetex',
    }));

    const contactsToAdd: ContactRecord[] = [...mexicoProspects, ...linetexAccounts].map((account) => ({
      name: `Pending key contact - ${account}`,
      email: '',
      phone: '',
      role: 'To be identified',
      department: 'Operations',
      companyName: account,
      region: mexicoProspects.includes(account) ? 'Mexico' : 'Iberia',
      country: mexicoProspects.includes(account) ? 'Mexico' : 'Spain',
      kam: mexicoProspects.includes(account) ? 'Heriberto' : 'Linetex',
      notes: 'Created from pipeline baseline seed.',
    }));

    const mergeBy = <T,>(current: T[], incoming: T[], key: (row: T) => string) => {
      const merged = new Map<string, T>();
      [...current, ...incoming].forEach((row) => {
        merged.set(normalizeText(key(row)), row);
      });
      return Array.from(merged.values());
    };

    await setLeads(mergeBy(data.leads as LeadRecord[], [...baseLeads, ...serviceLeads], (row) => `${row.companyName}|${row.leadName}`));
    await setContacts(mergeBy(data.contacts as ContactRecord[], contactsToAdd, (row) => `${row.companyName}|${row.name}`));
    await setOpportunities(mergeBy(data.opportunities as OpportunityRecord[], baseOpportunities, (row) => row.oppNumber));

    toast({ title: 'Pipeline baseline seeded', description: 'KAM baseline for Heriberto and Linetex has been loaded into leads, contacts, and opportunities.' });
  };
  const restoreDefaults = () => {
    persist(cloneRepository(DEFAULT_REPOSITORY), 'Repository restored to base model');
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Commercial Actions Repository
          </h2>
          <p className="text-sm text-muted-foreground">
            Dynamic action repository for Sales, Customer Success, Growth, RevOps, and Orchestrator agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Version {repository.version}</Badge>
          <Button variant="outline" onClick={restoreDefaults}>Restore Base</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Actions</p><p className="text-xl font-bold">{allActions.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Next Best Action</p><p className="text-sm font-semibold line-clamp-2">{nextBestAction?.name || 'N/A'}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Validation</p><p className={`text-sm font-semibold ${validation.valid && cycles.length === 0 ? 'text-green-600' : 'text-destructive'}`}>{validation.valid && cycles.length === 0 ? 'Valid chain' : 'Blocked'}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Execution Rule</p><p className="text-sm font-semibold">No partial execution</p></CardContent></Card>
      </div>

      <Tabs defaultValue="repository" className="space-y-4">
        <TabsList>
          <TabsTrigger value="repository">Repository</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline View</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="simulate">Trigger Simulation</TabsTrigger>
          <TabsTrigger value="capacity">Capacity Panel</TabsTrigger>
        </TabsList>

        <TabsContent value="repository" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">View by lifecycle stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>Stage</Label>
                  <Select value={selectedStage} onValueChange={(v) => { setSelectedStage(v); if (!editingActionId) setFormStage(v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {repository.lifecycle_stages.map((stageNode) => (
                        <SelectItem key={stageNode.stage} value={stageNode.stage}>{stageNode.stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Actions in stage</Label>
                  <div className="h-10 px-3 border rounded-md flex items-center text-sm">{stageActions.length}</div>
                </div>
                <div>
                  <Label>Average score</Label>
                  <div className="h-10 px-3 border rounded-md flex items-center text-sm">
                    {stageActions.length > 0 ? Math.round(stageActions.reduce((acc, action) => acc + scoreAction(action), 0) / stageActions.length) : 0}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {stageActions.map((action) => {
                  const computed = scoreAction(action, { health_score: healthScore, usage_growth: usageGrowth, churn_risk: churnRisk, nps_score: npsScore });
                  return (
                    <div key={action.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline">{action.role}</Badge>
                            <Badge variant={computed >= 90 ? 'destructive' : computed >= 75 ? 'default' : 'secondary'}>
                              Score {computed}
                            </Badge>
                            <Badge variant="outline">{action.estimated_hours}h</Badge>
                          </div>
                          <p className="font-medium text-sm">{action.name}</p>
                          <p className="text-xs text-muted-foreground">{action.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Goal: {action.goal || 'Not defined'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Content: {action.supportive_content?.call_script ? 'Script' : 'No script'} - {action.supportive_content?.email_template ? 'Email' : 'No email'} - {action.supportive_content?.presentation_notes ? 'Notes' : 'No notes'}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(action)}>Edit</Button>
                          <Button size="sm" onClick={() => addAsTask(action)} className="gap-1"><Plus className="h-3.5 w-3.5" />Create task</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{editingActionId ? 'Edit action' : 'Add new action'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-4 gap-3">
                <div><Label>ID</Label><Input value={formAction.id} onChange={(e) => setFormAction((p) => ({ ...p, id: e.target.value }))} disabled={!!editingActionId} /></div>
                <div><Label>Name</Label><Input value={formAction.name} onChange={(e) => setFormAction((p) => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>Role</Label><Input value={formAction.role} onChange={(e) => setFormAction((p) => ({ ...p, role: e.target.value }))} /></div>
                <div>
                  <Label>Stage</Label>
                  <Select value={formStage} onValueChange={setFormStage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {repository.lifecycle_stages.map((stageNode) => (
                        <SelectItem key={stageNode.stage} value={stageNode.stage}>{stageNode.stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Textarea value={formAction.description} onChange={(e) => setFormAction((p) => ({ ...p, description: e.target.value }))} placeholder="Description" />

              <div className="grid md:grid-cols-3 gap-3">
                <div><Label>Importance score</Label><Input type="number" value={formAction.importance_score} onChange={(e) => setFormAction((p) => ({ ...p, importance_score: Number(e.target.value) || 0 }))} /></div>
                <div><Label>Strategy alignment</Label><Input type="number" value={formAction.strategy_alignment} onChange={(e) => setFormAction((p) => ({ ...p, strategy_alignment: Number(e.target.value) || 0 }))} /></div>
                <div><Label>Estimated hours</Label><Input type="number" step="0.5" value={formAction.estimated_hours} onChange={(e) => setFormAction((p) => ({ ...p, estimated_hours: Number(e.target.value) || 0 }))} /></div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Inputs (comma separated)</Label><Input value={formAction.inputs.join(', ')} onChange={(e) => setFormAction((p) => ({ ...p, inputs: e.target.value.split(',').map((x) => x.trim()) }))} /></div>
                <div><Label>Outputs (comma separated)</Label><Input value={formAction.outputs.join(', ')} onChange={(e) => setFormAction((p) => ({ ...p, outputs: e.target.value.split(',').map((x) => x.trim()) }))} /></div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Trigger event</Label><Input value={formAction.triggers[0]?.event || ''} onChange={(e) => setFormAction((p) => ({ ...p, triggers: [{ ...(p.triggers[0] || { event: '', logic: 'true' }), event: e.target.value }] }))} /></div>
                <div><Label>Trigger logic</Label><Input value={formAction.triggers[0]?.logic || ''} onChange={(e) => setFormAction((p) => ({ ...p, triggers: [{ ...(p.triggers[0] || { event: 'planning_cycle', logic: '' }), logic: e.target.value }] }))} /></div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>KPI name</Label><Input value={formAction.kpis[0]?.name || ''} onChange={(e) => setFormAction((p) => ({ ...p, kpis: [{ ...(p.kpis[0] || { name: '', target: 0, unit: '%' }), name: e.target.value }] }))} /></div>
                <div><Label>KPI target</Label><Input type="number" value={formAction.kpis[0]?.target || 0} onChange={(e) => setFormAction((p) => ({ ...p, kpis: [{ ...(p.kpis[0] || { name: '', target: 0, unit: '%' }), target: Number(e.target.value) || 0 }] }))} /></div>
              </div>

              <Textarea value={formAction.goal || ''} onChange={(e) => setFormAction((p) => ({ ...p, goal: e.target.value }))} placeholder="Goal" />
              <Textarea value={formAction.supportive_content?.call_script || ''} onChange={(e) => setFormAction((p) => ({ ...p, supportive_content: { ...p.supportive_content, call_script: e.target.value } }))} placeholder="Call script" />
              <Textarea value={formAction.supportive_content?.email_template || ''} onChange={(e) => setFormAction((p) => ({ ...p, supportive_content: { ...p.supportive_content, email_template: e.target.value } }))} placeholder="Email template" />
              <Textarea value={formAction.supportive_content?.presentation_notes || ''} onChange={(e) => setFormAction((p) => ({ ...p, supportive_content: { ...p.supportive_content, presentation_notes: e.target.value } }))} placeholder="Presentation notes" />

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button onClick={saveAction} className="gap-1"><Save className="h-3.5 w-3.5" />{editingActionId ? 'Update action' : 'Create action'}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">Common pipeline view: Contact - Qualification - Meeting - Proposal - Negotiation - Closing - Retention.</div>
            <Button variant="outline" size="sm" onClick={seedPipelineBaseline}>Load KAM baseline</Button>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Total pipeline items</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{filteredPipelineRecords.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Proposal + negotiation</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{filteredPipelineRecords.filter((row) => row.stage === 'proposal' || row.stage === 'negotiation').length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Closing + retention</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{filteredPipelineRecords.filter((row) => row.stage === 'closing' || row.stage === 'retention').length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline value</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold">EUR {Math.round(filteredPipelineRecords.reduce((sum, row) => sum + row.contract_value, 0)).toLocaleString()}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Pipeline filters</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 xl:grid-cols-6 gap-3">
              <Select value={pipelineKamFilter} onValueChange={setPipelineKamFilter}>
                <SelectTrigger><SelectValue placeholder="KAM" /></SelectTrigger>
                <SelectContent>{pipelineFilterOptions.kam.map((value) => <SelectItem key={value} value={value}>{value === 'all' ? 'All KAMs' : value}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={pipelineRegionFilter} onValueChange={setPipelineRegionFilter}>
                <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
                <SelectContent>{pipelineFilterOptions.region.map((value) => <SelectItem key={value} value={value}>{value === 'all' ? 'All regions' : value}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={pipelineSectorFilter} onValueChange={setPipelineSectorFilter}>
                <SelectTrigger><SelectValue placeholder="Sector" /></SelectTrigger>
                <SelectContent>{pipelineFilterOptions.sector.map((value) => <SelectItem key={value} value={value}>{value === 'all' ? 'All sectors' : value}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={pipelineProductTypeFilter} onValueChange={(value) => setPipelineProductTypeFilter(value as 'all' | 'service' | 'equipment')}>
                <SelectTrigger><SelectValue placeholder="Product type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All product types</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                </SelectContent>
              </Select>
              <Select value={pipelineFamilyFilter} onValueChange={setPipelineFamilyFilter}>
                <SelectTrigger><SelectValue placeholder="Product family" /></SelectTrigger>
                <SelectContent>{pipelineFilterOptions.family.map((value) => <SelectItem key={value} value={value}>{value === 'all' ? 'All families' : value}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={pipelineSearch} onChange={(event) => setPipelineSearch(event.target.value)} placeholder="Account, offer, product" />
            </CardContent>
          </Card>

          {offerPipelineLoading ? (
            <Card><CardContent className="py-8 text-sm text-muted-foreground">Loading unified pipeline...</CardContent></Card>
          ) : (
            <div className="grid xl:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Sales pipeline distribution</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {pipelineStageSummary.map((summary) => {
                    const total = Math.max(filteredPipelineRecords.length, 1);
                    const ratio = (summary.count / total) * 100;
                    return (
                      <button
                        key={summary.stage}
                        type="button"
                        className={`w-full border rounded-md p-3 text-left transition ${selectedPipelineStage === summary.stage ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}
                        onClick={() => setSelectedPipelineStage((previous) => previous === summary.stage ? 'all' : summary.stage)}
                      >
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="font-medium">{PIPELINE_STAGE_LABELS[summary.stage]}</span>
                          <span>{summary.count} items · EUR {Math.round(summary.value).toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${ratio}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Stage detail panel</CardTitle></CardHeader>
                <CardContent className="space-y-2 max-h-[520px] overflow-auto">
                  {filteredPipelineRecords.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No records for current filters.</p>
                  ) : filteredPipelineRecords.map((entry) => (
                    <div key={entry.id} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{entry.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{entry.title} · {entry.offer_number}</p>
                        </div>
                        <Badge variant={entry.score >= 85 ? 'default' : 'secondary'}>{PIPELINE_STAGE_LABELS[entry.stage]}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                        <span className="border rounded-full px-2 py-0.5">KAM: {entry.kam}</span>
                        <span className="border rounded-full px-2 py-0.5">{entry.region}</span>
                        <span className="border rounded-full px-2 py-0.5">{entry.product_type}</span>
                        <span className="border rounded-full px-2 py-0.5">{entry.product_family}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{entry.next_action}</p>
                      <div className="flex justify-between items-center text-xs">
                        <span>EUR {Math.round(entry.contract_value).toLocaleString()}</span>
                        <Button size="sm" variant="outline" onClick={() => addTask(buildPipelineTask(entry))}>Create task</Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="offers" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Offer register and source documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {offerPipeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No offers loaded yet.</p>
              ) : offerPipeline.map((offer) => (
                <div key={offer.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-medium">{offer.title}</p>
                      <p className="text-xs text-muted-foreground">{offer.customer_name} - {offer.offer_number} - {offer.status}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={offer.bucket === 'sold' ? 'outline' : offer.bucket === 'live' ? 'default' : 'secondary'}>{offer.bucket}</Badge>
                      <Badge variant={offer.score >= 90 ? 'destructive' : offer.score >= 75 ? 'default' : 'secondary'}>{offer.score}</Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    {offer.kam ? <span className="border rounded-full px-2 py-0.5">KAM: {offer.kam}</span> : null}
                    {offer.site ? <span className="border rounded-full px-2 py-0.5">Site: {offer.site}</span> : null}
                    {offer.country ? <span className="border rounded-full px-2 py-0.5">{offer.country}</span> : null}
                    {offer.contract_value > 0 ? <span className="border rounded-full px-2 py-0.5">EUR {offer.contract_value.toLocaleString()}</span> : null}
                  </div>

                  <p className="text-xs text-muted-foreground">{offer.context}</p>
                  <p className="text-xs font-medium">Next action: {offer.next_action}</p>

                  <div className="space-y-2">
                    <p className="text-xs font-medium">Linked documents</p>
                    {offer.documents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No linked offer files found in the local evidence folders.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {offer.documents.map((documentPath) => (
                          <span key={documentPath} className="rounded-full border px-2 py-1 text-[10px] text-muted-foreground" title={documentPath}>
                            {getPathLabel(documentPath)}
                          </span>
                        ))}
                      </div>
                    )}
                    {offer.project_folder ? (
                      <p className="text-[10px] text-muted-foreground">Project folder: {offer.project_folder}</p>
                    ) : null}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!activeCompanyId) {
                          toast({ title: 'No company selected', description: 'Select a company to create the offer task.' });
                          return;
                        }
                        addTask(buildPipelineTask(offer));
                        toast({ title: 'Offer task created', description: `${offer.customer_name} moved into the action queue.` });
                      }}
                    >
                      Create task
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulate" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Trigger simulation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>Event</Label>
                  <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Health score</Label><Input type="number" value={healthScore} onChange={(e) => setHealthScore(Number(e.target.value) || 0)} /></div>
                <div><Label>Usage growth (%)</Label><Input type="number" value={usageGrowth} onChange={(e) => setUsageGrowth(Number(e.target.value) || 0)} /></div>
                <div><Label>Churn risk (0-1)</Label><Input type="number" step="0.01" value={churnRisk} onChange={(e) => setChurnRisk(Number(e.target.value) || 0)} /></div>
                <div><Label>NPS score</Label><Input type="number" value={npsScore} onChange={(e) => setNpsScore(Number(e.target.value) || 0)} /></div>
              </div>

              <div className="flex justify-end">
                <Button onClick={runTriggerSimulation} className="gap-1"><Play className="h-3.5 w-3.5" />Run simulation</Button>
              </div>

              {simulatedActions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Triggered actions ({simulatedActions.length})</p>
                  {simulatedActions.map((action) => (
                    <div key={action.id} className="border rounded p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{action.name}</p>
                        <p className="text-xs text-muted-foreground">{action.stage} - {action.description}</p>
                      </div>
                      <Button size="sm" onClick={() => addAsTask(action, action.stage)} className="gap-1"><Rocket className="h-3.5 w-3.5" />Create task</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Next Best Action engine</CardTitle></CardHeader>
            <CardContent>
              {nextBestAction ? (
                <div className="border rounded p-3">
                  <p className="text-sm font-semibold">{nextBestAction.name}</p>
                  <p className="text-xs text-muted-foreground">{nextBestAction.stage} - score {nextBestAction.computed_score}</p>
                  <p className="text-xs text-muted-foreground mt-1">{nextBestAction.description}</p>
                  <Button size="sm" className="mt-2 gap-1" onClick={() => addAsTask(nextBestAction, nextBestAction.stage)}>
                    <Target className="h-3.5 w-3.5" />Create task from next-best
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No next-best action available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capacity" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Working hours panel</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-4 gap-3">
                <div>
                  <Label>Available working hours</Label>
                  <Input type="number" value={workingHours} onChange={(e) => setWorkingHours(Number(e.target.value) || 0)} />
                </div>
                <div className="border rounded-md px-3 py-2 text-sm"><span className="text-muted-foreground">Used:</span> {capacityPlan.usedHours}h</div>
                <div className="border rounded-md px-3 py-2 text-sm"><span className="text-muted-foreground">Remaining:</span> {capacityPlan.remainingHours}h</div>
                <div className="border rounded-md px-3 py-2 text-sm"><span className="text-muted-foreground">Selected:</span> {capacityPlan.selected.length}</div>
              </div>
              <Progress value={workingHours > 0 ? Math.min(100, (capacityPlan.usedHours / workingHours) * 100) : 0} className="h-2" />

              <div className="flex justify-end">
                <Button onClick={addCapacityPlanTasks} className="gap-1" disabled={capacityPlan.selected.length === 0}><Wand2 className="h-3.5 w-3.5" />Create filtered task list</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Ideal action pool (no resource limits) + filtered execution list</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {allActions.map((action) => {
                const selected = capacityPlan.selected.some((s) => s.id === action.id);
                return (
                  <div key={action.id} className={`border rounded p-3 ${selected ? 'border-primary/40 bg-primary/5' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{action.name}</p>
                        <p className="text-xs text-muted-foreground">{action.stage} - {action.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={selected ? 'default' : 'outline'}>{selected ? 'Selected' : 'Candidate'}</Badge>
                        <Badge variant="outline"><Timer className="h-3 w-3 mr-1" />{action.estimated_hours}h</Badge>
                        <Badge variant={action.computed_score >= 90 ? 'destructive' : action.computed_score >= 75 ? 'default' : 'secondary'}>
                          Score {action.computed_score}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {(!validation.valid || cycles.length > 0) && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">Validation report (execution blocked)</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            {validation.issues.map((issue, index) => <p key={index}>- {issue}</p>)}
            {cycles.map((cycle) => <p key={cycle}>- Circular trigger detected: {cycle}</p>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CommercialActionsRepositoryPage;













