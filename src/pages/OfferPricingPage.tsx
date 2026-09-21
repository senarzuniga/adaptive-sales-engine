import React, { useState, useEffect, useMemo } from 'react';
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
  FolderKanban, ArrowRight, Settings2
} from 'lucide-react';
import { buildFallbackOfferAnalysis, classifyEdgeRuntimeError, invokeEdgeWithRetry } from '@/lib/edgeStability';
import { inferProductCategory } from '@/lib/productCatalog';
import { buildOfferCostPreset, mergeProductWithKnowledge } from '@/lib/productKnowledge';
import { DEFAULT_INGECART_POLICY, buildIngecartOfferTemplate } from '@/lib/utils';
import { InstallationPlanner } from '@/components/costs/InstallationPlanner';
import { computeInstallationCost, createInstallationPlan, describeInstallationPlan, type InstallationPlan } from '@/lib/installationCost';
import { isWorkspaceSupabaseConfigured, readWorkspaceRows, writeWorkspaceRows } from '@/lib/workspaceStorage';
import { downloadOfferWordDocument } from '@/lib/offerWordExport';
import { buildOfferDocumentPath, buildSuggestedOfferProjectFolder, upsertOfferDocument } from '@/lib/offerDocumentRegistry';
import { OfferCommercialTermsEditor } from '@/components/offers/OfferCommercialTermsEditor';
import { OfferPackagePlanner } from '@/components/offers/OfferPackagePlanner';
import { buildDefaultCommercialTerms, buildPaymentTermsText, hydrateCommercialTerms, hydrateOfferPackage, summarizePackageCostWithPolicy, type OfferCommercialTerms, type OfferPackageDraft } from '@/lib/offerPackages';

type CostLine = {
  id: string;
  category: string;
  lineItem: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  surchargePct: number;
  /** Internal structure management overhead (%) added on top of the line cost. */
  structurePct: number;
  hours: number;
  hourlyRate: number;
  days: number;
  resources: number;
  notes: string;
  /** Detailed labour + travel plan for installation lines. */
  installation?: InstallationPlan;
  /** Transport line that carries the travel & expenses of this installation plan. */
  linkedTravelLineId?: string;
};

type OfferItem = {
  id: string;
  name: string;
  type: 'product' | 'service' | 'package';
  quantity: number;
  description: string;
  costLines: CostLine[];
};

type OfferDocumentLanguage = 'en' | 'es';

type Scenario = {
  type: string;
  totalCost: number;
  sellingPrice: number;
  marginAmount: number;
  marginPct: number;
  riskLevel: string;
  adjustments?: string[];
};

type AnalysisResult = {
  scenarios: Scenario[];
  scoring: { marginScore: string; marginValue?: number; riskScore: string; riskValue?: number; globalScore: number; explanation: string };
  riskFactors: Array<string | { category: string; description: string; severity: string; impact?: string }>;
  recommendations: Array<string | { type: string; title: string; description: string; estimatedImpact?: string }>;
  costAnalysis?: { materialsRatio: number; engineeringRatio: number; installationRatio: number; missingCategories?: string[]; rateValidation?: { rateName: string; applied: number; expected: number; deviation: string }[]; alerts?: string[] };
  pricingStrategies?: { costPlus?: { price: number; margin: number }; valueBased?: { price: number; margin: number; rationale: string }; benchmarking?: { price: number; margin: number; rationale: string } };
  profitabilityControl?: { minimumMarginScenario?: { margin: number; conditions: string }; riskAdjustedMargin?: { margin: number; adjustments: string }; belowThreshold?: boolean; correctiveActions?: string[] };
};

const CATEGORIES = [
  { value: 'materials', label: 'Comercio' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'subcontracting', label: 'Subcontratas' },
  { value: 'installation', label: 'Installation' },
  { value: 'transport', label: 'Transport & Logistics' },
  { value: 'indirect', label: 'Otros' },
];

const CATEGORIES_ES: Record<string, string> = {
  materials: 'Comercio',
  engineering: "Ingeniera",
  subcontracting: 'Subcontratas',
  installation: "Instalacin",
  transport: "Transporte y Logstica",
  indirect: 'Otros',
};

const newCostLine = (category: string): CostLine => ({
  id: crypto.randomUUID(),
  category,
  lineItem: '',
  quantity: 1,
  unitCost: 0,
  totalCost: 0,
  surchargePct: 0,
  structurePct: 0,
  hours: 0,
  hourlyRate: 0,
  days: 0,
  resources: 0,
  notes: '',
});

// Line total = base + surcharge % + internal structure overhead %.
const lineTotal = (base: number, surchargePct: number, structurePct: number) =>
  base + base * (Number(surchargePct) || 0) / 100 + base * (Number(structurePct) || 0) / 100;

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const sortOffersByRecent = <T extends { updated_at?: string; created_at?: string }>(rows: T[]) =>
  rows.slice().sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));

const getOfferDraftStorageKey = (companyId: string) => 'acs_offer_pricing_draft_' + companyId;

const parseOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type OfferDraftSnapshot = {
  editingOfferId: string | null;
  offerTitle: string;
  offerNumber: string;
  offerNumberIsAuto: boolean;
  customerName: string;
  customerMode: 'existing' | 'new';
  newCustomer: { name: string; country: string; contactName: string; email: string };
  projectDesc: string;
  currency: string;
  targetMargin: number;
  pricingPolicy: typeof DEFAULT_INGECART_POLICY;
  commercialTerms: OfferCommercialTerms;
  offerPackages: OfferPackageDraft[];
  principalPackagePriceOverride: number | null;
  offerTotalPriceOverride: number | null;
  items: OfferItem[];
  documentLanguage: OfferDocumentLanguage;
};

const hasMeaningfulDraftSnapshot = (snapshot: OfferDraftSnapshot) =>
  Boolean(
    snapshot.offerTitle.trim() ||
    snapshot.offerNumber.trim() ||
    snapshot.customerName.trim() ||
    snapshot.projectDesc.trim() ||
    snapshot.newCustomer.name.trim() ||
    snapshot.items.some((item) =>
      item.name.trim() ||
      item.description.trim() ||
      item.costLines.some((line) =>
        line.lineItem.trim() ||
        Number(line.totalCost || 0) > 0 ||
        Number(line.unitCost || 0) > 0 ||
        Number(line.hours || 0) > 0 ||
        Number(line.days || 0) > 0,
      ),
    ),
  );

const RECOVERED_SIGMAQ_OFFER_ID = 'recovered-off-2026-138-sigmaq-guatemala-ffg-mid-line-palletizer';
const RECOVERED_SIGMAQ_ITEM_ID = 'recovered-off-2026-138-item-1';

const KNOWN_EXTERNAL_OFFER_DOCUMENTS: Record<string, string> = {
  'OFF-2026-138': 'C:\\Users\\isena\\Documents\\INGECART\\COMMERCIAL\\PROYECTOS\\Sigmaq Guatemala\\OFF-2026-138 lINETEX_Sigmaq_Guatemala_FFG_MID_LINE_PALLETIZER_ES_OPCIONAL.docx',
  'OFF-2026-139': 'C:\\Users\\isena\\Documents\\INGECART\\COMMERCIAL\\PROYECTOS\\Sigmaq Guatemala\\OFF-2026-139_lINETEX_Sigmaq_Guatemala_GOFFER_OUTPUT_HD_PALLETIZER_ES_R5.docx',
};

const getFileNameFromPath = (value: string) => {
  const parts = String(value || '').split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || value;
};

const isMissingRelationError = (error: any) => {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('could not find') || msg.includes('relation') || msg.includes('schema cache');
};

export default function OfferPricingPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { activeCompanyId: selectedCompanyId, data, setContacts } = useData();
  const isEs = language === 'es';
  const isIngecartWorkspace = /ingecart/i.test([selectedCompanyId, data.companyProfile.company_name].join(' '));

  const [offerTitle, setOfferTitle] = useState('');
  const [offerNumber, setOfferNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [newCustomer, setNewCustomer] = useState({ name: '', country: '', contactName: '', email: '' });
  const [projectDesc, setProjectDesc] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [targetMargin, setTargetMargin] = useState(20);
  const [pricingPolicy, setPricingPolicy] = useState(DEFAULT_INGECART_POLICY);
  const [commercialTerms, setCommercialTerms] = useState<OfferCommercialTerms>(() => buildDefaultCommercialTerms());
  const [offerPackages, setOfferPackages] = useState<OfferPackageDraft[]>([]);
  const [principalPackagePriceOverride, setPrincipalPackagePriceOverride] = useState<number | null>(null);
  const [offerTotalPriceOverride, setOfferTotalPriceOverride] = useState<number | null>(null);
  const [documentLanguage, setDocumentLanguage] = useState<OfferDocumentLanguage>('en');

  const [items, setItems] = useState<OfferItem[]>([{
    id: crypto.randomUUID(), name: '', type: 'product', quantity: 1, description: '',
    costLines: CATEGORIES.map(c => newCostLine(c.value)),
  }]);

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set([items[0].id]));
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [exportingOfferId, setExportingOfferId] = useState<string | null>(null);
  const [savedOffers, setSavedOffers] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [activeTab, setActiveTab] = useState('builder');
  const [companyRates, setCompanyRates] = useState<any[]>([]);
  const [catalogSelection, setCatalogSelection] = useState('');
  const [catalogLengthM, setCatalogLengthM] = useState(80);
  const [catalogIncludeInstallation, setCatalogIncludeInstallation] = useState(true);
  const restoredDraftCompanyId = React.useRef<string | null>(null);

  useEffect(() => {
    if (selectedCompanyId) {
      loadOffers();
      loadRates();
    }
  }, [selectedCompanyId]);

  const loadRates = async () => {
    if (!selectedCompanyId) return;
    const { data } = await supabase.from('cost_rates').select('*').eq('company_id', selectedCompanyId).eq('is_active', true);
    if (data) setCompanyRates(data);
  };

  const registerOfferDocument = (offer: any, language: OfferDocumentLanguage, fileName: string, source: 'generated' | 'external-reference', explicitPath?: string) => {
    if (!selectedCompanyId) return;
    const projectFolder = explicitPath ? explicitPath.split(/[/\\]/).slice(0, -1).join('\\') : String(offer.project_folder || buildSuggestedOfferProjectFolder(data.companyProfile, String(offer.customer_name || customerName || 'Customer')));
    const documentPath = explicitPath || buildOfferDocumentPath(projectFolder, fileName);
    const localOffers = readWorkspaceRows<any>('offers', selectedCompanyId);
    const updatedOffer = {
      ...offer,
      project_folder: projectFolder,
      document_paths: Array.from(new Set([...(Array.isArray(offer.document_paths) ? offer.document_paths : []), documentPath])),
      updated_at: new Date().toISOString(),
    };
    writeWorkspaceRows('offers', selectedCompanyId, [updatedOffer, ...localOffers.filter((row) => row.id !== offer.id)]);
    setSavedOffers((current) => sortOffersByRecent([updatedOffer, ...current.filter((row) => row.id !== offer.id)]));
    upsertOfferDocument(selectedCompanyId, {
      id: `${offer.id || offer.offer_number}-${language}`,
      offerId: offer.id,
      offerNumber: String(offer.offer_number || ''),
      accountName: String(offer.customer_name || customerName || 'Customer'),
      fileName,
      fileType: 'DOCX',
      owner: 'Offer Builder',
      updatedAt: new Date().toISOString().slice(0, 10),
      language,
      path: documentPath,
      projectFolder,
      source,
    });
  };

  const ensureKnownExternalOfferDocuments = (offers: any[]) => {
    if (!selectedCompanyId || !isIngecartWorkspace) return offers;
    let changed = false;
    const nextOffers = offers.map((offer) => {
      const offerNumber = String(offer.offer_number || '').toUpperCase();
      const knownPath = KNOWN_EXTERNAL_OFFER_DOCUMENTS[offerNumber];
      if (!knownPath) return offer;
      const documentPaths = Array.isArray(offer.document_paths) ? offer.document_paths : [];
      if (documentPaths.includes(knownPath) && offer.project_folder) return offer;
      changed = true;
      return {
        ...offer,
        project_folder: knownPath.split(/[/\\]/).slice(0, -1).join('\\'),
        document_paths: Array.from(new Set([...documentPaths, knownPath])),
      };
    });
    Object.entries(KNOWN_EXTERNAL_OFFER_DOCUMENTS).forEach(([offerNumber, knownPath]) => {
      const offer = nextOffers.find((candidate) => String(candidate.offer_number || '').toUpperCase() == offerNumber);
      const accountName = String(offer?.customer_name || 'Sigmaq Guatemala');
      upsertOfferDocument(selectedCompanyId, {
        id: `${offerNumber}-external-es`,
        offerId: offer?.id,
        offerNumber,
        accountName,
        fileName: getFileNameFromPath(knownPath),
        fileType: 'DOCX',
        owner: 'External final offer',
        updatedAt: '2026-09-16',
        language: 'es',
        path: knownPath,
        projectFolder: knownPath.split(/[/\\]/).slice(0, -1).join('\\'),
        source: 'external-reference',
      });
    });
    if (changed) writeWorkspaceRows('offers', selectedCompanyId, nextOffers);
    return nextOffers;
  };

  const loadOffers = async () => {
    if (!selectedCompanyId) return;
    const ensureRecoveredSigmaqOffer = () => {
      const localOffers = readWorkspaceRows<any>('offers', selectedCompanyId);
      const alreadyPresent = localOffers.some((row) => String(row.offer_number || '').toUpperCase() === 'OFF-2026-138');
      if (!isIngecartWorkspace || alreadyPresent) return localOffers;

      const now = '2026-09-16T09:00:00.000Z';
      const defaults = buildDefaultCommercialTerms();
      const recoveredOffer = {
        id: RECOVERED_SIGMAQ_OFFER_ID,
        company_id: selectedCompanyId,
        offer_number: 'OFF-2026-138',
        title: 'Sigmaq Guatemala FFG MID LINE PALLETIZER',
        customer_name: 'Sigmaq Guatemala',
        company_name: 'Ingecart 2018 SL',
        project_description: 'Recovered Sigmaq Guatemala phased palletizer offer. Scope kept editable and linked to the Sigmaq Guatemala evidence set.',
        currency: 'EUR',
        status: 'draft',
        contract_value: 0,
        total_cost: 0,
        probability: 55,
        target_margin: 20,
        cost_policy: DEFAULT_INGECART_POLICY,
        document_language: 'en',
        context: 'Recovered from Sigmaq Guatemala project evidence and locked into the ASE local workspace so it remains traceable and editable.',
        next_action: 'Validate package scope, complete pricing, and release the final customer version from Offer Builder / History.',
        created_at: now,
        updated_at: now,
        storage: 'local',
      };
      writeWorkspaceRows('offers', selectedCompanyId, [recoveredOffer, ...localOffers]);
      writeWorkspaceRows('offer_items', selectedCompanyId, [
        ...readWorkspaceRows<any>('offer_items', selectedCompanyId),
        {
          id: RECOVERED_SIGMAQ_ITEM_ID,
          offer_id: RECOVERED_SIGMAQ_OFFER_ID,
          item_name: 'FFG Mid Line Palletizer',
          item_type: 'product',
          quantity: 1,
          description: 'Executive scope placeholder recovered from the Sigmaq Guatemala phased automation context. Complete the commercial and cost basis before issuing the final version.',
          created_at: now,
        },
      ]);
      writeWorkspaceRows('offer_commercial_terms', selectedCompanyId, [
        ...readWorkspaceRows<any>('offer_commercial_terms', selectedCompanyId).filter((row) => row.offer_id !== RECOVERED_SIGMAQ_OFFER_ID),
        {
          id: 'commercial-' + RECOVERED_SIGMAQ_OFFER_ID,
          offer_id: RECOVERED_SIGMAQ_OFFER_ID,
          equipment_incoterm: defaults.equipmentIncoterm,
          incoterm_location: defaults.incotermLocation,
          delivery_months: defaults.deliveryMonths,
          delivery_notes: defaults.deliveryNotes,
          validity_days: defaults.validityDays,
          warranty_months: defaults.warrantyMonths,
          payment_milestones: defaults.paymentMilestones,
          created_at: now,
          updated_at: now,
        },
      ]);
      return [recoveredOffer, ...localOffers];
    };

    const local = ensureKnownExternalOfferDocuments(ensureRecoveredSigmaqOffer());
    if (!isWorkspaceSupabaseConfigured) {
      setSavedOffers(sortOffersByRecent(local));
      return;
    }
    const { data: remote } = await supabase.from('offers').select('*').eq('company_id', selectedCompanyId).order('created_at', { ascending: false });
    const remoteIds = new Set((remote || []).map((row: any) => row.id));
    const localById = new Map(local.map((row) => [row.id, row]));
    const mergedRemote = (remote || []).map((row: any) => (localById.has(row.id) ? { ...row, ...localById.get(row.id) } : row));
    setSavedOffers(sortOffersByRecent(ensureKnownExternalOfferDocuments([...(mergedRemote || []), ...local.filter((row) => !remoteIds.has(row.id))])));
  };

  useEffect(() => {
    if (!selectedCompanyId || restoredDraftCompanyId.current === selectedCompanyId) return;
    restoredDraftCompanyId.current = selectedCompanyId;
    const raw = localStorage.getItem(getOfferDraftStorageKey(selectedCompanyId));
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as OfferDraftSnapshot;
      if (!hasMeaningfulDraftSnapshot(draft)) return;
      setEditingOfferId(draft.editingOfferId);
      setOfferTitle(draft.offerTitle || '');
      offerNumberIsAuto.current = Boolean(draft.offerNumberIsAuto);
      setOfferNumber(draft.offerNumber || '');
      setCustomerName(draft.customerName || '');
      setCustomerMode(draft.customerMode || 'existing');
      setNewCustomer(draft.newCustomer || { name: '', country: '', contactName: '', email: '' });
      setProjectDesc(draft.projectDesc || '');
      setCurrency(draft.currency || 'EUR');
      setTargetMargin(Number(draft.targetMargin || 20));
      setPricingPolicy(draft.pricingPolicy || DEFAULT_INGECART_POLICY);
      setCommercialTerms(hydrateCommercialTerms(draft.commercialTerms));
      setOfferPackages((draft.offerPackages || []).map((pkg, index) => hydrateOfferPackage(pkg, index + 1)));
      setPrincipalPackagePriceOverride(parseOptionalNumber((draft as any).principalPackagePriceOverride));
      setOfferTotalPriceOverride(parseOptionalNumber((draft as any).offerTotalPriceOverride));
      if (draft.items?.length) {
        setItems(draft.items);
        setExpandedItems(new Set(draft.items.map((item) => item.id)));
      }
      setDocumentLanguage(draft.documentLanguage === 'es' ? 'es' : 'en');
      toast({ title: isEs ? 'Borrador restaurado' : 'Draft restored', description: draft.offerNumber || draft.offerTitle || 'Latest draft' });
    } catch (error) {
      console.warn('[offers] failed to restore local draft', error);
    }
  }, [isEs, selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    const snapshot: OfferDraftSnapshot = {
      editingOfferId,
      offerTitle,
      offerNumber,
      offerNumberIsAuto: offerNumberIsAuto.current,
      customerName,
      customerMode,
      newCustomer,
      projectDesc,
      currency,
      targetMargin,
      pricingPolicy,
      commercialTerms,
      offerPackages,
      principalPackagePriceOverride,
      offerTotalPriceOverride,
      items,
      documentLanguage,
    };
    const key = getOfferDraftStorageKey(selectedCompanyId);
    if (!hasMeaningfulDraftSnapshot(snapshot)) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(snapshot));
  }, [selectedCompanyId, editingOfferId, offerTitle, offerNumber, customerName, customerMode, newCustomer, projectDesc, currency, targetMargin, pricingPolicy, commercialTerms, offerPackages, principalPackagePriceOverride, offerTotalPriceOverride, items, documentLanguage]);

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
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

  const selectedCatalogProduct = useMemo(() => {
    const selected = data.products.find((product) => product.name === catalogSelection);
    return selected ? mergeProductWithKnowledge(selected) : null;
  }, [catalogSelection, data.products]);

  useEffect(() => {
    if (selectedCatalogProduct) {
      setCatalogLengthM(selectedCatalogProduct.defaultLengthM || 80);
      setCatalogIncludeInstallation(true);
    }
  }, [selectedCatalogProduct]);

  const presetLineToCostLine = (line: ReturnType<typeof buildOfferCostPreset>[number]): CostLine => {
    const category = line.category;
    const quantity = Number(line.quantity || 0);
    const unitCost = Number(line.unitCost || 0);
    const surchargePct = Number(line.surchargePct || 0);
    const structurePct = Number(line.structurePct || 0);
    const hours = Number(line.hours || 0);
    const hourlyRate = Number(line.hourlyRate || 0);
    const days = Number(line.days || 0);
    const resources = Number(line.resources || 0);
    const baseTotal = category === 'engineering'
      ? hours * hourlyRate
      : category === 'installation'
        ? days * resources * unitCost
        : quantity * unitCost;

    return {
      id: crypto.randomUUID(),
      category,
      lineItem: line.lineItem,
      quantity: quantity || 1,
      unitCost,
      totalCost: lineTotal(baseTotal, surchargePct, structurePct),
      surchargePct,
      structurePct,
      hours,
      hourlyRate,
      days,
      resources,
      notes: line.notes || '',
    };
  };

  // Builds the labour line (installation) and its linked travel & expenses line (transport) from a plan.
  const buildInstallationLines = (plan: InstallationPlan, base: Partial<CostLine> & { lineItem: string }, existing?: { laborId?: string; travelId?: string }): { labor: CostLine; travel: CostLine } => {
    const result = computeInstallationCost(plan, pricingPolicy);
    const travelId = existing?.travelId || crypto.randomUUID();
    const structurePct = Number(base.structurePct || 0);
    const labor: CostLine = {
      ...newCostLine('installation'),
      ...base,
      id: existing?.laborId || crypto.randomUUID(),
      category: 'installation',
      quantity: 1,
      days: plan.days,
      resources: plan.resources,
      unitCost: Math.round(result.laborPerResourceDay * 100) / 100,
      surchargePct: 0,
      structurePct,
      totalCost: lineTotal(result.labor, 0, structurePct),
      notes: describeInstallationPlan(plan, result),
      installation: plan,
      linkedTravelLineId: travelId,
    };
    const travel: CostLine = {
      ...newCostLine('transport'),
      id: travelId,
      lineItem: `${base.lineItem || 'Installation'} - travel & expenses`,
      quantity: 1,
      unitCost: result.travel,
      structurePct,
      totalCost: lineTotal(result.travel, 0, structurePct),
      notes: result.breakdown.filter((entry) => entry.group === 'travel').map((entry) => `${entry.label}: ${Math.round(entry.amount)} EUR`).join(' | '),
    };
    return { labor, travel };
  };

  const presetLinesToCostLines = (presetLines: ReturnType<typeof buildOfferCostPreset>): CostLine[] =>
    presetLines.flatMap((line) => {
      if (line.category === 'installation' && line.installation) {
        const { labor, travel } = buildInstallationLines(line.installation, { lineItem: line.lineItem, structurePct: Number(line.structurePct || 0) });
        return [labor, travel];
      }
      return [presetLineToCostLine(line)];
    });

  const [plannerLineId, setPlannerLineId] = useState<string | null>(null);

  const applyInstallationPlan = (itemId: string, lineId: string, plan: InstallationPlan | null) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const current = item.costLines.find((cl) => cl.id === lineId);
      if (!current) return item;
      if (!plan) {
        const base = current.days * current.resources * current.unitCost;
        return {
          ...item,
          costLines: item.costLines
            .filter((cl) => cl.id !== current.linkedTravelLineId)
            .map((cl) => (cl.id === lineId ? { ...cl, installation: undefined, linkedTravelLineId: undefined, totalCost: lineTotal(base, cl.surchargePct, cl.structurePct) } : cl)),
        };
      }
      const { labor, travel } = buildInstallationLines(plan, { lineItem: current.lineItem || 'Installation', structurePct: current.structurePct }, { laborId: current.id, travelId: current.linkedTravelLineId });
      const hasTravel = item.costLines.some((cl) => cl.id === travel.id);
      const costLines = item.costLines.map((cl) => (cl.id === lineId ? labor : cl.id === travel.id ? travel : cl));
      return { ...item, costLines: hasTravel ? costLines : [...costLines, travel] };
    }));
  };
  const applyIngecartOfferTemplate = () => {
    const template = buildIngecartOfferTemplate(customerName || 'Ingecart 2018 SL', projectDesc || 'Industrial automation and installation project');
    setOfferTitle(template.projectName);
    setProjectDesc(template.summary);
    setPricingPolicy(DEFAULT_INGECART_POLICY);
    toast({
      title: isEs ? 'Plantilla Ingecart cargada' : 'Ingecart template loaded',
      description: isEs ? "Se aplican los valores de garanta, viajes, instalacin y estructura comercial recomendados." : 'The recommended cost, travel and installation commercial policy values have been applied.',
    });
  };

  const addCatalogItem = () => {
    const selected = selectedCatalogProduct;
    if (!selected) return;

    const category = inferProductCategory(selected.type, selected.category);
    const presetLines = buildOfferCostPreset(selected, {
      lengthM: selected.configurableByLength ? catalogLengthM : selected.defaultLengthM,
      includeInstallation: catalogIncludeInstallation,
    });
    const costLines = presetLines.length > 0
      ? presetLinesToCostLines(presetLines)
      : CATEGORIES.map((cat) => {
          const fallbackCategory = category === 'service' ? 'engineering' : 'materials';
          const unitCost = Number(selected.estimatedCost || selected.averageValue || 0);
          return cat.value === fallbackCategory
            ? { ...newCostLine(cat.value), lineItem: selected.name, quantity: 1, unitCost, totalCost: unitCost }
            : newCostLine(cat.value);
        });

    const descriptor = [selected.characteristics?.join(', '), selected.comments].filter(Boolean).join(' | ');
    const lengthDescriptor = selected.configurableByLength ? `Length: ${catalogLengthM}m` : null;
    const installationDescriptor = presetLines.some((line) => line.category === 'installation') ? (catalogIncludeInstallation ? 'Installation included' : 'Installation excluded') : null;

    const item: OfferItem = {
      id: crypto.randomUUID(),
      name: selected.name,
      type: category,
      quantity: 1,
      description: [descriptor, lengthDescriptor, installationDescriptor].filter(Boolean).join(' | '),
      costLines,
    };

    setItems((prev) => [...prev, item]);
    setExpandedItems((prev) => new Set(prev).add(item.id));
    setCatalogSelection('');
    setCatalogLengthM(selected.defaultLengthM || 80);
    setCatalogIncludeInstallation(true);
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
          if (updated.category === 'installation' && updated.installation) {
            // Plan-driven line: base labour stays, only the overhead can change here.
            const labor = computeInstallationCost(updated.installation, pricingPolicy).labor;
            updated.totalCost = lineTotal(labor, 0, updated.structurePct);
          } else if (updated.category === 'engineering') {
            updated.totalCost = lineTotal(updated.hours * updated.hourlyRate, 0, updated.structurePct);
          } else if (updated.category === 'installation') {
            updated.totalCost = lineTotal(updated.days * updated.resources * updated.unitCost, updated.surchargePct, updated.structurePct);
          } else {
            updated.totalCost = lineTotal(updated.quantity * updated.unitCost, updated.surchargePct, updated.structurePct);
          }
          return updated;
        }),
      };
    }));
  };

  const removeCostLine = (itemId: string, lineId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const target = item.costLines.find(cl => cl.id === lineId);
      const idsToDrop = new Set([lineId, target?.linkedTravelLineId].filter(Boolean) as string[]);
      return { ...item, costLines: item.costLines.filter(cl => !idsToDrop.has(cl.id)) };
    }));
  };

  const builderCostRows = useMemo(() => items.flatMap((item) => item.costLines
    .filter((line) => line.totalCost > 0)
    .map((line) => ({
      offer_item_id: item.id,
      category: line.category,
      line_item: line.lineItem,
      total_cost: line.totalCost * item.quantity,
      hours: line.hours,
      quantity: line.quantity,
      days: line.days,
      resources: line.resources,
    }))), [items]);

  const totals = useMemo(() => {
    const byCat: Record<string, number> = {};
    let direct = 0;
    items.forEach(item => {
      item.costLines.forEach(cl => {
        byCat[cl.category] = (byCat[cl.category] || 0) + cl.totalCost * item.quantity;
        direct += cl.totalCost * item.quantity;
      });
    });
    const materials = byCat.materials || 0;
    const engineering = byCat.engineering || 0;
    const subcontracting = byCat.subcontracting || 0;
    // Warranty covers supplied goods (Comercio), engineering hours and subcontracted work.
    const warranty = (materials + engineering + subcontracting) * (Number(pricingPolicy.warrantyPct) || 0) / 100;
    const materialStructure = materials * (Number(pricingPolicy.materialStructurePct) || 0) / 100;
    const financial = direct * (Number(pricingPolicy.financialPct) || 0) / 100;
    const commercialMgmt = direct * (Number(pricingPolicy.commercialMgmtPct) || 0) / 100;
    const policyCharges = { warranty, materialStructure, financial, commercialMgmt };
    const total = direct + warranty + materialStructure + financial + commercialMgmt;
    return { byCat, direct, policyCharges, total, sellingPrice: total * (1 + targetMargin / 100), margin: total * targetMargin / 100 };
  }, [items, targetMargin, pricingPolicy]);

  // Offer numbers follow OFF-YYYY-NNN and continue the highest sequence already used this year.
  const generateOfferNumber = (existing: any[]) => {
    const year = new Date().getFullYear();
    const prefix = `OFF-${year}-`;
    const known = [
      ...existing.map((offer) => String(offer?.offer_number || '')),
      ...data.opportunities.map((opportunity) => String(opportunity.oppNumber || '')),
      ...data.orders.map((order) => String(order.oppNumber || '')),
    ];
    const maxSeq = known.reduce((max, value) => {
      const match = value.toUpperCase().match(new RegExp(`^${prefix}(\\d+)`));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  };

  // Keep proposing the next number until the user types their own.
  const offerNumberIsAuto = React.useRef(true);
  useEffect(() => {
    if (offerNumberIsAuto.current) {
      const next = generateOfferNumber(savedOffers);
      if (next !== offerNumber) setOfferNumber(next);
    }
  }, [savedOffers, data.opportunities, data.orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const editOfferNumber = (value: string) => {
    offerNumberIsAuto.current = value.trim() === '';
    setOfferNumber(value);
  };

  const updatePolicyPct = (field: 'warrantyPct' | 'financialPct' | 'commercialMgmtPct' | 'materialStructurePct', value: string) =>
    setPricingPolicy((prev) => ({ ...prev, [field]: value === '' ? 0 : Number(value) }));

  const itemSummaryRows = useMemo(() => items.map((item) => {
    const categoryTotals = Object.fromEntries(CATEGORIES.map((category) => [category.value, item.costLines.filter((line) => line.category === category.value).reduce((sum, line) => sum + line.totalCost, 0) * item.quantity]));
    const engineeringHours = item.costLines.reduce((sum, line) => sum + (line.category === 'engineering' ? line.hours : 0), 0) * item.quantity;
    const installationDays = item.costLines.reduce((sum, line) => sum + (line.category === 'installation' ? line.days * Math.max(line.resources || 1, 1) : 0), 0) * item.quantity;
    const total = Object.values(categoryTotals).reduce((sum, value) => sum + Number(value || 0), 0);
    return { id: item.id, name: item.name || '-', quantity: item.quantity, categoryTotals, engineeringHours, installationDays, total };
  }), [items]);

  const packageSummaryRows = useMemo(() => offerPackages
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((pkg) => {
      const pricing = summarizePackageCostWithPolicy(pkg, items, builderCostRows, pricingPolicy);
      const cost = pricing.totalCostWithPolicy;
      const price = Number(pkg.commercialPrice || 0);
      const margin = price - cost;
      return { pkg, pricing, cost, directCost: pricing.directCost, policyCost: pricing.policyCharges.total, price, margin, marginPct: price > 0 ? margin / price * 100 : 0 };
    }), [offerPackages, items, builderCostRows, pricingPolicy]);

  const packagePricingOverview = useMemo(() => {
    const additionalDirect = packageSummaryRows.reduce((sum, row) => sum + row.directCost, 0);
    const additionalPolicy = packageSummaryRows.reduce((sum, row) => sum + row.policyCost, 0);
    const additionalPrice = packageSummaryRows.reduce((sum, row) => sum + row.price, 0);

    const principalDirect = totals.direct - additionalDirect;
    const principalPolicy = (totals.total - totals.direct) - additionalPolicy;
    const principalCost = principalDirect + principalPolicy;
    const principalSuggestedPrice = principalCost * (1 + targetMargin / 100);
    const principalPrice = principalPackagePriceOverride ?? principalSuggestedPrice;

    const packagePriceSum = principalPrice + additionalPrice;
    const finalOfferPrice = offerTotalPriceOverride ?? packagePriceSum;
    const globalAdjustment = finalOfferPrice - packagePriceSum;
    const finalMargin = finalOfferPrice - totals.total;
    const finalMarginPct = finalOfferPrice > 0 ? finalMargin / finalOfferPrice * 100 : 0;

    return {
      additionalDirect,
      additionalPolicy,
      additionalPrice,
      principalDirect,
      principalPolicy,
      principalCost,
      principalSuggestedPrice,
      principalPrice,
      packagePriceSum,
      finalOfferPrice,
      globalAdjustment,
      finalMargin,
      finalMarginPct,
    };
  }, [packageSummaryRows, totals.direct, totals.total, targetMargin, principalPackagePriceOverride, offerTotalPriceOverride]);

  const filteredSavedOffers = useMemo(() => {
    const needle = historySearch.trim().toLowerCase();
    if (!needle) return savedOffers;
    return savedOffers.filter((offer) => [offer.offer_number, offer.title, offer.customer_name, offer.status].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [historySearch, savedOffers]);

  // Known customers come from the central store (orders, opportunities, leads, contacts) plus saved offers.
  const knownCustomers = useMemo(() => {
    const names = new Map<string, string>();
    const add = (value: unknown) => {
      const name = String(value || '').trim();
      if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
    };
    data.orders.forEach((order) => add(order.customerName));
    data.opportunities.forEach((opportunity) => add(opportunity.customerName));
    data.leads.forEach((lead) => add(lead.companyName));
    data.contacts.forEach((contact) => add(contact.companyName));
    savedOffers.forEach((offer) => add(offer.customer_name));
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
  }, [data.contacts, data.leads, data.opportunities, data.orders, savedOffers]);

  const createCustomer = () => {
    const name = newCustomer.name.trim();
    if (!name) {
      toast({ title: isEs ? 'Nombre de cliente requerido' : 'Customer name required', variant: 'destructive' });
      return;
    }
    const exists = knownCustomers.some((known) => known.toLowerCase() === name.toLowerCase());
    if (!exists) {
      setContacts([
        ...data.contacts,
        { name: newCustomer.contactName.trim(), email: newCustomer.email.trim(), phone: '', role: '', department: '', companyName: name, region: '', country: newCustomer.country.trim(), kam: '', notes: 'Created from Offer Pricing' },
      ]);
    }
    setCustomerName(name);
    setCustomerMode('existing');
    setNewCustomer({ name: '', country: '', contactName: '', email: '' });
    toast({ title: exists ? (isEs ? 'Cliente seleccionado' : 'Customer selected') : (isEs ? 'Cliente creado' : 'Customer created'), description: name });
  };

  const requestOfferAnalysis = async (): Promise<AnalysisResult> => {
    const costBreakdown = {
      items: items.map(item => ({
        name: item.name || 'Unnamed Item',
        type: item.type,
        quantity: item.quantity,
        costs: Object.fromEntries(
          CATEGORIES.map(c => [c.value, item.costLines.filter(cl => cl.category === c.value).map(cl => ({
            lineItem: cl.lineItem,
            quantity: cl.quantity,
            unitCost: cl.unitCost,
            totalCost: cl.totalCost,
            hours: cl.hours,
            hourlyRate: cl.hourlyRate,
            days: cl.days,
            resources: cl.resources,
            surchargePct: cl.surchargePct,
            structurePct: cl.structurePct,
          }))])
        ),
      })),
      totalCost: totals.total,
      directCost: totals.direct,
      policyCharges: totals.policyCharges,
      targetMargin,
      currency,
      costPolicy: pricingPolicy,
    };

    const ratesContext = companyRates.length > 0 ? companyRates.map(r => ({
      type: r.rate_type,
      name: r.rate_name,
      value: r.rate_value,
      unit: r.rate_unit,
      department: r.department,
      projectType: r.project_type,
      geography: r.geography,
    })) : null;

    const data = await invokeEdgeWithRetry<any>('analyze-offer', {
      costBreakdown,
      offerContext: { title: offerTitle, customer: customerName, project: projectDesc, offerNumber },
      companyRates: ratesContext,
    }, { fallbackLabel: 'local offer analysis' });

    if (data?.analysis) {
      return data.analysis as AnalysisResult;
    }

    return buildFallbackOfferAnalysis({ totalCost: totals.total, targetMargin, currency }) as AnalysisResult;
  };

  const syncRequestFromOffer = async (offer: any) => {
    const sb: any = supabase as any;
    const primaryContact = data.contacts.find((contact) => {
      const contactCompany = String(contact.companyName || '').trim().toLowerCase();
      return contactCompany && contactCompany === String(customerName || '').trim().toLowerCase();
    }) || data.contacts[0];


    try {
      const { data: existing, error: lookupError } = await sb
        .from('customer_requests')
        .select('id,status')
        .eq('linked_offer_id', offer.id)
        .maybeSingle();

      if (lookupError) {
        if (isMissingRelationError(lookupError)) return;
        throw lookupError;
      }

      const payload = {
        company: customerName || data.companyProfile.company_name || '',
        contact_name: primaryContact?.name || '',
        contact_email: primaryContact?.email || '',
        contact_phone: primaryContact?.phone || '',
        description: projectDesc || offerTitle || 'Offer pipeline request',
        status: 'new',
        linked_offer_id: offer.id,
        updated_at: new Date().toISOString(),
      };

      if (!existing) {
        await sb.from('customer_requests').insert({
          ...payload,
          created_by: null,
          source_app: 'lovable',
          received_date: new Date().toISOString().slice(0, 10),
        });
      } else if (existing.status !== 'declined') {
        await sb.from('customer_requests').update(payload).eq('id', existing.id);
      }
    } catch (error) {
      console.warn('[offers] customer_requests sync failed', error);
    }
  };

  const enqueuePipelineJob = async (jobType: string, entityId: string, payload: Record<string, any>) => {
    const sb: any = supabase as any;
    try {
      const { error } = await sb.from('pipeline_jobs').insert({
        job_type: jobType,
        entity_type: 'offer',
        entity_id: entityId,
        company_id: selectedCompanyId,
        source_app: 'lovable',
        status: 'pending',
        priority: 50,
        payload,
      });
      if (error && !isMissingRelationError(error)) {
        throw error;
      }
    } catch (error) {
      console.warn('[offers] pipeline enqueue failed', error);
    }
  };

  const runAnalysis = async () => {
    if (totals.total === 0) {
      toast({ title: isEs ? 'Sin datos de costes' : 'No cost data', description: isEs ? "Aade lneas de coste primero" : 'Add cost lines first', variant: 'destructive' });
      return;
    }
    setAnalyzing(true);
    try {
      const result = await requestOfferAnalysis();
      setAnalysis(result);
      setActiveTab('analysis');
      toast({ title: isEs ? "Anlisis completado" : 'Analysis complete' });
    } catch (e: any) {
      const details = classifyEdgeRuntimeError(e, 'local offer analysis');
      setAnalysis(buildFallbackOfferAnalysis({ totalCost: totals.total, targetMargin, currency }));
      setActiveTab('analysis');
      toast({ title: details.title, description: details.description });
    } finally {
      setAnalyzing(false);
    }
  };

  const buildPersistedOfferPackages = (offerId: string, itemIdMap: Map<string, string>, now: string) => offerPackages
    .map((pkg, index) => ({
      id: pkg.id || crypto.randomUUID(),
      offer_id: offerId,
      package_name: pkg.name || `Package ${index + 1}`,
      package_type: pkg.type,
      item_ids: pkg.itemIds.map((itemId) => itemIdMap.get(itemId)).filter(Boolean),
      executive_summary: pkg.executiveSummary,
      commercial_price: Number(pkg.commercialPrice || 0),
      sort_order: Number(pkg.sortOrder || index + 1),
      created_at: now,
      updated_at: now,
    }))
    .filter((pkg) => pkg.item_ids.length > 0 || pkg.executive_summary || pkg.commercial_price > 0);

  const buildPersistedCommercialTerms = (offerId: string, now: string) => ({
    id: `commercial-${offerId}`,
    offer_id: offerId,
    equipment_incoterm: commercialTerms.equipmentIncoterm,
    incoterm_location: commercialTerms.incotermLocation,
    delivery_months: Number(commercialTerms.deliveryMonths || 0),
    delivery_notes: commercialTerms.deliveryNotes,
    validity_days: Number(commercialTerms.validityDays || 0),
    warranty_months: Number(commercialTerms.warrantyMonths || 0),
    payment_milestones: commercialTerms.paymentMilestones,
    created_at: now,
    updated_at: now,
  });

  // Persists the whole offer (header, items, cost lines, scenarios, scores) in the local workspace,
  // which is the same store the dashboard, KAM and project panels read when Supabase is unavailable.
  // When editing, the previous rows of the same offer are replaced.
  const persistOfferLocally = (analysisToPersist: AnalysisResult | null, header: { title: string; number: string }) => {
    const companyId = selectedCompanyId as string;
    const now = new Date().toISOString();
    const previous = editingOfferId ? readWorkspaceRows<any>('offers', companyId).find((row) => row.id === editingOfferId) : null;
    const offer = {
      id: previous?.id || crypto.randomUUID(),
      company_id: companyId,
      offer_number: header.number,
      title: header.title,
      customer_name: customerName,
      project_description: projectDesc,
      currency,
      status: previous?.status || 'draft',
      contract_value: Math.round(packagePricingOverview.finalOfferPrice),
      total_cost: Math.round(totals.total),
      probability: previous?.probability ?? 50,
      target_margin: targetMargin,
      cost_policy: pricingPolicy,
      document_language: documentLanguage,
      principal_package_price: Math.round(packagePricingOverview.principalPrice),
      principal_package_price_override: principalPackagePriceOverride,
      package_price_sum: Math.round(packagePricingOverview.packagePriceSum),
      offer_total_price_override: offerTotalPriceOverride,
      offer_total_price: Math.round(packagePricingOverview.finalOfferPrice),
      bundle_adjustment: Math.round(packagePricingOverview.globalAdjustment),
      created_at: previous?.created_at || now,
      updated_at: now,
      storage: 'local',
    };
    const offerItems: any[] = [];
    const costRows: any[] = [];
    const itemIdMap = new Map<string, string>();
    items.forEach((item) => {
      const dbItem = { id: crypto.randomUUID(), offer_id: offer.id, item_name: item.name, item_type: item.type, quantity: item.quantity, description: item.description, created_at: now };
      itemIdMap.set(item.id, dbItem.id);
      offerItems.push(dbItem);
      item.costLines.filter((cl) => cl.totalCost > 0).forEach((cl) => costRows.push({
        id: crypto.randomUUID(), offer_item_id: dbItem.id, category: cl.category, line_item: cl.lineItem,
        quantity: cl.quantity, unit_cost: cl.unitCost, total_cost: cl.totalCost, surcharge_pct: cl.surchargePct,
        structure_pct: cl.structurePct, hours: cl.hours, hourly_rate: cl.hourlyRate, days: cl.days, resources: cl.resources,
        notes: cl.notes, installation: cl.installation || null, linked_travel_line_id: cl.linkedTravelLineId || null, created_at: now,
      }));
    });
    const packageRows = buildPersistedOfferPackages(offer.id, itemIdMap, now);
    const commercialTermsRow = buildPersistedCommercialTerms(offer.id, now);
    const oldItemIds = new Set(readWorkspaceRows<any>('offer_items', companyId).filter((row) => row.offer_id === offer.id).map((row) => row.id));
    writeWorkspaceRows('offers', companyId, [offer, ...readWorkspaceRows<any>('offers', companyId).filter((row) => row.id !== offer.id)]);
    writeWorkspaceRows('offer_items', companyId, [...readWorkspaceRows<any>('offer_items', companyId).filter((row) => row.offer_id !== offer.id), ...offerItems]);
    writeWorkspaceRows('cost_breakdowns', companyId, [...readWorkspaceRows<any>('cost_breakdowns', companyId).filter((row) => !oldItemIds.has(row.offer_item_id)), ...costRows]);
    writeWorkspaceRows('offer_packages', companyId, [...readWorkspaceRows<any>('offer_packages', companyId).filter((row) => row.offer_id !== offer.id), ...packageRows]);
    writeWorkspaceRows('offer_commercial_terms', companyId, [...readWorkspaceRows<any>('offer_commercial_terms', companyId).filter((row) => row.offer_id !== offer.id), commercialTermsRow]);
    if (analysisToPersist) {
      writeWorkspaceRows('offer_scenarios', companyId, [
        ...readWorkspaceRows<any>('offer_scenarios', companyId).filter((row) => row.offer_id !== offer.id),
        ...analysisToPersist.scenarios.map((s) => {
          const scenarioPrice = s.type === 'base' ? packagePricingOverview.finalOfferPrice : s.sellingPrice;
          const scenarioMarginAmount = scenarioPrice - s.totalCost;
          const scenarioMarginPct = scenarioPrice > 0 ? scenarioMarginAmount / scenarioPrice * 100 : 0;
          return { id: crypto.randomUUID(), offer_id: offer.id, scenario_type: s.type, total_cost: s.totalCost, selling_price: scenarioPrice, margin_amount: scenarioMarginAmount, margin_pct: scenarioMarginPct, risk_level: s.riskLevel, ai_analysis: { adjustments: s.adjustments }, created_at: now };
        }),
      ]);
      writeWorkspaceRows('offer_scores', companyId, [
        ...readWorkspaceRows<any>('offer_scores', companyId).filter((row) => row.offer_id !== offer.id),
        { id: crypto.randomUUID(), offer_id: offer.id, margin_score: analysisToPersist.scoring.marginScore, risk_score: analysisToPersist.scoring.riskScore, global_score: analysisToPersist.scoring.globalScore, risk_factors: analysisToPersist.riskFactors, recommendations: analysisToPersist.recommendations, ai_explanation: analysisToPersist.scoring.explanation, created_at: now },
      ]);
    }
    setEditingOfferId(offer.id);
    return offer;
  };

  const resetBuilder = () => {
    setEditingOfferId(null);
    setOfferTitle('');
    setCustomerName('');
    setProjectDesc('');
    setCurrency('EUR');
    setTargetMargin(20);
    setPricingPolicy(DEFAULT_INGECART_POLICY);
    setCommercialTerms(buildDefaultCommercialTerms());
    setOfferPackages([]);
    setPrincipalPackagePriceOverride(null);
    setOfferTotalPriceOverride(null);
    setDocumentLanguage('en');
    setAnalysis(null);
    const firstItem: OfferItem = { id: crypto.randomUUID(), name: '', type: 'product', quantity: 1, description: '', costLines: CATEGORIES.map(c => newCostLine(c.value)) };
    setItems([firstItem]);
    setExpandedItems(new Set([firstItem.id]));
    offerNumberIsAuto.current = true;
    setOfferNumber(generateOfferNumber(savedOffers));
    setActiveTab('builder');
    if (selectedCompanyId) localStorage.removeItem(getOfferDraftStorageKey(selectedCompanyId));
  };

  // Rebuilds a builder cost line from a persisted cost_breakdowns row.
  const rowToCostLine = (row: any): CostLine => ({
    id: row.id || crypto.randomUUID(),
    category: row.category,
    lineItem: row.line_item || '',
    quantity: Number(row.quantity ?? 1),
    unitCost: Number(row.unit_cost || 0),
    totalCost: Number(row.total_cost || 0),
    surchargePct: Number(row.surcharge_pct || 0),
    structurePct: Number(row.structure_pct || 0),
    hours: Number(row.hours || 0),
    hourlyRate: Number(row.hourly_rate || 0),
    days: Number(row.days || 0),
    resources: Number(row.resources || 0),
    notes: row.notes || '',
    installation: row.installation || undefined,
    linkedTravelLineId: row.linked_travel_line_id || undefined,
  });

  const getOfferBundle = async (offer: any) => {
    if (!selectedCompanyId) return { offerItems: [], costRows: [], scenarios: [], offerScore: null, offerPackages: [], commercialTerms: buildDefaultCommercialTerms() };
    const localOfferPackages = readWorkspaceRows<any>('offer_packages', selectedCompanyId)
      .filter((row) => row.offer_id === offer.id)
      .map((row, index) => hydrateOfferPackage(row, index + 1));
    const localCommercialTerms = hydrateCommercialTerms(
      readWorkspaceRows<any>('offer_commercial_terms', selectedCompanyId).find((row) => row.offer_id === offer.id) || offer.commercial_terms || null,
    );

    if (isLocalOffer(offer)) {
      const offerItems = readWorkspaceRows<any>('offer_items', selectedCompanyId).filter((row) => row.offer_id === offer.id);
      const itemIds = new Set(offerItems.map((row) => row.id));
      return {
        offerItems,
        costRows: readWorkspaceRows<any>('cost_breakdowns', selectedCompanyId).filter((row) => itemIds.has(row.offer_item_id)),
        scenarios: readWorkspaceRows<any>('offer_scenarios', selectedCompanyId).filter((row) => row.offer_id === offer.id),
        offerScore: readWorkspaceRows<any>('offer_scores', selectedCompanyId).find((row) => row.offer_id === offer.id) || null,
        offerPackages: localOfferPackages,
        commercialTerms: localCommercialTerms,
      };
    }

    const { data: remoteItems } = await supabase.from('offer_items').select('*').eq('offer_id', offer.id);
    const offerItems = remoteItems || [];
    const itemIds = offerItems.map((row: any) => row.id);
    const [costsRes, scenariosRes, scoreRes] = await Promise.all([
      itemIds.length > 0 ? supabase.from('cost_breakdowns').select('*').in('offer_item_id', itemIds) : Promise.resolve({ data: [] }),
      supabase.from('offer_scenarios').select('*').eq('offer_id', offer.id),
      supabase.from('offer_scores').select('*').eq('offer_id', offer.id).maybeSingle(),
    ]);
    return {
      offerItems,
      costRows: costsRes.data || [],
      scenarios: scenariosRes.data || [],
      offerScore: scoreRes.data || null,
      offerPackages: localOfferPackages,
      commercialTerms: localCommercialTerms,
    };
  };
  // Loads a saved offer (local or remote) back into the builder for editing.
  const loadOfferForEditing = async (offer: any) => {
    if (!selectedCompanyId) return;
    const bundle = await getOfferBundle(offer);
    const builtItems: OfferItem[] = bundle.offerItems.map((row) => {
      const lines = bundle.costRows.filter((cost) => cost.offer_item_id === row.id).map(rowToCostLine);
      const present = new Set(lines.map((line) => line.category));
      return {
        id: row.id || crypto.randomUUID(),
        name: row.item_name || '',
        type: (row.item_type || 'product') as OfferItem['type'],
        quantity: Number(row.quantity || 1),
        description: row.description || '',
        // Keep one empty line per missing category so every family stays editable.
        costLines: [...lines, ...CATEGORIES.filter((c) => !present.has(c.value)).map((c) => newCostLine(c.value))],
      };
    });
    const fallbackItem: OfferItem = { id: crypto.randomUUID(), name: '', type: 'product', quantity: 1, description: '', costLines: CATEGORIES.map(c => newCostLine(c.value)) };
    const nextItems = builtItems.length > 0 ? builtItems : [fallbackItem];
    setEditingOfferId(offer.id);
    setOfferTitle(offer.title || '');
    offerNumberIsAuto.current = false;
    setOfferNumber(offer.offer_number || '');
    setCustomerName(offer.customer_name || '');
    setCustomerMode('existing');
    setProjectDesc(offer.project_description || '');
    setCurrency(offer.currency || 'EUR');
    if (offer.target_margin !== undefined && offer.target_margin !== null) setTargetMargin(Number(offer.target_margin));
    if (offer.cost_policy) setPricingPolicy({ ...DEFAULT_INGECART_POLICY, ...offer.cost_policy });
    setDocumentLanguage(offer.document_language === 'es' ? 'es' : 'en');
    setCommercialTerms(bundle.commercialTerms || buildDefaultCommercialTerms());
    setOfferPackages(bundle.offerPackages || []);
    setPrincipalPackagePriceOverride(parseOptionalNumber(offer.principal_package_price_override));
    setOfferTotalPriceOverride(parseOptionalNumber(offer.offer_total_price_override));
    setAnalysis(null);
    setItems(nextItems);
    setExpandedItems(new Set(nextItems.map((item) => item.id)));
    setActiveTab('builder');
    toast({ title: isEs ? "Oferta cargada para edicin" : 'Offer loaded for editing', description: `${offer.offer_number || ''} ${offer.title || ''}`.trim() });
  };

  const exportOfferToWord = async (offer: any, languageOverride?: OfferDocumentLanguage) => {
    setExportingOfferId(offer.id);
    try {
      const bundle = await getOfferBundle(offer);
      const exportLanguage = languageOverride || (offer.document_language === 'es' ? 'es' : offer.document_language === 'en' ? 'en' : documentLanguage);
      const fileName = await downloadOfferWordDocument({
        offer,
        items: bundle.offerItems,
        costRows: bundle.costRows,
        scenarios: bundle.scenarios,
        offerScore: bundle.offerScore,
        company: data.companyProfile,
        products: data.products,
        pricingPolicy: offer.cost_policy || pricingPolicy,
        packages: bundle.offerPackages || [],
        commercialTerms: bundle.commercialTerms || buildDefaultCommercialTerms(),
        language: exportLanguage,
      });
      registerOfferDocument(offer, exportLanguage, fileName, 'generated');
      toast({
        title: isEs ? 'Word generado' : 'Word generated',
        description: [offer.offer_number || '', offer.title || ''].join(' ').trim() + ' - ' + (exportLanguage === 'es' ? (isEs ? 'castellano' : 'Spanish') : (isEs ? 'ingles' : 'English')),
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || String(error), variant: 'destructive' });
    } finally {
      setExportingOfferId(null);
    }
  };
  // Remote update: refresh the header and replace items/cost lines.
  const updateRemoteOffer = async (header: { title: string; number: string }) => {
    const offerId = editingOfferId as string;
    const { data: updated, error } = await supabase.from('offers').update({
      offer_number: header.number, title: header.title, customer_name: customerName,
      project_description: projectDesc, currency, updated_at: new Date().toISOString(),
    }).eq('id', offerId).select().single();
    if (error) throw error;
    const { data: oldItems } = await supabase.from('offer_items').select('id').eq('offer_id', offerId);
    const oldIds = (oldItems || []).map((row: any) => row.id);
    if (oldIds.length > 0) {
      await supabase.from('cost_breakdowns').delete().in('offer_item_id', oldIds);
      await supabase.from('offer_items').delete().eq('offer_id', offerId);
    }
    await supabase.from('offer_scenarios').delete().eq('offer_id', offerId);
    await supabase.from('offer_scores').delete().eq('offer_id', offerId);
    return updated;
  };

  const saveOffer = async () => {
    if (!selectedCompanyId) {
      toast({ title: isEs ? 'Seleccione empresa' : 'Select a company', variant: 'destructive' });
      return;
    }
    if (!customerName.trim()) {
      toast({ title: isEs ? 'Cliente requerido' : 'Customer required', description: isEs ? 'Selecciona un cliente existente o crea uno nuevo.' : 'Pick an existing customer or create a new one.', variant: 'destructive' });
      return;
    }
    const firstItem = items.find((item) => item.name.trim())?.name;
    const resolvedTitle = offerTitle.trim() || `${customerName} - ${firstItem || (isEs ? 'Oferta' : 'Offer')}`;
    const resolvedNumber = offerNumber.trim() || generateOfferNumber(savedOffers);
    if (resolvedTitle !== offerTitle) setOfferTitle(resolvedTitle);
    if (resolvedNumber !== offerNumber) setOfferNumber(resolvedNumber);
    const header = { title: resolvedTitle, number: resolvedNumber };
    setSaving(true);
    try {
      let analysisToPersist = analysis;
      if (!analysisToPersist && totals.total > 0) {
        try {
          analysisToPersist = await requestOfferAnalysis();
          setAnalysis(analysisToPersist);
        } catch {
          analysisToPersist = buildFallbackOfferAnalysis({ totalCost: totals.total, targetMargin, currency }) as AnalysisResult;
          setAnalysis(analysisToPersist);
        }
      }

      if (!isWorkspaceSupabaseConfigured) {
        const offer = persistOfferLocally(analysisToPersist, header);
        toast({ title: isEs ? 'Oferta guardada' : 'Offer saved', description: `${offer.offer_number}  ${isEs ? 'guardada en el espacio de trabajo local de la empresa' : 'stored in the company local workspace'}` });
        loadOffers();
        return;
      }

      let offer: any;
      const editingLocal = editingOfferId ? savedOffers.find((row) => row.id === editingOfferId)?.storage === 'local' : false;
      try {
        if (editingOfferId && editingLocal) {
          offer = persistOfferLocally(analysisToPersist, header);
          toast({ title: isEs ? 'Oferta actualizada' : 'Offer updated', description: offer.offer_number });
          loadOffers();
          return;
        }
        if (editingOfferId) {
          offer = await updateRemoteOffer(header);
        } else {
          const { data: inserted, error: offerErr } = await supabase.from('offers').insert({
            company_id: selectedCompanyId, offer_number: header.number, title: header.title,
            customer_name: customerName, project_description: projectDesc, currency, status: 'draft',
          }).select().single();
          if (offerErr) throw offerErr;
          offer = inserted;
        }
      } catch (remoteError: any) {
        // Remote store unavailable: never lose the offer, fall back to the local workspace.
        console.warn('[offers] remote save failed, persisting locally', remoteError);
        offer = persistOfferLocally(analysisToPersist, header);
        toast({ title: isEs ? 'Oferta guardada localmente' : 'Offer saved locally', description: isEs ? "Supabase no respondi; la oferta se guard en el espacio de trabajo local." : 'Supabase did not respond; the offer was stored in the local workspace.' });
        loadOffers();
        return;
      }

      const cachedWorkspaceOffer = {
        ...offer,
        company_id: selectedCompanyId,
        offer_number: header.number,
        title: header.title,
        customer_name: customerName,
        project_description: projectDesc,
        currency,
        status: offer.status || 'draft',
        contract_value: Math.round(packagePricingOverview.finalOfferPrice),
        total_cost: Math.round(totals.total),
        probability: offer.probability ?? 50,
        target_margin: targetMargin,
        cost_policy: pricingPolicy,
        document_language: documentLanguage,
        principal_package_price: Math.round(packagePricingOverview.principalPrice),
        principal_package_price_override: principalPackagePriceOverride,
        package_price_sum: Math.round(packagePricingOverview.packagePriceSum),
        offer_total_price_override: offerTotalPriceOverride,
        offer_total_price: Math.round(packagePricingOverview.finalOfferPrice),
        bundle_adjustment: Math.round(packagePricingOverview.globalAdjustment),
        created_at: offer.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      writeWorkspaceRows('offers', selectedCompanyId, [cachedWorkspaceOffer, ...readWorkspaceRows<any>('offers', selectedCompanyId).filter((row) => row.id !== offer.id)]);

      const itemIdMap = new Map<string, string>();
      for (const item of items) {
        const { data: dbItem, error: itemErr } = await supabase.from('offer_items').insert({
          offer_id: offer.id, item_name: item.name, item_type: item.type,
          quantity: item.quantity, description: item.description,
        }).select().single();
        if (itemErr) throw itemErr;
        itemIdMap.set(item.id, dbItem.id);

        const costRows = item.costLines.filter(cl => cl.totalCost > 0).map(cl => ({
          offer_item_id: dbItem.id, category: cl.category, line_item: cl.lineItem,
          quantity: cl.quantity, unit_cost: cl.unitCost, total_cost: cl.totalCost,
          surcharge_pct: cl.surchargePct, hours: cl.hours, hourly_rate: cl.hourlyRate,
          days: cl.days, resources: cl.resources,
          // cost_breakdowns has no dedicated column yet; keep the overhead traceable in notes.
          notes: cl.structurePct ? [cl.notes, 'Structure overhead ' + cl.structurePct + '%'].filter(Boolean).join(' | ') : cl.notes,
        }));
        if (costRows.length > 0) {
          const { error: costErr } = await supabase.from('cost_breakdowns').insert(costRows);
          if (costErr) throw costErr;
        }
      }
      const now = new Date().toISOString();
      writeWorkspaceRows('offer_packages', selectedCompanyId, [...readWorkspaceRows<any>('offer_packages', selectedCompanyId).filter((row) => row.offer_id !== offer.id), ...buildPersistedOfferPackages(offer.id, itemIdMap, now)]);
      writeWorkspaceRows('offer_commercial_terms', selectedCompanyId, [...readWorkspaceRows<any>('offer_commercial_terms', selectedCompanyId).filter((row) => row.offer_id !== offer.id), buildPersistedCommercialTerms(offer.id, now)]);

      if (analysisToPersist) {
        for (const s of analysisToPersist.scenarios) {
          await supabase.from('offer_scenarios').insert({
            offer_id: offer.id, scenario_type: s.type, total_cost: s.totalCost,
            selling_price: s.type === 'base' ? packagePricingOverview.finalOfferPrice : s.sellingPrice,
            margin_amount: (s.type === 'base' ? packagePricingOverview.finalOfferPrice : s.sellingPrice) - s.totalCost,
            margin_pct: (s.type === 'base' ? packagePricingOverview.finalOfferPrice : s.sellingPrice) > 0 ? (((s.type === 'base' ? packagePricingOverview.finalOfferPrice : s.sellingPrice) - s.totalCost) / (s.type === 'base' ? packagePricingOverview.finalOfferPrice : s.sellingPrice)) * 100 : 0,
            risk_level: s.riskLevel, ai_analysis: { adjustments: s.adjustments },
          });
        }
        await supabase.from('offer_scores').insert({
          offer_id: offer.id, margin_score: analysisToPersist.scoring.marginScore,
          risk_score: analysisToPersist.scoring.riskScore, global_score: analysisToPersist.scoring.globalScore,
          risk_factors: analysisToPersist.riskFactors, recommendations: analysisToPersist.recommendations,
          ai_explanation: analysisToPersist.scoring.explanation,
        });
      }

      await syncRequestFromOffer(offer);
      await enqueuePipelineJob('offer_saved', offer.id, {
        offer_number: offer.offer_number || '',
        status: offer.status || 'draft',
        has_analysis: Boolean(analysisToPersist),
      });

      toast({ title: isEs ? 'Oferta guardada' : 'Offer saved' });
      loadOffers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const [convertingId, setConvertingId] = useState<string | null>(null);

  const isLocalOffer = (offer: any) => offer?.storage === 'local' || !isWorkspaceSupabaseConfigured;

  const updateOfferStatus = async (offerId: string, status: string) => {
    const target = savedOffers.find((offer) => offer.id === offerId);
    if (isLocalOffer(target)) {
      writeWorkspaceRows('offers', selectedCompanyId, readWorkspaceRows<any>('offers', selectedCompanyId).map((offer) => (offer.id === offerId ? { ...offer, status, updated_at: new Date().toISOString() } : offer)));
      loadOffers();
      return;
    }
    await supabase.from('offers').update({ status }).eq('id', offerId);
    await enqueuePipelineJob('offer_status_changed', offerId, { status });
    loadOffers();
  };

  const convertLocalOfferToProject = (offer: any) => {
    const companyId = selectedCompanyId as string;
    const now = new Date().toISOString();
    writeWorkspaceRows('offers', companyId, readWorkspaceRows<any>('offers', companyId).map((row) => (row.id === offer.id ? { ...row, status: 'won', updated_at: now } : row)));
    const itemIds = readWorkspaceRows<any>('offer_items', companyId).filter((row) => row.offer_id === offer.id).map((row) => row.id);
    const costBreakdowns = readWorkspaceRows<any>('cost_breakdowns', companyId).filter((row) => itemIds.includes(row.offer_item_id));
    const scenarios = readWorkspaceRows<any>('offer_scenarios', companyId).filter((row) => row.offer_id === offer.id);
    const baseScenario = scenarios.find((s) => s.scenario_type === 'base') || scenarios[0];
    const projectNumber = `PRJ-${offer.offer_number || Date.now()}`;
    const project = {
      id: crypto.randomUUID(), company_id: companyId, offer_id: offer.id, project_number: projectNumber,
      title: offer.title || 'New Project', customer_name: offer.customer_name || '', project_type: 'machine', complexity: 'medium', risk_level: 'medium',
      contract_value: baseScenario?.selling_price || offer.contract_value || 0, margin_target: baseScenario?.margin_pct || offer.target_margin || 0,
      total_budget: baseScenario?.total_cost || offer.total_cost || 0, scope_of_supply: offer.project_description || '', currency: offer.currency || 'EUR',
      notes: `Auto-created from offer ${offer.offer_number}.`, status: 'planning', created_at: now, updated_at: now,
    };
    writeWorkspaceRows('projects', companyId, [project, ...readWorkspaceRows<any>('projects', companyId)]);
    if (costBreakdowns.length > 0) {
      const costsByCategory: Record<string, number> = {};
      costBreakdowns.forEach((c) => { costsByCategory[c.category] = (costsByCategory[c.category] || 0) + (c.total_cost || 0); });
      const rows = Object.entries(costsByCategory).map(([category, amount]) => ({
        id: crypto.randomUUID(), project_id: project.id,
        category: category === 'materials' ? 'procurement' : category === 'transport' ? 'travel' : category === 'indirect' ? 'overhead' : category,
        line_item: `From offer: ${category}`, budget_amount: amount, actual_amount: 0, created_at: now,
      }));
      writeWorkspaceRows('project_costs', companyId, [...readWorkspaceRows<any>('project_costs', companyId), ...rows]);
    }
    return projectNumber;
  };

  const convertToProject = async (offer: any) => {
    if (!selectedCompanyId) return;
    setConvertingId(offer.id);
    try {
      if (isLocalOffer(offer)) {
        const projectNumber = convertLocalOfferToProject(offer);
        loadOffers();
        toast({ title: isEs ? 'Proyecto creado' : 'Project Created', description: isEs ? `Proyecto ${projectNumber} creado desde oferta. Redirigiendo...` : `Project ${projectNumber} created from offer. Redirecting...` });
        setTimeout(() => navigate('/project-management'), 1000);
        return;
      }
      // Mark offer as won
      await supabase.from('offers').update({ status: 'won' }).eq('id', offer.id);
      await enqueuePipelineJob('offer_status_changed', offer.id, { status: 'won' });

      // Load offer items & costs for budget breakdown
      const { data: offerItems } = await supabase.from('offer_items').select('*').eq('offer_id', offer.id);
      const itemIds = (offerItems || []).map((i: any) => i.id);
      let costBreakdowns: any[] = [];
      if (itemIds.length > 0) {
        const { data } = await supabase.from('cost_breakdowns').select('*').in('offer_item_id', itemIds);
        costBreakdowns = data || [];
      }

      // Load scenarios for contract value
      const { data: scenarios } = await supabase.from('offer_scenarios').select('*').eq('offer_id', offer.id);
      const baseScenario = (scenarios || []).find((s: any) => s.scenario_type === 'base') || (scenarios || [])[0];

      const contractValue = baseScenario?.selling_price || 0;
      const marginTarget = baseScenario?.margin_pct || 0;

      // Create project
      const projectNumber = `PRJ-${offer.offer_number || new Date().getTime()}`;
      const { data: project, error } = await supabase.from('projects').insert({
        company_id: selectedCompanyId,
        offer_id: offer.id,
        project_number: projectNumber,
        title: offer.title || 'New Project',
        customer_name: offer.customer_name || '',
        project_type: 'machine',
        complexity: 'medium',
        risk_level: 'medium',
        contract_value: contractValue,
        margin_target: marginTarget,
        total_budget: baseScenario?.total_cost || 0,
        scope_of_supply: offer.project_description || '',
        currency: offer.currency || 'EUR',
        notes: `Auto-created from offer ${offer.offer_number}. ${offer.notes || ''}`,
        status: 'planning',
      }).select().single();

      if (error) throw error;

      // Create initial cost breakdown from offer costs
      if (costBreakdowns.length > 0) {
        const costsByCategory: Record<string, number> = {};
        costBreakdowns.forEach((c: any) => {
          costsByCategory[c.category] = (costsByCategory[c.category] || 0) + (c.total_cost || 0);
        });
        const projectCostRows = Object.entries(costsByCategory).map(([category, amount]) => ({
          project_id: project.id,
          category: category === 'materials' ? 'procurement' : category === 'transport' ? 'travel' : category === 'indirect' ? 'overhead' : category,
          line_item: `From offer: ${category}`,
          budget_amount: amount,
        }));
        await supabase.from('project_costs').insert(projectCostRows);
      }

      loadOffers();
      toast({
        title: isEs ? 'Proyecto creado' : 'Project Created',
        description: isEs ? `Proyecto ${projectNumber} creado desde oferta. Redirigiendo...` : `Project ${projectNumber} created from offer. Redirecting...`,
      });

      setTimeout(() => navigate('/project-management'), 1000);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setConvertingId(null);
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
            {isEs ? "Analiza costes, simula escenarios, evala riesgos y optimiza precios con IA" : 'Analyze costs, simulate scenarios, evaluate risks and optimize pricing with AI'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={saveOffer} disabled={saving || !selectedCompanyId} title={!customerName ? (isEs ? 'Selecciona o crea un cliente para guardar' : 'Select or create a customer to save') : undefined}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {editingOfferId ? (isEs ? 'Actualizar' : 'Update') : (isEs ? 'Guardar' : 'Save')}
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
          <TabsTrigger value="analysis">{isEs ? "Anlisis" : 'Analysis'}</TabsTrigger>
          <TabsTrigger value="history">{isEs ? 'Historial' : 'History'}</TabsTrigger>
          <TabsTrigger value="summary">{isEs ? 'Resumen' : 'Summary'}</TabsTrigger>
        </TabsList>

        {/* BUILDER TAB */}
        <TabsContent value="builder" className="space-y-4">
          {/* Offer header */}
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">{isEs ? 'Datos de la Oferta' : 'Offer Details'}</CardTitle>
              {editingOfferId ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{isEs ? 'Editando' : 'Editing'} {offerNumber}</Badge>
                  <Button size="sm" variant="ghost" onClick={resetBuilder}><Plus className="h-3 w-3 mr-1" />{isEs ? 'Nueva oferta' : 'New offer'}</Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">{isEs ? "Ttulo" : 'Title'}</label>
                <Input value={offerTitle} onChange={e => setOfferTitle(e.target.value)} placeholder={isEs ? "Ej: Lnea de ensamblaje" : 'E.g: Assembly line'} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{isEs ? "N Oferta" : 'Offer #'}</label>
                <div className="flex gap-1">
                  <Input value={offerNumber} onChange={e => editOfferNumber(e.target.value)} placeholder="OFF-2026-001" />
                  <Button variant="outline" size="icon" title={isEs ? "Generar siguiente nmero" : 'Generate next number'} onClick={() => { offerNumberIsAuto.current = true; setOfferNumber(generateOfferNumber(savedOffers)); }}>
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{isEs ? "Generado automticamente; editable." : 'Auto-generated; editable.'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{isEs ? 'Cliente' : 'Customer'}</label>
                {customerMode === 'existing' ? (
                  <div className="flex gap-1">
                    <Select value={customerName || '__none__'} onValueChange={(value) => { if (value === '__new__') { setCustomerMode('new'); } else { setCustomerName(value === '__none__' ? '' : value); } }}>
                      <SelectTrigger aria-label={isEs ? 'Seleccionar cliente' : 'Select customer'}><SelectValue placeholder={isEs ? 'Selecciona un cliente' : 'Select a customer'} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{isEs ? " Sin cliente " : " No customer "}</SelectItem>
                        {customerName && !knownCustomers.includes(customerName) ? <SelectItem value={customerName}>{customerName}</SelectItem> : null}
                        {knownCustomers.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                        <SelectItem value="__new__">{isEs ? '+ Crear cliente nuevo' : '+ Create new customer'}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" title={isEs ? 'Crear cliente nuevo' : 'Create new customer'} onClick={() => setCustomerMode('new')}><Plus className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="space-y-1 rounded-md border p-2 bg-muted/20">
                    <Input className="h-8" aria-label={isEs ? 'Nombre del cliente' : 'Customer name'} placeholder={isEs ? 'Nombre del cliente *' : 'Customer name *'} value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-1">
                      <Input className="h-8" placeholder={isEs ? "Pas" : 'Country'} value={newCustomer.country} onChange={(e) => setNewCustomer({ ...newCustomer, country: e.target.value })} />
                      <Input className="h-8" placeholder={isEs ? 'Contacto' : 'Contact person'} value={newCustomer.contactName} onChange={(e) => setNewCustomer({ ...newCustomer, contactName: e.target.value })} />
                    </div>
                    <Input className="h-8" type="email" placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCustomerMode('existing')}>{isEs ? 'Cancelar' : 'Cancel'}</Button>
                      <Button size="sm" className="h-7 text-xs" onClick={createCustomer}>{isEs ? 'Crear y usar' : 'Create & use'}</Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">{isEs ? "Descripcin del proyecto" : 'Project Description'}</label>
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
              <div>
                <label className="text-sm font-medium text-foreground">{isEs ? 'Idioma Word' : 'Word language'}</label>
                <Select value={documentLanguage} onValueChange={(value) => setDocumentLanguage(value as OfferDocumentLanguage)}>
                  <SelectTrigger aria-label={isEs ? 'Idioma del documento' : 'Document language'}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Castellano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{isEs ? "Poltica de costes y plantilla" : 'Cost policy & template'}</CardTitle>
              <CardDescription>{isEs ? "Porcentajes editables que se aaden al coste directo. La garanta se aplica a Comercio, Ingeniera y Subcontratas; estructura de materiales solo a Comercio; financiacin y gestin comercial al coste directo total." : 'Editable percentages added on top of the direct cost. Warranty applies to Comercio, Engineering and Subcontratas; material structure only to Comercio; finance and commercial management to the total direct cost.'}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {([
                { field: 'warrantyPct', label: isEs ? "Garanta %" : 'Warranty %', charge: totals.policyCharges.warranty, scope: isEs ? "Comercio + Ingeniera + Subcontratas" : 'Comercio + Engineering + Subcontratas' },
                { field: 'financialPct', label: isEs ? "Financiacin %" : 'Finance %', charge: totals.policyCharges.financial, scope: isEs ? 'Coste directo' : 'Direct cost' },
                { field: 'commercialMgmtPct', label: isEs ? "Gestin comercial %" : 'Commercial mgmt. %', charge: totals.policyCharges.commercialMgmt, scope: isEs ? 'Coste directo' : 'Direct cost' },
                { field: 'materialStructurePct', label: isEs ? 'Estructura materiales %' : 'Material structure %', charge: totals.policyCharges.materialStructure, scope: 'Comercio' },
              ] as const).map((entry) => (
                <div key={entry.field} className="rounded-md border bg-muted/20 p-3 space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor={`policy-${entry.field}`}>{entry.label}</label>
                  <Input id={`policy-${entry.field}`} type="number" step="0.5" min="0" className="h-8" value={pricingPolicy[entry.field]} onChange={(e) => updatePolicyPct(entry.field, e.target.value)} />
                  <div className="text-[11px] text-muted-foreground">{entry.scope}  <span className="font-medium text-foreground">{fmt(entry.charge)}</span></div>
                </div>
              ))}
              <div className="md:col-span-4 flex justify-end">
                <Button variant="outline" onClick={applyIngecartOfferTemplate}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  {isEs ? 'Usar plantilla Ingecart' : 'Use Ingecart template'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <OfferCommercialTermsEditor isEs={isEs} terms={commercialTerms} onChange={setCommercialTerms} />

          {data.products.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{isEs ? "Catlogo de productos y servicios" : 'Product & service catalog'}</CardTitle>
                <CardDescription>{isEs ? "Selecciona un elemento validado para aadirlo a la oferta." : 'Select a validated catalog item and add it to this offer.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col md:flex-row gap-2">
                  <Select value={catalogSelection} onValueChange={setCatalogSelection}>
                    <SelectTrigger className="md:flex-1">
                      <SelectValue placeholder={isEs ? "Seleccionar del catlogo" : 'Select from catalog'} />
                    </SelectTrigger>
                    <SelectContent>
                      {data.products
                        .filter((product) => product.name && (product.validated ?? true))
                        .map((product) => (
                          <SelectItem key={`${product.name}-${product.type}`} value={product.name}>
                            {product.name} - {(product.category || 'product')}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={addCatalogItem} disabled={!catalogSelection}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isEs ? "Aadir del catlogo" : 'Add from catalog'}
                  </Button>
                </div>
                {selectedCatalogProduct ? (
                  <div className="grid gap-3 md:grid-cols-3 rounded-lg border bg-muted/20 p-3 text-sm">
                    <div>
                      <p className="font-medium">{selectedCatalogProduct.name}</p>
                      <p className="text-muted-foreground mt-1">{selectedCatalogProduct.comments || (isEs ? 'Producto canonizado para costes reutilizables.' : 'Canonical product profile for reusable costs.')}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">{isEs ? 'Longitud de referencia (m)' : 'Reference length (m)'}</label>
                      <Input type="number" min={1} value={catalogLengthM} onChange={e => setCatalogLengthM(Number(e.target.value || selectedCatalogProduct.defaultLengthM || 80))} disabled={!selectedCatalogProduct.configurableByLength} />
                      <p className="text-xs text-muted-foreground">{selectedCatalogProduct.configurableByLength ? (isEs ? "Este producto ajusta materiales segn la longitud seleccionada." : 'This product scales material costs with the selected length.') : (isEs ? 'Producto con preset fijo de costes.' : 'Product with fixed cost preset.')}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">{isEs ? 'Opciones de preset' : 'Preset options'}</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={catalogIncludeInstallation} onChange={e => setCatalogIncludeInstallation(e.target.checked)} />{isEs ? "Incluir instalacin" : 'Include installation'}</label>
                      <p className="text-xs text-muted-foreground">{isEs ? "Al aadir el producto se cargarn sus lneas de coste reutilizables en la oferta." : 'Adding the product loads its reusable cost lines into the offer.'}</p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

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
                      <label className="text-xs font-medium text-foreground">{isEs ? "Descripcin" : 'Description'}</label>
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
                            <Plus className="h-3 w-3 mr-1" />{isEs ? "Aadir" : 'Add'}
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
                                      <TableHead>{isEs ? "/h" : "/h"}</TableHead>
                                    </>
                                  ) : cat.value === 'installation' ? (
                                    <>
                                      <TableHead>{isEs ? "Das" : 'Days'}</TableHead>
                                      <TableHead>{isEs ? 'Recursos' : 'Resources'}</TableHead>
                                      <TableHead>{isEs ? "Coste/da" : 'Cost/day'}</TableHead>
                                      <TableHead>{isEs ? 'Recargo %' : 'Surcharge %'}</TableHead>
                                    </>
                                  ) : (
                                    <>
                                      <TableHead>{isEs ? 'Cant.' : 'Qty'}</TableHead>
                                      <TableHead>{isEs ? 'Coste ud.' : 'Unit Cost'}</TableHead>
                                      <TableHead>{isEs ? 'Recargo %' : 'Surcharge %'}</TableHead>
                                    </>
                                  )}
                                  <TableHead title={isEs ? "Cargo de gestin de estructura interna" : 'Internal structure management overhead'}>{isEs ? 'Estructura %' : 'Structure %'}</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead className="w-[40px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {lines.map(cl => (
                                  <React.Fragment key={cl.id}>
                                  <TableRow>
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
                                        <TableCell><Input className="h-8 text-xs w-16" type="number" value={cl.days} disabled={Boolean(cl.installation)} onChange={e => updateCostLine(item.id, cl.id, 'days', Number(e.target.value))} /></TableCell>
                                        <TableCell><Input className="h-8 text-xs w-16" type="number" value={cl.resources} disabled={Boolean(cl.installation)} onChange={e => updateCostLine(item.id, cl.id, 'resources', Number(e.target.value))} /></TableCell>
                                        <TableCell><Input className="h-8 text-xs w-20" type="number" value={cl.unitCost} disabled={Boolean(cl.installation)} onChange={e => updateCostLine(item.id, cl.id, 'unitCost', Number(e.target.value))} /></TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1">
                                            <Input className="h-8 text-xs w-16" type="number" value={cl.surchargePct} disabled={Boolean(cl.installation)} onChange={e => updateCostLine(item.id, cl.id, 'surchargePct', Number(e.target.value))} />
                                            <Button
                                              variant={cl.installation ? 'secondary' : 'outline'}
                                              size="sm"
                                              className="h-8 text-xs whitespace-nowrap"
                                              title={isEs ? "Planificar mano de obra, dietas y viticos" : 'Plan labour, per diem and travel expenses'}
                                              onClick={() => {
                                                if (!cl.installation) applyInstallationPlan(item.id, cl.id, createInstallationPlan({ days: cl.days || 1, resources: cl.resources || 1 }));
                                                setPlannerLineId(plannerLineId === cl.id ? null : cl.id);
                                              }}
                                            >
                                              <Settings2 className="h-3 w-3 mr-1" />{isEs ? 'Planificar' : 'Planner'}
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </>
                                    ) : (
                                      <>
                                        <TableCell><Input className="h-8 text-xs w-16" type="number" aria-label={`Quantity ${cat.value} ${cl.id}`} value={cl.quantity} onChange={e => updateCostLine(item.id, cl.id, 'quantity', Number(e.target.value))} /></TableCell>
                                        <TableCell><Input className="h-8 text-xs w-24" type="number" aria-label={`Unit cost ${cat.value} ${cl.id}`} value={cl.unitCost} onChange={e => updateCostLine(item.id, cl.id, 'unitCost', Number(e.target.value))} /></TableCell>
                                        <TableCell><Input className="h-8 text-xs w-16" type="number" value={cl.surchargePct} onChange={e => updateCostLine(item.id, cl.id, 'surchargePct', Number(e.target.value))} /></TableCell>
                                      </>
                                    )}
                                    <TableCell><Input className="h-8 text-xs w-16" type="number" step="0.5" aria-label={`Structure overhead ${cl.lineItem || cl.id}`} value={cl.structurePct} onChange={e => updateCostLine(item.id, cl.id, 'structurePct', Number(e.target.value))} /></TableCell>
                                    <TableCell className="text-right font-medium">{fmt(cl.totalCost)}</TableCell>
                                    <TableCell>
                                      <Button variant="ghost" size="sm" onClick={() => removeCostLine(item.id, cl.id)}>
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                  {cat.value === 'installation' && cl.installation && plannerLineId === cl.id ? (
                                    <TableRow>
                                      <TableCell colSpan={8} className="bg-muted/20">
                                        <div className="space-y-2">
                                          <InstallationPlanner
                                            idPrefix={`offer-${cl.id}`}
                                            plan={cl.installation}
                                            policy={pricingPolicy}
                                            onChange={(plan) => applyInstallationPlan(item.id, cl.id, plan)}
                                          />
                                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                            <span>{isEs ? "La mano de obra queda en esta lnea; los viticos se cargan en la lnea vinculada de Transporte y Logstica." : 'Labour stays on this line; travel & expenses are carried by the linked Transport & Logistics line.'}</span>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { applyInstallationPlan(item.id, cl.id, null); setPlannerLineId(null); }}>
                                              {isEs ? 'Quitar plan detallado' : 'Remove detailed plan'}
                                            </Button>
                                          </div>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ) : null}
                                  </React.Fragment>
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
            {isEs ? "Aadir Producto/Servicio" : 'Add Product/Service'}
          </Button>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{isEs ? 'Resumen de costes por elemento' : 'Cost summary by configured element'}</CardTitle>
              <CardDescription>{isEs ? 'Cada linea resume los costes agregados por elemento de oferta, incluyendo materiales, horas de ingenieria e instalacion.' : 'Each row summarizes the aggregated cost basis by offer element, including material, engineering and installation effort.'}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEs ? 'Elemento' : 'Element'}</TableHead>
                    <TableHead>{isEs ? 'Cant.' : 'Qty'}</TableHead>
                    <TableHead className="text-right">Comercio</TableHead>
                    <TableHead className="text-right">Engineering</TableHead>
                    <TableHead className="text-right">Subcontratas</TableHead>
                    <TableHead className="text-right">Installation</TableHead>
                    <TableHead className="text-right">Transport</TableHead>
                    <TableHead className="text-right">{isEs ? 'Otros' : 'Others'}</TableHead>
                    <TableHead>{isEs ? 'Esfuerzo' : 'Effort'}</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemSummaryRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell className="text-right">{fmt(row.categoryTotals.materials || 0)}</TableCell>
                      <TableCell className="text-right">{fmt(row.categoryTotals.engineering || 0)}</TableCell>
                      <TableCell className="text-right">{fmt(row.categoryTotals.subcontracting || 0)}</TableCell>
                      <TableCell className="text-right">{fmt(row.categoryTotals.installation || 0)}</TableCell>
                      <TableCell className="text-right">{fmt(row.categoryTotals.transport || 0)}</TableCell>
                      <TableCell className="text-right">{fmt(row.categoryTotals.indirect || 0)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{[row.engineeringHours ? row.engineeringHours + ' h eng.' : '', row.installationDays ? row.installationDays + ' tech-day inst.' : ''].filter(Boolean).join(' | ') || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(row.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <OfferPackagePlanner isEs={isEs} currency={currency} pricingPolicy={pricingPolicy} items={items.map((item) => ({ id: item.id, name: item.name, description: item.description, quantity: item.quantity }))} costRows={builderCostRows} packages={offerPackages} onChange={setOfferPackages} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{isEs ? 'Pricing por paquetes de oferta' : 'Offer package pricing model'}</CardTitle>
              <CardDescription>{isEs ? 'El paquete principal se calcula como total de oferta menos los paquetes adicionales. El total final parte de la suma de paquetes y puede editarse para aplicar descuento global.' : 'The principal package is computed as total offer minus additional packages. Final offer price defaults to package sum and can be edited for a global bundle discount.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{isEs ? 'Principal - coste total' : 'Principal - total cost'}</p>
                  <p className="text-lg font-semibold">{fmt(packagePricingOverview.principalCost)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">{isEs ? 'Principal - precio' : 'Principal - price'}</label>
                  <div className="flex gap-2">
                    <Input type="number" min="0" value={Math.round(packagePricingOverview.principalPrice)} onChange={(event) => setPrincipalPackagePriceOverride(Number(event.target.value || 0))} />
                    <Button variant="outline" size="sm" onClick={() => setPrincipalPackagePriceOverride(null)}>Auto</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{isEs ? `Sugerido por margen objetivo: ${fmt(packagePricingOverview.principalSuggestedPrice)}` : `Target-margin suggested: ${fmt(packagePricingOverview.principalSuggestedPrice)}`}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{isEs ? 'Suma precios paquetes' : 'Package price sum'}</p>
                  <p className="text-lg font-semibold">{fmt(packagePricingOverview.packagePriceSum)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">{isEs ? 'Total oferta editable' : 'Editable offer total'}</label>
                  <div className="flex gap-2">
                    <Input type="number" min="0" value={Math.round(packagePricingOverview.finalOfferPrice)} onChange={(event) => setOfferTotalPriceOverride(Number(event.target.value || 0))} />
                    <Button variant="outline" size="sm" onClick={() => setOfferTotalPriceOverride(null)}>Auto</Button>
                  </div>
                  <p className={`text-[11px] ${packagePricingOverview.globalAdjustment <= 0 ? 'text-green-600' : 'text-muted-foreground'}`}>{isEs ? `Ajuste global: ${fmt(packagePricingOverview.globalAdjustment)}` : `Global adjustment: ${fmt(packagePricingOverview.globalAdjustment)}`}</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {isEs ? 'Margen final de la oferta:' : 'Final offer margin:'} <span className={packagePricingOverview.finalMargin >= 0 ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>{fmt(packagePricingOverview.finalMargin)} ({fmtPct(packagePricingOverview.finalMarginPct)})</span>
              </div>
            </CardContent>
          </Card>

          {/* Totals card */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? 'Coste Total' : 'Total Cost'}</p>
                  <p className="text-xl font-bold text-foreground">{fmt(totals.total)}</p>
                  <p className="text-[11px] text-muted-foreground">{isEs ? 'Directo' : 'Direct'} {fmt(totals.direct)} + {isEs ? "poltica" : 'policy'} {fmt(totals.total - totals.direct)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? 'Precio Venta' : 'Selling Price'}</p>
                  <p className="text-xl font-bold text-primary">{fmt(packagePricingOverview.finalOfferPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? 'Margen' : 'Margin'}</p>
                  <p className="text-xl font-bold text-green-600">{fmt(packagePricingOverview.finalMargin)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? 'Margen %' : 'Margin %'}</p>
                  <p className="text-xl font-bold text-green-600">{fmtPct(packagePricingOverview.finalMarginPct)}</p>
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
              <p>{isEs ? "Ejecuta el anlisis IA para ver resultados" : 'Run AI analysis to see results'}</p>
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
                          {s.adjustments && <p className="text-xs text-muted-foreground mt-2">{Array.isArray(s.adjustments) ? s.adjustments.join(" ") : s.adjustments}</p>}
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

              {/* Profitability Control */}
              {analysis.profitabilityControl && (
                <Card className={analysis.profitabilityControl.belowThreshold ? 'border-destructive border-2' : ''}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      {isEs ? 'Control de Rentabilidad' : 'Profitability Control'}
                      {analysis.profitabilityControl.belowThreshold && (
                        <Badge variant="destructive">{isEs ? " BAJO UMBRAL" : " BELOW THRESHOLD"}</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analysis.profitabilityControl.minimumMarginScenario && (
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">{isEs ? "Margen Mnimo Escenario" : 'Minimum Margin Scenario'}</p>
                          <p className="text-lg font-bold">{fmtPct(analysis.profitabilityControl.minimumMarginScenario.margin)}</p>
                          <p className="text-xs text-muted-foreground">{analysis.profitabilityControl.minimumMarginScenario.conditions}</p>
                        </div>
                      )}
                      {analysis.profitabilityControl.riskAdjustedMargin && (
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">{isEs ? 'Margen Ajustado por Riesgo' : 'Risk-Adjusted Margin'}</p>
                          <p className="text-lg font-bold">{fmtPct(analysis.profitabilityControl.riskAdjustedMargin.margin)}</p>
                          <p className="text-xs text-muted-foreground">{analysis.profitabilityControl.riskAdjustedMargin.adjustments}</p>
                        </div>
                      )}
                    </div>
                    {analysis.profitabilityControl.correctiveActions && analysis.profitabilityControl.correctiveActions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">{isEs ? 'Acciones Correctivas' : 'Corrective Actions'}</p>
                        <ul className="space-y-1">
                          {analysis.profitabilityControl.correctiveActions.map((a, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <AlertTriangle className="h-3 w-3 mt-1 text-destructive flex-shrink-0" />
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Rate Validation */}
              {analysis.costAnalysis?.rateValidation && analysis.costAnalysis.rateValidation.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />{isEs ? "Validacin de Tasas" : 'Rate Validation'}</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isEs ? 'Tasa' : 'Rate'}</TableHead>
                          <TableHead>{isEs ? 'Aplicado' : 'Applied'}</TableHead>
                          <TableHead>{isEs ? 'Esperado' : 'Expected'}</TableHead>
                          <TableHead>{isEs ? "Desviacin" : 'Deviation'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.costAnalysis.rateValidation.map((rv, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{rv.rateName}</TableCell>
                            <TableCell>{fmt(rv.applied)}</TableCell>
                            <TableCell>{fmt(rv.expected)}</TableCell>
                            <TableCell><Badge variant={rv.deviation.includes('high') || rv.deviation.includes('under') ? 'destructive' : 'secondary'}>{rv.deviation}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Missing Categories Alert */}
              {analysis.costAnalysis?.missingCategories && analysis.costAnalysis.missingCategories.length > 0 && (
                <Card className="border-destructive">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-destructive">{isEs ? "Categoras de Coste Faltantes" : 'Missing Cost Categories'}</p>
                        <p className="text-sm text-muted-foreground mt-1">{analysis.costAnalysis.missingCategories.join(', ')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}


              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />{isEs ? 'Riesgos Detectados' : 'Detected Risks'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                <div className="flex flex-col md:flex-row gap-2">
                  <Select value={catalogSelection} onValueChange={setCatalogSelection}>
                    <SelectTrigger className="md:flex-1">
                      <SelectValue placeholder={isEs ? "Seleccionar del catlogo" : 'Select from catalog'} />
                    </SelectTrigger>
                    <SelectContent>
                      {data.products
                        .filter((product) => product.name && (product.validated ?? true))
                        .map((product) => (
                          <SelectItem key={`${product.name}-${product.type}`} value={product.name}>
                            {product.name} - {(product.category || 'product')}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={addCatalogItem} disabled={!catalogSelection}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isEs ? "Aadir del catlogo" : 'Add from catalog'}
                  </Button>
                </div>
                {selectedCatalogProduct ? (
                  <div className="grid gap-3 md:grid-cols-3 rounded-lg border bg-muted/20 p-3 text-sm">
                    <div>
                      <p className="font-medium">{selectedCatalogProduct.name}</p>
                      <p className="text-muted-foreground mt-1">{selectedCatalogProduct.comments || (isEs ? 'Producto canonizado para costes reutilizables.' : 'Canonical product profile for reusable costs.')}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">{isEs ? 'Longitud de referencia (m)' : 'Reference length (m)'}</label>
                      <Input type="number" min={1} value={catalogLengthM} onChange={e => setCatalogLengthM(Number(e.target.value || selectedCatalogProduct.defaultLengthM || 80))} disabled={!selectedCatalogProduct.configurableByLength} />
                      <p className="text-xs text-muted-foreground">{selectedCatalogProduct.configurableByLength ? (isEs ? "Este producto ajusta materiales segn la longitud seleccionada." : 'This product scales material costs with the selected length.') : (isEs ? 'Producto con preset fijo de costes.' : 'Product with fixed cost preset.')}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">{isEs ? 'Opciones de preset' : 'Preset options'}</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={catalogIncludeInstallation} onChange={e => setCatalogIncludeInstallation(e.target.checked)} />{isEs ? "Incluir instalacin" : 'Include installation'}</label>
                      <p className="text-xs text-muted-foreground">{isEs ? "Al aadir el producto se cargarn sus lneas de coste reutilizables en la oferta." : 'Adding the product loads its reusable cost lines into the offer.'}</p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-500" />{isEs ? 'Recomendaciones' : 'Recommendations'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                <div className="flex flex-col md:flex-row gap-2">
                  <Select value={catalogSelection} onValueChange={setCatalogSelection}>
                    <SelectTrigger className="md:flex-1">
                      <SelectValue placeholder={isEs ? "Seleccionar del catlogo" : 'Select from catalog'} />
                    </SelectTrigger>
                    <SelectContent>
                      {data.products
                        .filter((product) => product.name && (product.validated ?? true))
                        .map((product) => (
                          <SelectItem key={`${product.name}-${product.type}`} value={product.name}>
                            {product.name} - {(product.category || 'product')}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={addCatalogItem} disabled={!catalogSelection}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isEs ? "Aadir del catlogo" : 'Add from catalog'}
                  </Button>
                </div>
                {selectedCatalogProduct ? (
                  <div className="grid gap-3 md:grid-cols-3 rounded-lg border bg-muted/20 p-3 text-sm">
                    <div>
                      <p className="font-medium">{selectedCatalogProduct.name}</p>
                      <p className="text-muted-foreground mt-1">{selectedCatalogProduct.comments || (isEs ? 'Producto canonizado para costes reutilizables.' : 'Canonical product profile for reusable costs.')}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">{isEs ? 'Longitud de referencia (m)' : 'Reference length (m)'}</label>
                      <Input type="number" min={1} value={catalogLengthM} onChange={e => setCatalogLengthM(Number(e.target.value || selectedCatalogProduct.defaultLengthM || 80))} disabled={!selectedCatalogProduct.configurableByLength} />
                      <p className="text-xs text-muted-foreground">{selectedCatalogProduct.configurableByLength ? (isEs ? "Este producto ajusta materiales segn la longitud seleccionada." : 'This product scales material costs with the selected length.') : (isEs ? 'Producto con preset fijo de costes.' : 'Product with fixed cost preset.')}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">{isEs ? 'Opciones de preset' : 'Preset options'}</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={catalogIncludeInstallation} onChange={e => setCatalogIncludeInstallation(e.target.checked)} />{isEs ? "Incluir instalacin" : 'Include installation'}</label>
                      <p className="text-xs text-muted-foreground">{isEs ? "Al aadir el producto se cargarn sus lneas de coste reutilizables en la oferta." : 'Adding the product loads its reusable cost lines into the offer.'}</p>
                    </div>
                  </div>
                ) : null}
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
              <div className="mb-4">
                <Input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder={isEs ? 'Buscar por numero, titulo, cliente o estado' : 'Search by offer #, title, customer or status'} aria-label={isEs ? 'Buscar ofertas' : 'Search offers'} />
              </div>
              {savedOffers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{isEs ? 'Sin ofertas guardadas' : 'No saved offers'}</p>
              ) : filteredSavedOffers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{isEs ? 'Sin coincidencias para la busqueda actual' : 'No offers match the current search'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEs ? "N Oferta" : 'Offer #'}</TableHead>
                      <TableHead>{isEs ? "Ttulo" : 'Title'}</TableHead>
                      <TableHead>{isEs ? 'Cliente' : 'Customer'}</TableHead>
                      <TableHead>{isEs ? 'Estado' : 'Status'}</TableHead>
                      <TableHead>{isEs ? 'Fecha' : 'Date'}</TableHead>
                      <TableHead>{isEs ? 'Acciones' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSavedOffers.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-sm">{o.offer_number || '-'}</TableCell>
                        <TableCell>{o.title}</TableCell>
                        <TableCell>{o.customer_name}</TableCell>
                        <TableCell>
                          <Select value={o.status} onValueChange={(v) => updateOfferStatus(o.id, v)}>
                            <SelectTrigger className="w-28 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">{isEs ? 'Borrador' : 'Draft'}</SelectItem>
                              <SelectItem value="sent">{isEs ? 'Enviada' : 'Sent'}</SelectItem>
                              <SelectItem value="negotiation">{isEs ? "Negociacin" : 'Negotiation'}</SelectItem>
                              <SelectItem value="won">{isEs ? 'Ganada' : 'Won'}</SelectItem>
                              <SelectItem value="lost">{isEs ? 'Perdida' : 'Lost'}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => void loadOfferForEditing(o)} aria-label={`Edit offer ${o.offer_number || o.id}`}>
                            <Settings2 className="h-3 w-3 mr-1" />
                            {isEs ? 'Editar' : 'Edit'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={exportingOfferId === o.id}
                            onClick={() => void exportOfferToWord(o, 'en')}
                            aria-label={`Export offer ${o.offer_number || o.id} to Word in English`}
                          >
                            {exportingOfferId === o.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <FileText className="h-3 w-3 mr-1" />
                            )}
                            Word EN
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={exportingOfferId === o.id}
                            onClick={() => void exportOfferToWord(o, 'es')}
                            aria-label={`Export offer ${o.offer_number || o.id} to Word in Spanish`}
                          >
                            {exportingOfferId === o.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <FileText className="h-3 w-3 mr-1" />
                            )}
                            Word ES
                          </Button>
                          {o.status !== 'won' ? (
                            <Button
                              size="sm"
                              variant="default"
                              disabled={convertingId === o.id}
                              onClick={() => convertToProject(o)}
                            >
                              {convertingId === o.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <FolderKanban className="h-3 w-3 mr-1" />
                              )}
                              {isEs ? 'Crear Proyecto' : 'Create Project'}
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => navigate('/project-management')}>
                              <ArrowRight className="h-3 w-3 mr-1" />
                              {isEs ? 'Ver Proyecto' : 'View Project'}
                            </Button>
                          )}
                          </div>
                        </TableCell>
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
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />{isEs ? "Resumen Econmico" : 'Economic Summary'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">{isEs ? 'Coste Total' : 'Total Cost'}</p>
                  <p className="text-xl font-bold">{fmt(totals.total)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">{isEs ? 'Precio Venta' : 'Selling Price'}</p>
                  <p className="text-xl font-bold text-primary">{fmt(packagePricingOverview.finalOfferPrice)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">{isEs ? "Margen " : "Margin "}</p>
                  <p className="text-xl font-bold text-green-600">{fmt(packagePricingOverview.finalMargin)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">{isEs ? 'Margen %' : 'Margin %'}</p>
                  <p className="text-xl font-bold text-green-600">{fmtPct(packagePricingOverview.finalMarginPct)}</p>
                </div>
              </div>

              <Separator />
              <h3 className="font-semibold text-foreground">{isEs ? "Desglose por categora" : 'Breakdown by Category'}</h3>
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
                {([
                  { key: 'warranty', label: isEs ? `Garanta ${pricingPolicy.warrantyPct}%` : `Warranty ${pricingPolicy.warrantyPct}%`, val: totals.policyCharges.warranty },
                  { key: 'materialStructure', label: isEs ? `Estructura materiales ${pricingPolicy.materialStructurePct}%` : `Material structure ${pricingPolicy.materialStructurePct}%`, val: totals.policyCharges.materialStructure },
                  { key: 'financial', label: isEs ? `Financiacin ${pricingPolicy.financialPct}%` : `Finance ${pricingPolicy.financialPct}%`, val: totals.policyCharges.financial },
                  { key: 'commercialMgmt', label: isEs ? `Gestin comercial ${pricingPolicy.commercialMgmtPct}%` : `Commercial mgmt. ${pricingPolicy.commercialMgmtPct}%`, val: totals.policyCharges.commercialMgmt },
                ]).map((entry) => {
                  const pct = totals.total > 0 ? (entry.val / totals.total) * 100 : 0;
                  return (
                    <div key={entry.key} className="flex items-center gap-3 text-muted-foreground">
                      <span className="text-sm w-40 truncate italic">{entry.label}</span>
                      <Progress value={pct} className="flex-1 h-2" />
                      <span className="text-sm font-medium w-24 text-right">{fmt(entry.val)}</span>
                      <span className="text-xs w-12 text-right">{fmtPct(pct)}</span>
                    </div>
                  );
                })}
              </div>

              <Separator />
              <h3 className="font-semibold text-foreground">{isEs ? 'Paquetes comerciales' : 'Commercial packages'}</h3>
              {packageSummaryRows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEs ? 'Paquete' : 'Package'}</TableHead>
                      <TableHead>{isEs ? 'Tipo' : 'Type'}</TableHead>
                      <TableHead>{isEs ? 'Detalle ejecutivo' : 'Executive detail'}</TableHead>
                      <TableHead className="text-right">{isEs ? 'Coste directo' : 'Direct cost'}</TableHead>
                      <TableHead className="text-right">{isEs ? 'Politicas' : 'Policy'}</TableHead>
                      <TableHead className="text-right">{isEs ? 'Coste total' : 'Total cost'}</TableHead>
                      <TableHead className="text-right">{isEs ? 'Precio' : 'Price'}</TableHead>
                      <TableHead className="text-right">{isEs ? 'Margen' : 'Margin'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">{isEs ? 'Paquete principal' : 'Principal package'}</TableCell>
                      <TableCell><Badge variant="secondary">core</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{isEs ? 'Total oferta menos paquetes adicionales.' : 'Total offer minus additional packages.'}</TableCell>
                      <TableCell className="text-right">{fmt(packagePricingOverview.principalDirect)}</TableCell>
                      <TableCell className="text-right">{fmt(packagePricingOverview.principalPolicy)}</TableCell>
                      <TableCell className="text-right">{fmt(packagePricingOverview.principalCost)}</TableCell>
                      <TableCell className="text-right">{fmt(packagePricingOverview.principalPrice)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(packagePricingOverview.principalPrice - packagePricingOverview.principalCost)} ({fmtPct(packagePricingOverview.principalPrice > 0 ? ((packagePricingOverview.principalPrice - packagePricingOverview.principalCost) / packagePricingOverview.principalPrice) * 100 : 0)})</TableCell>
                    </TableRow>
                    {packageSummaryRows.map((entry) => (
                      <TableRow key={entry.pkg.id}>
                        <TableCell className="font-medium">{entry.pkg.name || '-'}</TableCell>
                        <TableCell><Badge variant="outline">{entry.pkg.type}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{entry.pkg.executiveSummary || '-'}</TableCell>
                        <TableCell className="text-right">{fmt(entry.directCost)}</TableCell>
                        <TableCell className="text-right">{fmt(entry.policyCost)}</TableCell>
                        <TableCell className="text-right">{fmt(entry.cost)}</TableCell>
                        <TableCell className="text-right">{fmt(entry.price)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(entry.margin)} ({fmtPct(entry.marginPct)})</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-medium">{isEs ? 'TOTAL OFERTA' : 'OFFER TOTAL'}</TableCell>
                      <TableCell><Badge variant="secondary">all</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{isEs ? 'Suma de paquetes, editable para descuento global.' : 'Sum of package prices, editable for global bundle discount.'}</TableCell>
                      <TableCell className="text-right">{fmt(totals.direct)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.total - totals.direct)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.total)}</TableCell>
                      <TableCell className="text-right">{fmt(packagePricingOverview.finalOfferPrice)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(packagePricingOverview.finalMargin)} ({fmtPct(packagePricingOverview.finalMarginPct)})</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">{isEs ? 'No hay paquetes configurados todavia.' : 'No packages configured yet.'}</p>
              )}

              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <p className="font-medium text-foreground">Payment terms preview</p>
                <p className="text-muted-foreground mt-1">{buildPaymentTermsText(commercialTerms)}</p>
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











