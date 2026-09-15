import { useEffect, useMemo, useRef, useState } from 'react';
import { useData, type ProductRecord } from '@/store/DataStore';
import { ProductDocumentsCard } from '@/components/ProductDocumentsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { toast } from '@/hooks/use-toast';
import { BarChart3, CheckCircle2, Copy, CopyPlus, ExternalLink, FileText, Lightbulb, Package, Pencil, Plus, RotateCcw, Save, Search, Sparkles, Target, Trash2, TrendingUp } from 'lucide-react';
import { fmt } from '@/components/analysis360/AnalysisUtils';
import {
  buildProductPositioningActions,
  buildProductStrategySnapshot,
  evaluateProductActionFeedback,
  type ProductActionEvaluation,
  type ProductPositionAction,
} from '@/lib/productStrategy';
import { runProductAnalysisAgent, type ProductStrategicSignals, runProductSearchAgent } from '@/agents/productCatalogAgents';
import { inferProductCategory, type ProductCostPresetLine } from '@/lib/productCatalog';
import { buildProductIntelligence, buildSeedProductCatalog, estimateProductPresetCost, mergeProductWithKnowledge, presetLineTotal as presetLineTotalWithPolicy } from '@/lib/productKnowledge';
import { InstallationPlanner } from '@/components/costs/InstallationPlanner';
import { createInstallationPlan } from '@/lib/installationCost';

type CatalogDraft = ProductRecord & { draftId: string };
type Dossier = NonNullable<ProductRecord['technicalDossier']>;

type CategorySummary = {
  label: string;
  productCount: number;
  revenue: number;
  avgFit: number;
};

let fallbackDraftIdCounter = 0;
const COST_CATEGORIES: ProductCostPresetLine['category'][] = ['materials', 'engineering', 'subcontracting', 'installation', 'transport', 'indirect'];
const COST_MODES: NonNullable<ProductCostPresetLine['mode']>[] = ['unit', 'engineering', 'installation'];
const DOSSIER_STATUSES = ['verified', 'commercial-claim', 'modelled', 'pre-engineering', 'pending'] as const;

const getDraftId = () => globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.round(Math.random() * 1e6)}-${fallbackDraftIdCounter++}`;
// Keep raw lines while typing so Enter creates a new line; cleaning happens in normalizeDraft.
const rawLines = (value: string) => value.split(/\r?\n/);
const cleanLines = (values?: string[]) => (values || []).map((item) => String(item || '').trim()).filter(Boolean);
const normalizeName = (value: string) => value.trim().toLowerCase();
const summarizeSignal = (signal: ProductStrategicSignals) => `${signal.lifecycleSignal} lifecycle, ${signal.offerModel}, competition led by ${signal.competitionFocus}.`;

const formatSpecifications = (items: Dossier['technicalSpecifications']) => items.map((item) => `${item.parameter} | ${item.value} | ${item.status}`).join('\n');

const dossierSpecifications = (value: string): Dossier['technicalSpecifications'] => value
  .split(/\r?\n/)
  .map((line) => {
    const [parameter = '', specificationValue = '', rawStatus = 'pending'] = line.split('|').map((item) => item.trim());
    const status = DOSSIER_STATUSES.find((item) => item === rawStatus) || 'pending';
    return { parameter, value: specificationValue, status };
  })
  .filter((item) => item.parameter && item.value);

const normalizeDossier = (dossier?: Dossier): Dossier | undefined => {
  if (!dossier) return undefined;
  return {
    ...dossier,
    dossierId: dossier.dossierId.trim(),
    revision: dossier.revision.trim(),
    valueProposition: dossier.valueProposition.trim(),
    applications: cleanLines(dossier.applications),
    technicalSpecifications: (dossier.technicalSpecifications || []).filter((item) => item.parameter && item.value),
    performanceKpis: cleanLines(dossier.performanceKpis),
    roiFramework: cleanLines(dossier.roiFramework),
    risksAndLimits: cleanLines(dossier.risksAndLimits),
    acceptanceCriteria: cleanLines(dossier.acceptanceCriteria),
    sourceReferences: cleanLines(dossier.sourceReferences),
  };
};

const toDraft = (product: ProductRecord): CatalogDraft => {
  const normalized = mergeProductWithKnowledge(product);
  return {
    ...normalized,
    draftId: getDraftId(),
    category: inferProductCategory(normalized.type, normalized.category),
    characteristics: normalized.characteristics || [],
    estimatedCost: normalized.estimatedCost || 0,
    repositories: normalized.repositories || [],
    validated: Boolean(normalized.validated),
    source: normalized.source || 'manual',
    linkedReports: normalized.linkedReports || [],
    costPreset: normalized.costPreset || [],
    competitors: normalized.competitors || [],
    marketFitNotes: normalized.marketFitNotes || [],
    fitImprovementActions: normalized.fitImprovementActions || [],
    technicalDossier: normalized.technicalDossier,
  };
};

const normalizeDraft = (draft: CatalogDraft): ProductRecord => ({
  name: (draft.name || '').trim(),
  averageValue: Number(draft.averageValue || 0),
  type: (draft.type || '').trim(),
  comments: (draft.comments || '').trim(),
  category: draft.category || 'product',
  characteristics: (draft.characteristics || []).map((item) => item.trim()).filter(Boolean),
  estimatedCost: Number(draft.estimatedCost || 0),
  repositories: (draft.repositories || []).map((item) => item.trim()).filter(Boolean),
  validated: Boolean(draft.validated),
  source: draft.source || 'manual',
  productInfoUrl: (draft.productInfoUrl || '').trim(),
  productVideoUrl: (draft.productVideoUrl || '').trim(),
  linkedReports: (draft.linkedReports || []).map((item) => item.trim()).filter(Boolean),
  defaultLengthM: draft.defaultLengthM ? Number(draft.defaultLengthM) : undefined,
  configurableByLength: Boolean(draft.configurableByLength),
  costPreset: draft.costPreset || [],
  competitors: draft.competitors || [],
  marketFitNotes: (draft.marketFitNotes || []).map((item) => item.trim()).filter(Boolean),
  fitImprovementActions: (draft.fitImprovementActions || []).map((item) => item.trim()).filter(Boolean),
  technicalDossier: normalizeDossier(draft.technicalDossier),
});

// Canonical Ingecart profiles are only injected when an active company has no stored catalog yet;
// otherwise the persisted records are the source of truth so removals and renames stick.
const buildDraftsFromStore = (products: ProductRecord[], seedWhenEmpty: boolean): CatalogDraft[] => (
  products.length === 0 && seedWhenEmpty ? buildSeedProductCatalog([]) : products
).map(toDraft);

const presetLineTotal = (line: ProductCostPresetLine) => presetLineTotalWithPolicy(line);

const newCostPresetLine = (category: ProductCostPresetLine['category'] = 'materials'): ProductCostPresetLine => ({
  category,
  lineItem: '',
  mode: category === 'engineering' ? 'engineering' : category === 'installation' ? 'installation' : 'unit',
  quantity: 1,
  unitCost: 0,
  hours: 0,
  hourlyRate: 0,
  days: 0,
  resources: 0,
  notes: '',
});

const createEmptyDossier = (productName: string): Dossier => ({
  dossierId: `${(productName || 'product').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'PRODUCT'}-DOSSIER`,
  revision: '0',
  updatedAt: new Date().toISOString().slice(0, 10),
  valueProposition: '',
  applications: [],
  technicalSpecifications: [],
  performanceKpis: [],
  roiFramework: [],
  risksAndLimits: [],
  acceptanceCriteria: [],
  sourceReferences: [],
});

const ProductStrategyPage = () => {
  const { data, addTask, updateTask, setProducts, activeCompanyId, loading, loadedCompanyId } = useData();
  const [feedbackByAction, setFeedbackByAction] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<Record<string, ProductActionEvaluation>>({});
  const [taskIdsByAction, setTaskIdsByAction] = useState<Record<string, string>>({});
  const [catalogDrafts, setCatalogDrafts] = useState<CatalogDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // Raw text of the specifications textarea while editing, so partial lines are not dropped mid-typing.
  const [specsText, setSpecsText] = useState<string | null>(null);
  const selectedNameRef = useRef<string | null>(null);
  // Snapshot of the ficha as it was before edit mode started, so "Save as new" can restore the original.
  const editBaselineRef = useRef<CatalogDraft | null>(null);
  // Canonical seeds are only offered once the active company's dataset has actually been loaded.
  const catalogReady = Boolean(activeCompanyId) && loadedCompanyId === activeCompanyId && !loading;

  useEffect(() => {
    if (loading) return;
    const nextDrafts = buildDraftsFromStore(data.products, catalogReady);
    setCatalogDrafts(nextDrafts);
    setIsDirty(false);
    setSpecsText(null);
    const previousName = selectedNameRef.current;
    const matching = previousName ? nextDrafts.find((draft) => normalizeName(draft.name) === normalizeName(previousName)) : null;
    setSelectedDraftId(matching?.draftId || nextDrafts[0]?.draftId || null);
  }, [data.products, loading, catalogReady]);

  useEffect(() => {
    if (catalogDrafts.length === 0) {
      setSelectedDraftId(null);
      setIsEditing(false);
      return;
    }
    if (!selectedDraftId || !catalogDrafts.some((draft) => draft.draftId === selectedDraftId)) {
      setSelectedDraftId(catalogDrafts[0].draftId);
      setIsEditing(false);
    }
  }, [catalogDrafts, selectedDraftId]);

  const catalogProducts = useMemo(() => catalogDrafts.map(normalizeDraft).filter((product) => product.name), [catalogDrafts]);
  const snapshot = useMemo(() => buildProductStrategySnapshot({ products: catalogProducts, orders: data.orders, opportunities: data.opportunities }), [catalogProducts, data.orders, data.opportunities]);
  const actionCards = useMemo(() => buildProductPositioningActions(snapshot.products, data.companyProfile.company_name || 'your company'), [snapshot.products, data.companyProfile.company_name]);
  const strategicSignals = useMemo(() => Object.fromEntries(catalogProducts.map((product) => [product.name, runProductAnalysisAgent(product)])), [catalogProducts]);
  const intelligenceCards = useMemo(() => snapshot.products.map((product) => buildProductIntelligence(catalogProducts.find((item) => item.name === product.name) || { name: product.name, averageValue: 0, type: '', comments: '' }, product.marketFitScore)), [catalogProducts, snapshot.products]);
  const categoriesSummary = useMemo(() => {
    const byCategory = new Map<string, CategorySummary>();
    snapshot.products.forEach((product) => {
      const catalogProduct = catalogProducts.find((item) => item.name === product.name);
      const label = catalogProduct?.category === 'service' ? 'Service' : 'Product';
      const current = byCategory.get(label) || { label, productCount: 0, revenue: 0, avgFit: 0 };
      current.productCount += 1;
      current.revenue += product.revenue;
      current.avgFit += product.marketFitScore;
      byCategory.set(label, current);
    });
    return Array.from(byCategory.values()).map((item) => ({ ...item, avgFit: item.productCount > 0 ? item.avgFit / item.productCount : 0 }));
  }, [catalogProducts, snapshot.products]);

  const selectedDraft = useMemo(() => catalogDrafts.find((draft) => draft.draftId === selectedDraftId) || null, [catalogDrafts, selectedDraftId]);
  useEffect(() => {
    selectedNameRef.current = selectedDraft?.name || null;
  }, [selectedDraft]);
  const selectedSnapshot = useMemo(() => {
    if (!selectedDraft?.name) return null;
    return snapshot.products.find((product) => product.name === selectedDraft.name) || null;
  }, [selectedDraft, snapshot.products]);
  const selectedIntelligence = useMemo(() => selectedDraft ? buildProductIntelligence(normalizeDraft(selectedDraft), selectedSnapshot?.marketFitScore || 0) : null, [selectedDraft, selectedSnapshot]);
  const selectedSignal = useMemo(() => {
    if (!selectedDraft?.name) return null;
    return strategicSignals[selectedDraft.name] || runProductAnalysisAgent(selectedDraft);
  }, [selectedDraft, strategicSignals]);

  const topInnovation = snapshot.products.filter((product) => product.lifecycleLabel === 'Innovation').length;
  const commodityCount = snapshot.products.filter((product) => product.lifecycleLabel === 'Commodity').length;
  const avgFit = snapshot.products.length > 0 ? snapshot.products.reduce((sum, product) => sum + product.marketFitScore, 0) / snapshot.products.length : 0;

  const mutateDrafts = (updater: (prev: CatalogDraft[]) => CatalogDraft[]) => {
    setCatalogDrafts(updater);
    setIsDirty(true);
  };

  const updateDraft = (draftId: string, field: keyof CatalogDraft, value: unknown) => {
    mutateDrafts((prev) => prev.map((draft) => (draft.draftId === draftId ? { ...draft, [field]: value } : draft)));
  };

  const updateDossier = (draftId: string, field: keyof Dossier, value: unknown) => {
    mutateDrafts((prev) => prev.map((draft) => (
      draft.draftId === draftId && draft.technicalDossier
        ? { ...draft, technicalDossier: { ...draft.technicalDossier, [field]: value } }
        : draft
    )));
  };

  const updateCostPresetLine = (draftId: string, index: number, patch: Partial<ProductCostPresetLine>) => {
    mutateDrafts((prev) => prev.map((draft) => {
      if (draft.draftId !== draftId) return draft;
      const costPreset = [...(draft.costPreset || [])];
      costPreset[index] = { ...costPreset[index], ...patch };
      return { ...draft, costPreset };
    }));
  };

  const addCostPresetLine = (draftId: string) => {
    mutateDrafts((prev) => prev.map((draft) => draft.draftId === draftId ? { ...draft, costPreset: [...(draft.costPreset || []), newCostPresetLine()] } : draft));
  };

  const removeCostPresetLine = (draftId: string, index: number) => {
    mutateDrafts((prev) => prev.map((draft) => draft.draftId === draftId ? { ...draft, costPreset: (draft.costPreset || []).filter((_, lineIndex) => lineIndex !== index) } : draft));
  };

  const selectDraft = (draftId: string) => {
    setSelectedDraftId(draftId);
    setIsEditing(false);
    setSpecsText(null);
  };

  const beginEditing = (draft: CatalogDraft | null) => {
    editBaselineRef.current = draft ? (JSON.parse(JSON.stringify(draft)) as CatalogDraft) : null;
  };

  const toggleEditing = () => {
    setSpecsText(null);
    setIsEditing((prev) => {
      if (!prev) beginEditing(selectedDraft);
      return !prev;
    });
  };

  const openForEditing = (draftId: string) => {
    beginEditing(catalogDrafts.find((draft) => draft.draftId === draftId) || null);
    setSelectedDraftId(draftId);
    setSpecsText(null);
    setIsEditing(true);
  };

  const uniqueProductName = (baseName: string, drafts: CatalogDraft[], excludeDraftId?: string) => {
    const taken = new Set(drafts.filter((draft) => draft.draftId !== excludeDraftId).map((draft) => normalizeName(draft.name)));
    const root = baseName.trim() || 'New product';
    if (!taken.has(normalizeName(root))) return root;
    let candidate = `${root} (copy)`;
    let counter = 2;
    while (taken.has(normalizeName(candidate))) {
      candidate = `${root} (copy ${counter})`;
      counter += 1;
    }
    return candidate;
  };

  const duplicateCatalogItem = (draftId: string) => {
    const source = catalogDrafts.find((draft) => draft.draftId === draftId);
    if (!source) return;
    const copy = toDraft({ ...normalizeDraft(source), name: uniqueProductName(source.name, catalogDrafts), source: 'manual', validated: false });
    mutateDrafts((prev) => [...prev, copy]);
    beginEditing(copy);
    setSelectedDraftId(copy.draftId);
    setSpecsText(null);
    setIsEditing(true);
    toast({ title: 'Product duplicated', description: `${copy.name} was created from ${source.name}. Adjust it and save the catalog.` });
  };

  const addCatalogItem = (category: 'product' | 'service') => {
    const draft = toDraft({ name: '', averageValue: 0, type: category === 'service' ? 'service model' : 'equipment', comments: '', category, characteristics: [], estimatedCost: 0, repositories: [], validated: false, source: 'manual', linkedReports: [], costPreset: [], competitors: [], marketFitNotes: [], fitImprovementActions: [] });
    mutateDrafts((prev) => [...prev, draft]);
    setSelectedDraftId(draft.draftId);
    setSpecsText(null);
    setIsEditing(true);
  };
  const removeCatalogItem = (draftId: string) => {
    mutateDrafts((prev) => prev.filter((draft) => draft.draftId !== draftId));
    if (selectedDraftId === draftId) {
      setSelectedDraftId(null);
      setIsEditing(false);
      setSpecsText(null);
    }
  };

  const ensureDossier = (draftId: string) => {
    mutateDrafts((prev) => prev.map((draft) => {
      if (draft.draftId !== draftId || draft.technicalDossier) return draft;
      return { ...draft, technicalDossier: createEmptyDossier(draft.name) };
    }));
  };

  const loadCanonicalProfiles = () => {
    const nextDrafts = buildSeedProductCatalog(catalogProducts).map(toDraft);
    mutateDrafts(() => nextDrafts);
    toast({ title: 'Canonical profiles loaded', description: 'My Products was synchronized with the product cost and intelligence playbook. Save the catalog to persist them.' });
  };

  const generateCatalog = () => {
    const suggestions = runProductSearchAgent({ products: catalogProducts, orders: data.orders, opportunities: data.opportunities });
    if (suggestions.length === 0) {
      toast({ title: 'No new suggestions', description: 'Search agent did not find additional lines to add.' });
      return;
    }
    mutateDrafts((prev) => buildSeedProductCatalog([...prev.map(normalizeDraft), ...suggestions]).map(toDraft));
    toast({ title: 'Catalog suggestions ready', description: `${suggestions.length} auto-generated items were added for validation.` });
  };

  const discardChanges = () => {
    setCatalogDrafts(buildDraftsFromStore(data.products, catalogReady));
    setIsDirty(false);
    setIsEditing(false);
    setSpecsText(null);
    editBaselineRef.current = null;
    toast({ title: 'Changes discarded', description: 'The catalog was restored from the last saved version.' });
  };

  const saveCatalog = async (draftsToSave: CatalogDraft[] = catalogDrafts) => {
    if (!activeCompanyId) {
      toast({ title: 'Select a company first', description: 'The catalog is stored per company. Choose or create a company before saving.', variant: 'destructive' });
      return false;
    }
    const cleanRecords = draftsToSave.map(normalizeDraft).filter((product) => product.name.trim().length > 0);
    const duplicated = cleanRecords.map((product) => normalizeName(product.name)).filter((name, index, names) => names.indexOf(name) !== index);
    if (duplicated.length > 0) {
      toast({ title: 'Duplicated product names', description: `Rename or remove duplicates before saving: ${Array.from(new Set(duplicated)).join(', ')}.`, variant: 'destructive' });
      return false;
    }
    setIsSaving(true);
    try {
      await setProducts(cleanRecords);
      setIsEditing(false);
      setIsDirty(false);
      setSpecsText(null);
      editBaselineRef.current = null;
      toast({ title: 'Catalog saved', description: `${cleanRecords.length} products/services are now available for offer selection.` });
      return true;
    } catch (error) {
      console.error('Unable to save product catalog', error);
      toast({ title: 'Could not save catalog', description: 'The changes remain in this screen, but they were not persisted. Try again.', variant: 'destructive' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Persists the edited ficha as a brand-new product and restores the original one untouched.
  const saveAsNewProduct = async () => {
    if (!selectedDraft) return;
    const baseline = editBaselineRef.current && editBaselineRef.current.draftId === selectedDraft.draftId ? editBaselineRef.current : null;
    const edited = normalizeDraft(selectedDraft);
    const restoredDrafts = baseline
      ? catalogDrafts.map((draft) => (draft.draftId === selectedDraft.draftId ? baseline : draft))
      : catalogDrafts.filter((draft) => draft.draftId !== selectedDraft.draftId);
    const newDraft = toDraft({
      ...edited,
      name: uniqueProductName(edited.name || baseline?.name || 'Product', restoredDrafts),
      source: 'manual',
    });
    const nextDrafts = [...restoredDrafts, newDraft];
    selectedNameRef.current = newDraft.name;
    setCatalogDrafts(nextDrafts);
    setSelectedDraftId(newDraft.draftId);
    const saved = await saveCatalog(nextDrafts);
    if (saved) toast({ title: 'Saved as new product', description: `${newDraft.name} was created${baseline ? ` and ${baseline.name} was kept unchanged` : ''}.` });
  };

  const persistActionTask = async (action: ProductPositionAction, evaluation?: ProductActionEvaluation) => {
    const existingId = taskIdsByAction[action.id];
    const feedback = feedbackByAction[action.id]?.trim();
    try {
      if (existingId) {
        await updateTask(existingId, {
          priority: evaluation?.priority || action.priority,
          notes: [`Scenario: ${action.scenario}`, feedback ? `Feedback: ${feedback}` : 'Feedback: pending', evaluation?.evaluation || 'Evaluation not run yet.'],
        });
        toast({ title: 'Monitoring task updated', description: `${action.title} has been reprioritized.` });
        return;
      }

      const taskId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${action.id}`;
      await addTask({
        id: taskId,
        title: action.title,
        description: action.goal,
        pillar: 'p6',
        status: 'todo',
        priority: evaluation?.priority || action.priority,
        category: 'strategy',
        assignee: 'Commercial team',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        notes: [`Scenario: ${action.scenario}`, `Recommended move: ${action.recommendedMove}`, feedback ? `Feedback: ${feedback}` : 'Feedback: pending'],
      });
      setTaskIdsByAction((prev) => ({ ...prev, [action.id]: taskId }));
      toast({ title: 'Monitoring task created', description: `${action.title} is now part of the action plan.` });
    } catch (error) {
      console.error('Unable to persist product action', error);
      toast({ title: 'Could not save action', description: 'The recommendation remains visible here, but it was not saved to monitoring.', variant: 'destructive' });
    }
  };

  const handleEvaluateFeedback = async (action: ProductPositionAction) => {
    const feedback = feedbackByAction[action.id]?.trim();
    if (!feedback) {
      toast({ title: 'Add feedback first', description: 'Use text or voice input to evaluate the action.', variant: 'destructive' });
      return;
    }
    const evaluation = evaluateProductActionFeedback(action, feedback);
    setEvaluations((prev) => ({ ...prev, [action.id]: evaluation }));
    await persistActionTask(action, evaluation);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">Pillar 6</span>
          <Badge variant="outline">Product, Cost and Market Fit Engine</Badge>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Product Management, Costing and Market Fit</h2>
        <p className="text-muted-foreground text-sm mt-1 max-w-4xl">Review the configured portfolio, open each product ficha, and only edit data, costs, dossiers, and references when you explicitly enable edit mode.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Products/Services</p><p className="text-2xl font-bold">{catalogProducts.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Innovation Lines</p><p className="text-2xl font-bold text-primary">{topInnovation}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Commodity Lines</p><p className="text-2xl font-bold text-amber-600">{commodityCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Avg Market Fit</p><p className="text-2xl font-bold">{avgFit.toFixed(0)}%</p></CardContent></Card>
      </div>

      <Tabs defaultValue="my-products" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="my-products" className="gap-1"><Package className="h-3.5 w-3.5" /> My Products</TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-1"><Package className="h-3.5 w-3.5" /> Portfolio</TabsTrigger>
          <TabsTrigger value="intelligence" className="gap-1"><Sparkles className="h-3.5 w-3.5" /> Market Intelligence</TabsTrigger>
          <TabsTrigger value="fit" className="gap-1"><Target className="h-3.5 w-3.5" /> Market Fit</TabsTrigger>
          <TabsTrigger value="actions" className="gap-1"><Lightbulb className="h-3.5 w-3.5" /> Action Playbook</TabsTrigger>
        </TabsList>

        <TabsContent value="my-products" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Configured products</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Select a product to open its ficha, or use the pencil to jump straight into edit mode. Edit unlocks general information, reusable costs, the technical dossier and documentation uploads.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={loadCanonicalProfiles}>Load canonical profiles</Button>
                <Button variant="outline" onClick={generateCatalog}><Search className="h-4 w-4 mr-2" /> Generate suggestions</Button>
                <Button variant="secondary" onClick={() => addCatalogItem('product')}><Plus className="h-4 w-4 mr-2" /> Add product</Button>
                <Button variant="secondary" onClick={() => addCatalogItem('service')}><Plus className="h-4 w-4 mr-2" /> Add service</Button>
                <Button onClick={() => void saveCatalog()} disabled={isSaving}><Save className="h-4 w-4 mr-2" />{isSaving ? 'Saving...' : isDirty ? 'Save catalog *' : 'Save catalog'}</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isDirty ? <p className="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2">You have unsaved catalog changes. Use Save catalog to persist them for offers and analysis.</p> : null}
              {!activeCompanyId ? <p className="text-xs rounded-md border border-destructive/40 bg-destructive/5 text-destructive px-3 py-2">No active company selected. Product changes cannot be saved until a company is active.</p> : null}
              <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
                <div className="space-y-3">
                  {catalogDrafts.map((draft) => (
                    <div key={draft.draftId} className={`flex items-stretch rounded-lg border transition-colors ${selectedDraftId === draft.draftId ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}>
                      <button
                        type="button"
                        onClick={() => selectDraft(draft.draftId)}
                        className="flex-1 min-w-0 p-4 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{draft.name || 'Untitled product'}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{draft.comments || 'No description yet.'}</p>
                          </div>
                          <Badge variant={draft.validated ? 'default' : 'outline'}>{draft.validated ? 'Validated' : 'Draft'}</Badge>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{draft.category || 'product'}</span>
                          <span>|</span>
                          <span>{fmt(draft.averageValue || 0)}</span>
                          {(draft.linkedReports || []).length > 0 ? <><span>|</span><span className="flex items-center gap-1"><FileText className="h-3 w-3" />{(draft.linkedReports || []).length}</span></> : null}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${draft.name || 'product'}`}
                        title="Edit product"
                        onClick={() => openForEditing(draft.draftId)}
                        className="flex items-center px-3 border-l text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-r-lg"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div>
                  {selectedDraft ? (
                    <Card className="border-primary/20">
                      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            {selectedDraft.name || 'Untitled product'}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{selectedDraft.comments || 'Product ficha without summary yet.'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant={isEditing ? 'secondary' : 'outline'} onClick={toggleEditing}><Pencil className="h-4 w-4 mr-2" />{isEditing ? 'Finish editing' : 'Edit'}</Button>
                          {isEditing ? <Button onClick={() => void saveCatalog()} disabled={isSaving}><Save className="h-4 w-4 mr-2" />{isSaving ? 'Saving...' : 'Save changes'}</Button> : null}
                          {isEditing ? <Button variant="outline" onClick={() => void saveAsNewProduct()} disabled={isSaving} title="Keep the original product and store these edits as a new product"><CopyPlus className="h-4 w-4 mr-2" />Save as new</Button> : null}
                          {!isEditing ? <Button variant="outline" onClick={() => duplicateCatalogItem(selectedDraft.draftId)} title="Create an editable copy of this product"><Copy className="h-4 w-4 mr-2" />Duplicate</Button> : null}
                          {isDirty ? <Button variant="outline" onClick={discardChanges}><RotateCcw className="h-4 w-4 mr-2" />Discard</Button> : null}
                          {isEditing ? <Button variant="destructive" onClick={() => removeCatalogItem(selectedDraft.draftId)}><Trash2 className="h-4 w-4 mr-2" />Remove</Button> : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div><label className="text-xs text-muted-foreground">Name</label><Input value={selectedDraft.name} onChange={(e) => updateDraft(selectedDraft.draftId, 'name', e.target.value)} disabled={!isEditing} /></div>
                          <div><label className="text-xs text-muted-foreground">Type</label><Input value={selectedDraft.type} onChange={(e) => updateDraft(selectedDraft.draftId, 'type', e.target.value)} disabled={!isEditing} /></div>
                          <div><label className="text-xs text-muted-foreground">Category</label><Select value={selectedDraft.category || 'product'} onValueChange={(value) => updateDraft(selectedDraft.draftId, 'category', value)} disabled={!isEditing}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="product">Product</SelectItem><SelectItem value="service">Service</SelectItem></SelectContent></Select></div>
                          <div><label className="text-xs text-muted-foreground">Average sale value</label><Input type="number" value={selectedDraft.averageValue || 0} onChange={(e) => updateDraft(selectedDraft.draftId, 'averageValue', Number(e.target.value || 0))} disabled={!isEditing} /></div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                          <div className="space-y-3">
                            <div><label className="text-xs text-muted-foreground">General description</label><Textarea rows={4} value={selectedDraft.comments || ''} onChange={(e) => updateDraft(selectedDraft.draftId, 'comments', e.target.value)} disabled={!isEditing} /></div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div><label className="text-xs text-muted-foreground">Characteristics (one per line)</label><Textarea rows={5} value={(selectedDraft.characteristics || []).join('\n')} onChange={(e) => updateDraft(selectedDraft.draftId, 'characteristics', e.target.value.split(/\r?\n/))} disabled={!isEditing} /></div>
                              <div><label className="text-xs text-muted-foreground">Repositories / evidence (one per line)</label><Textarea rows={5} value={(selectedDraft.repositories || []).join('\n')} onChange={(e) => updateDraft(selectedDraft.draftId, 'repositories', e.target.value.split(/\r?\n/))} disabled={!isEditing} /></div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div><label className="text-xs text-muted-foreground">Product information URL</label><Input value={selectedDraft.productInfoUrl || ''} onChange={(e) => updateDraft(selectedDraft.draftId, 'productInfoUrl', e.target.value)} disabled={!isEditing} /></div>
                            <div><label className="text-xs text-muted-foreground">Product video URL</label><Input value={selectedDraft.productVideoUrl || ''} onChange={(e) => updateDraft(selectedDraft.draftId, 'productVideoUrl', e.target.value)} disabled={!isEditing} /></div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div><label className="text-xs text-muted-foreground">Reference estimated cost</label><Input type="number" value={selectedDraft.estimatedCost || 0} onChange={(e) => updateDraft(selectedDraft.draftId, 'estimatedCost', Number(e.target.value || 0))} disabled={!isEditing} /></div>
                              <div><label className="text-xs text-muted-foreground">Length basis (m)</label><Input type="number" value={selectedDraft.defaultLengthM || 0} onChange={(e) => updateDraft(selectedDraft.draftId, 'defaultLengthM', Number(e.target.value || 0))} disabled={!isEditing || !selectedDraft.configurableByLength} /></div>
                            </div>
                            <div className="flex items-center gap-6 pt-1">
                              <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(selectedDraft.validated)} onCheckedChange={(checked) => updateDraft(selectedDraft.draftId, 'validated', Boolean(checked))} disabled={!isEditing} /><span>Validated product</span></label>
                              <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(selectedDraft.configurableByLength)} onCheckedChange={(checked) => updateDraft(selectedDraft.draftId, 'configurableByLength', Boolean(checked))} disabled={!isEditing} /><span>Configurable by length</span></label>
                            </div>
                          </div>
                        </div>

                        <ProductDocumentsCard
                          productName={selectedDraft.name || 'product'}
                          companyId={activeCompanyId}
                          references={selectedDraft.linkedReports || []}
                          isEditing={isEditing}
                          onChange={(references) => updateDraft(selectedDraft.draftId, 'linkedReports', references)}
                        />

                        {selectedDraft.technicalDossier ? (
                          <Card className="border-primary/30 bg-primary/[0.03]">
                            <CardHeader className="pb-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Technical dossier</CardTitle>
                                  <p className="text-xs text-muted-foreground mt-1">Evidence-controlled engineering basis for RFQ, ROI and FAT/SAT.</p>
                                </div>
                                <div className="flex gap-2"><Badge variant="outline">{selectedDraft.technicalDossier.dossierId}</Badge><Badge variant="secondary">Rev. {selectedDraft.technicalDossier.revision} | {selectedDraft.technicalDossier.updatedAt}</Badge></div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div><label className="text-xs text-muted-foreground">Value proposition</label><Textarea rows={2} value={selectedDraft.technicalDossier.valueProposition} onChange={(event) => updateDossier(selectedDraft.draftId, 'valueProposition', event.target.value)} disabled={!isEditing} /></div>
                              <div className="grid gap-3 xl:grid-cols-3">
                                <div><label className="text-xs text-muted-foreground">Applications (one per line)</label><Textarea rows={5} value={selectedDraft.technicalDossier.applications.join('\n')} onChange={(event) => updateDossier(selectedDraft.draftId, 'applications', rawLines(event.target.value))} disabled={!isEditing} /></div>
                                <div><label className="text-xs text-muted-foreground">Performance KPIs (one per line)</label><Textarea rows={5} value={selectedDraft.technicalDossier.performanceKpis.join('\n')} onChange={(event) => updateDossier(selectedDraft.draftId, 'performanceKpis', rawLines(event.target.value))} disabled={!isEditing} /></div>
                                <div><label className="text-xs text-muted-foreground">ROI framework (one per line)</label><Textarea rows={5} value={selectedDraft.technicalDossier.roiFramework.join('\n')} onChange={(event) => updateDossier(selectedDraft.draftId, 'roiFramework', rawLines(event.target.value))} disabled={!isEditing} /></div>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Technical specifications (parameter | value | evidence status)</label>
                                <Textarea
                                  rows={Math.max(4, selectedDraft.technicalDossier.technicalSpecifications.length + 1)}
                                  value={isEditing && specsText !== null ? specsText : formatSpecifications(selectedDraft.technicalDossier.technicalSpecifications)}
                                  onChange={(event) => {
                                    setSpecsText(event.target.value);
                                    updateDossier(selectedDraft.draftId, 'technicalSpecifications', dossierSpecifications(event.target.value));
                                  }}
                                  placeholder="Throughput | 1200 units/h | verified"
                                  disabled={!isEditing}
                                />
                                <div className="flex flex-wrap gap-1.5 mt-2">{DOSSIER_STATUSES.map((status) => <Badge key={status} variant="outline" className="text-[10px]">{status}</Badge>)}</div>
                              </div>
                              <div className="grid gap-3 xl:grid-cols-3">
                                <div><label className="text-xs text-muted-foreground">Risks and limits</label><Textarea rows={5} value={selectedDraft.technicalDossier.risksAndLimits.join('\n')} onChange={(event) => updateDossier(selectedDraft.draftId, 'risksAndLimits', rawLines(event.target.value))} disabled={!isEditing} /></div>
                                <div><label className="text-xs text-muted-foreground">FAT/SAT acceptance criteria</label><Textarea rows={5} value={selectedDraft.technicalDossier.acceptanceCriteria.join('\n')} onChange={(event) => updateDossier(selectedDraft.draftId, 'acceptanceCriteria', rawLines(event.target.value))} disabled={!isEditing} /></div>
                                <div><label className="text-xs text-muted-foreground">Sources and traceability</label><Textarea rows={5} value={selectedDraft.technicalDossier.sourceReferences.join('\n')} onChange={(event) => updateDossier(selectedDraft.draftId, 'sourceReferences', rawLines(event.target.value))} disabled={!isEditing} /></div>
                              </div>
                            </CardContent>
                          </Card>
                        ) : isEditing ? (
                          <Card className="border-dashed bg-muted/30">
                            <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-medium">Technical dossier not created yet</p>
                                <p className="text-sm text-muted-foreground">Create the engineering ficha to track specifications, KPIs, FAT/SAT criteria and validated references.</p>
                              </div>
                              <Button variant="outline" onClick={() => ensureDossier(selectedDraft.draftId)}><Plus className="h-4 w-4 mr-2" />Create dossier</Button>
                            </CardContent>
                          </Card>
                        ) : null}

                        <Card className="bg-muted/30">
                          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-base">Reusable cost preset</CardTitle>
                            {isEditing ? <Button variant="outline" size="sm" onClick={() => addCostPresetLine(selectedDraft.draftId)}><Plus className="h-4 w-4 mr-1" />Add line</Button> : null}
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {(selectedDraft.costPreset || []).length === 0 ? <p className="text-sm text-muted-foreground">No structured preset yet.</p> : null}
                            {(selectedDraft.costPreset || []).map((line, index) => (
                              <div key={`${selectedDraft.draftId}-${index}`} className="rounded-lg border bg-background p-3 space-y-3">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                                  <div className="xl:col-span-2"><label className="text-xs text-muted-foreground">Line item</label><Input value={line.lineItem || ''} onChange={(e) => updateCostPresetLine(selectedDraft.draftId, index, { lineItem: e.target.value })} disabled={!isEditing} /></div>
                                  <div><label className="text-xs text-muted-foreground">Category</label><Select value={line.category} onValueChange={(value) => updateCostPresetLine(selectedDraft.draftId, index, { category: value as ProductCostPresetLine['category'] })} disabled={!isEditing}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COST_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
                                  <div><label className="text-xs text-muted-foreground">Mode</label><Select value={line.mode || 'unit'} onValueChange={(value) => updateCostPresetLine(selectedDraft.draftId, index, { mode: value as ProductCostPresetLine['mode'] })} disabled={!isEditing}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COST_MODES.map((mode) => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}</SelectContent></Select></div>
                                  <div><label className="text-xs text-muted-foreground">Unit cost</label><Input type="number" value={line.unitCost || 0} onChange={(e) => updateCostPresetLine(selectedDraft.draftId, index, { unitCost: Number(e.target.value || 0) })} disabled={!isEditing} /></div>
                                  <div className="flex items-end justify-end">{isEditing ? <Button variant="ghost" size="sm" onClick={() => removeCostPresetLine(selectedDraft.draftId, index)}><Trash2 className="h-4 w-4" /></Button> : <Badge variant="outline">{fmt(presetLineTotal(line))}</Badge>}</div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                  <div><label className="text-xs text-muted-foreground">Quantity</label><Input type="number" value={line.quantity || 0} onChange={(e) => updateCostPresetLine(selectedDraft.draftId, index, { quantity: Number(e.target.value || 0) })} disabled={!isEditing || line.mode === 'engineering' || line.mode === 'installation'} /></div>
                                  <div><label className="text-xs text-muted-foreground">Hours</label><Input type="number" value={line.hours || 0} onChange={(e) => updateCostPresetLine(selectedDraft.draftId, index, { hours: Number(e.target.value || 0) })} disabled={!isEditing || line.mode !== 'engineering'} /></div>
                                  <div><label className="text-xs text-muted-foreground">Hourly rate</label><Input type="number" value={line.hourlyRate || 0} onChange={(e) => updateCostPresetLine(selectedDraft.draftId, index, { hourlyRate: Number(e.target.value || 0) })} disabled={!isEditing || line.mode !== 'engineering'} /></div>
                                  <div><label className="text-xs text-muted-foreground">Scale per meter</label><Input type="number" value={line.unitsPerLengthM || 0} onChange={(e) => updateCostPresetLine(selectedDraft.draftId, index, { unitsPerLengthM: Number(e.target.value || 0), scalesWithLength: Number(e.target.value || 0) > 0 })} disabled={!isEditing} /></div>
                                  <div><label className="text-xs text-muted-foreground">Days</label><Input type="number" value={line.days || 0} onChange={(e) => updateCostPresetLine(selectedDraft.draftId, index, { days: Number(e.target.value || 0) })} disabled={!isEditing || line.mode !== 'installation' || Boolean(line.installation)} /></div>
                                  <div><label className="text-xs text-muted-foreground">Resources</label><Input type="number" value={line.resources || 0} onChange={(e) => updateCostPresetLine(selectedDraft.draftId, index, { resources: Number(e.target.value || 0) })} disabled={!isEditing || line.mode !== 'installation' || Boolean(line.installation)} /></div>
                                  <div><label className="text-xs text-muted-foreground">Optional</label><div className="pt-2"><Checkbox checked={Boolean(line.optional)} onCheckedChange={(checked) => updateCostPresetLine(selectedDraft.draftId, index, { optional: Boolean(checked) })} disabled={!isEditing} /></div></div>
                                  <div><label className="text-xs text-muted-foreground">Notes</label><Input value={line.notes || ''} onChange={(e) => updateCostPresetLine(selectedDraft.draftId, index, { notes: e.target.value })} disabled={!isEditing} /></div>
                                </div>
                                {line.mode === 'installation' ? (
                                  <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Checkbox
                                        checked={Boolean(line.installation)}
                                        disabled={!isEditing}
                                        aria-label={`Detailed installation plan ${line.lineItem || index + 1}`}
                                        onCheckedChange={(checked) => updateCostPresetLine(selectedDraft.draftId, index, {
                                          installation: checked
                                            ? (line.installation || createInstallationPlan({ days: line.days || 0, resources: line.resources || 1 }))
                                            : undefined,
                                        })}
                                      />
                                      Detailed labour + travel plan (per diem, supplements, hotel, mileage/flights). When enabled it replaces days x resources x unit cost.
                                    </label>
                                    {line.installation ? (
                                      <InstallationPlanner
                                        idPrefix={`preset-${index}`}
                                        plan={line.installation}
                                        disabled={!isEditing}
                                        onChange={(plan) => updateCostPresetLine(selectedDraft.draftId, index, { installation: plan, days: plan.days, resources: plan.resources })}
                                      />
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                            <div className="flex items-center justify-between border-t pt-3 text-sm"><span className="text-muted-foreground">Preset total</span><span className="font-semibold">{fmt(estimateProductPresetCost(normalizeDraft(selectedDraft), selectedDraft.defaultLengthM))}</span></div>
                          </CardContent>
                        </Card>

                        <div className="grid gap-4 xl:grid-cols-2">
                          <Card className="bg-muted/30">
                            <CardHeader className="pb-2"><CardTitle className="text-base">Competitive benchmark</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">{(selectedIntelligence?.competitors || []).length === 0 ? <p className="text-muted-foreground">No competitor benchmark available.</p> : selectedIntelligence?.competitors.map((competitor) => (<div key={`${selectedDraft.draftId}-${competitor.name}`} className="rounded-lg border p-3 bg-background"><div className="flex items-center justify-between gap-3"><p className="font-medium">{competitor.name}</p><Badge variant="outline">{competitor.marketFit}% fit</Badge></div><p className="text-xs text-muted-foreground mt-1">Offer: {competitor.offer}</p><p className="text-xs text-muted-foreground mt-1">Performance: {competitor.performance}</p><p className="text-xs text-muted-foreground mt-1">Gap: {competitor.fitGap}</p></div>))}</CardContent>
                          </Card>
                          <Card className="bg-muted/30">
                            <CardHeader className="pb-2"><CardTitle className="text-base">Commercial guidance</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                              {selectedSignal ? <div className="rounded-lg border bg-background p-3"><p className="font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Strategic signal</p><p className="text-muted-foreground mt-1">{summarizeSignal(selectedSignal)}</p><p className="text-xs text-muted-foreground mt-1">Scenario: {selectedSignal.scenario}</p></div> : null}
                              <div className="space-y-1">{(selectedIntelligence?.marketFitNotes || []).map((note) => <p key={note} className="text-muted-foreground">- {note}</p>)}</div>
                              <div className="pt-2 border-t space-y-1">{(selectedIntelligence?.fitImprovementActions || []).map((action) => <p key={action} className="font-medium">- {action}</p>)}</div>
                            </CardContent>
                          </Card>
                        </div>
                      </CardContent>
                    </Card>
                  ) : <Card><CardContent className="py-12 text-center text-muted-foreground">No product selected.</CardContent></Card>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portfolio"><div className="grid lg:grid-cols-2 gap-4"><Card><CardHeader><CardTitle>Lifecycle portfolio map</CardTitle></CardHeader><CardContent className="space-y-4">{snapshot.products.map((product) => (<div key={product.name} className="rounded-lg border p-4 space-y-2 bg-muted/20"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{product.name}</p><p className="text-sm text-muted-foreground">{product.lifecycleLabel} | {product.positioning}</p></div><Badge variant={product.marketFitScore >= 75 ? 'default' : 'outline'}>{product.marketFitScore}% fit</Badge></div><div className="grid grid-cols-2 gap-4 text-sm"><div><span className="text-muted-foreground">Coverage</span><p className="font-medium">Pipeline {fmt(product.pipeline)} | Weighted {fmt(product.weightedPipeline)}</p></div><div><span className="text-muted-foreground">Revenue</span><p className="font-medium">{fmt(product.revenue)}</p></div></div><Progress value={product.marketFitScore} className="h-2" /><p className="text-sm text-muted-foreground">{product.notes || 'No product notes yet.'}</p></div>))}</CardContent></Card><Card><CardHeader><CardTitle>Category revenue distribution</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Products</TableHead><TableHead>Revenue</TableHead><TableHead>Avg fit</TableHead></TableRow></TableHeader><TableBody>{categoriesSummary.map((category) => (<TableRow key={category.label}><TableCell className="font-medium">{category.label}</TableCell><TableCell>{category.productCount}</TableCell><TableCell>{fmt(category.revenue)}</TableCell><TableCell>{category.avgFit.toFixed(0)}%</TableCell></TableRow>))}</TableBody></Table></CardContent></Card></div></TabsContent>

        <TabsContent value="intelligence"><div className="grid gap-4 xl:grid-cols-2">{intelligenceCards.map((intel) => (<Card key={intel.product.name}><CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0"><div><CardTitle>{intel.product.name}</CardTitle><p className="text-sm text-muted-foreground mt-1">{intel.fitSummary}</p></div><Badge variant="outline">{intel.competitors.length} competitors</Badge></CardHeader><CardContent className="space-y-4"><div className="grid md:grid-cols-2 gap-4"><div className="space-y-2"><p className="text-sm font-medium">Standard performance benchmark</p>{intel.competitors.map((item) => <p key={`${intel.product.name}-${item.name}-performance`} className="text-sm text-muted-foreground">- {item.name}: {item.performance}</p>)}</div><div className="space-y-2"><p className="text-sm font-medium">How to improve fit</p>{intel.fitImprovementActions.map((item) => <p key={`${intel.product.name}-${item}`} className="text-sm text-muted-foreground">- {item}</p>)}</div></div><div className="space-y-2">{intel.competitors.map((competitor) => (<div key={`${intel.product.name}-${competitor.name}`} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium">{competitor.name}</p><Badge variant="secondary">{competitor.marketFit}% fit</Badge></div><p className="text-sm text-muted-foreground mt-1">Offer: {competitor.offer}</p><p className="text-sm text-muted-foreground mt-1">Fit gap: {competitor.fitGap}</p><p className="text-sm text-muted-foreground mt-1">Actions: {competitor.gainFitActions.join(' | ')}</p></div>))}</div></CardContent></Card>))}</div></TabsContent>

        <TabsContent value="fit"><div className="grid lg:grid-cols-3 gap-4">{snapshot.products.map((product) => { const signal = strategicSignals[product.name]; return (<Card key={product.name}><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>{product.name}</span><span className="text-base">{product.marketFitScore}%</span></CardTitle></CardHeader><CardContent className="space-y-3"><Progress value={product.marketFitScore} className="h-2" /><div className="space-y-1 text-sm"><p><span className="text-muted-foreground">Lifecycle:</span> {product.lifecycleLabel}</p><p><span className="text-muted-foreground">Positioning:</span> {product.positioning}</p><p><span className="text-muted-foreground">Margin:</span> {product.avgMargin.toFixed(1)}%</p></div>{signal ? <div className="rounded-lg border bg-muted/20 p-3 space-y-1"><p className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Search/analysis signal</p><p className="text-sm text-muted-foreground">{summarizeSignal(signal)}</p><p className="text-xs text-muted-foreground">Scenario: {signal.scenario} | Technology stage: {signal.technologyStage}</p></div> : null}</CardContent></Card>); })}</div></TabsContent>

        <TabsContent value="actions"><div className="grid xl:grid-cols-2 gap-4">{actionCards.map((action) => { const evaluation = evaluations[action.id]; return (<Card key={action.id}><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="text-lg">{action.title}</CardTitle><Badge variant={action.priority === 'high' ? 'destructive' : action.priority === 'medium' ? 'secondary' : 'outline'}>{action.priority.toUpperCase()}</Badge></div><p className="text-sm text-muted-foreground mt-1">{action.goal}</p></CardHeader><CardContent className="space-y-4"><div className="text-sm space-y-2"><p><span className="font-medium">Scenario:</span> {action.scenario}</p><p><span className="font-medium">Recommended move:</span> {action.recommendedMove}</p><p><span className="font-medium">Support content:</span> {action.supportContent}</p><p><span className="font-medium">Suggested script:</span> {action.script}</p></div><div className="space-y-2"><label className="text-sm font-medium">Field feedback / outcome</label><VoiceTextInput value={feedbackByAction[action.id] || ''} onChange={(value) => setFeedbackByAction((prev) => ({ ...prev, [action.id]: value }))} placeholder="Describe customer reaction, objections, or execution result" rows={3} /><div className="flex gap-2"><Button variant="outline" onClick={() => void persistActionTask(action, evaluation)}>Save to monitoring</Button><Button onClick={() => void handleEvaluateFeedback(action)}>Evaluate feedback</Button></div></div>{evaluation ? <div className="rounded-lg border bg-muted/20 p-4 space-y-2"><p className="text-sm font-medium flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Evaluation</p><p className="text-sm text-muted-foreground">{evaluation.evaluation}</p><p className="text-sm"><span className="font-medium">Adjustment:</span> {evaluation.scenarioAdjustment}</p><p className="text-sm"><span className="font-medium">Priority:</span> {evaluation.priority.toUpperCase()}</p></div> : null}</CardContent></Card>); })}</div></TabsContent>
      </Tabs>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Product knowledge quick links</CardTitle></CardHeader><CardContent className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{catalogProducts.filter((product) => product.productInfoUrl || product.productVideoUrl).map((product) => (<div key={`links-${product.name}`} className="rounded-lg border p-4 space-y-2"><p className="font-medium">{product.name}</p><div className="flex flex-wrap gap-2">{product.productInfoUrl ? <a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={product.productInfoUrl} target="_blank" rel="noreferrer">Product info <ExternalLink className="h-3.5 w-3.5" /></a> : null}{product.productVideoUrl ? <a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={product.productVideoUrl} target="_blank" rel="noreferrer">Video <ExternalLink className="h-3.5 w-3.5" /></a> : null}</div>{product.linkedReports?.length ? <p className="text-xs text-muted-foreground">Reports: {product.linkedReports.join(' | ')}</p> : null}</div>))}</CardContent></Card>
    </div>
  );
};

export default ProductStrategyPage;
