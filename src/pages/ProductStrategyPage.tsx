import { useEffect, useMemo, useState } from 'react';
import { useData, type ProductRecord } from '@/store/DataStore';
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
import { BarChart3, CheckCircle2, Lightbulb, Package, Search, Sparkles, Target, TrendingUp } from 'lucide-react';
import { fmt } from '@/components/analysis360/AnalysisUtils';
import {
  ProductActionEvaluation,
  ProductPositionAction,
  buildProductPositioningActions,
  buildProductStrategySnapshot,
  evaluateProductActionFeedback,
} from '@/lib/productStrategy';
import { runProductAnalysisAgent, runProductSearchAgent } from '@/agents/productCatalogAgents';

type CatalogDraft = ProductRecord & { draftId: string };

const toDraft = (product: ProductRecord): CatalogDraft => ({
  ...product,
  draftId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  category: product.category || (product.type.toLowerCase().includes('service') ? 'service' : 'product'),
  characteristics: product.characteristics || [],
  estimatedCost: product.estimatedCost || 0,
  repositories: product.repositories || [],
  validated: Boolean(product.validated),
  source: product.source || 'manual',
});

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
});

const ProductStrategyPage = () => {
  const { data, addTask, updateTask, setProducts } = useData();
  const [feedbackByAction, setFeedbackByAction] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<Record<string, ProductActionEvaluation>>({});
  const [taskIdsByAction, setTaskIdsByAction] = useState<Record<string, string>>({});
  const [catalogDrafts, setCatalogDrafts] = useState<CatalogDraft[]>([]);

  useEffect(() => {
    setCatalogDrafts(data.products.map(toDraft));
  }, [data.products]);

  const catalogProducts = useMemo(
    () => catalogDrafts.map(normalizeDraft).filter((product) => product.name),
    [catalogDrafts],
  );

  const snapshot = useMemo(() => buildProductStrategySnapshot({
    products: catalogProducts,
    orders: data.orders,
    opportunities: data.opportunities,
  }), [catalogProducts, data.orders, data.opportunities]);

  const actionCards = useMemo(
    () => buildProductPositioningActions(snapshot.products, data.companyProfile.company_name || 'your company'),
    [snapshot.products, data.companyProfile.company_name],
  );

  const strategicSignals = useMemo(
    () => catalogProducts.map((product) => ({
      product,
      signal: runProductAnalysisAgent(product),
    })),
    [catalogProducts],
  );

  const topInnovation = snapshot.products.filter((product) => product.lifecycleLabel === 'Innovation').length;
  const commodityCount = snapshot.products.filter((product) => product.lifecycleLabel === 'Commodity').length;
  const avgFit = snapshot.products.length > 0
    ? snapshot.products.reduce((sum, product) => sum + product.marketFitScore, 0) / snapshot.products.length
    : 0;

  const updateDraft = (draftId: string, field: keyof CatalogDraft, value: unknown) => {
    setCatalogDrafts((prev) => prev.map((draft) => (draft.draftId === draftId ? { ...draft, [field]: value } : draft)));
  };

  const addCatalogItem = (category: 'product' | 'service') => {
    setCatalogDrafts((prev) => [...prev, toDraft({
      name: '',
      averageValue: 0,
      type: category === 'service' ? 'service model' : 'equipment',
      comments: '',
      category,
      characteristics: [],
      estimatedCost: 0,
      repositories: [],
      validated: false,
      source: 'manual',
    })]);
  };

  const removeCatalogItem = (draftId: string) => {
    setCatalogDrafts((prev) => prev.filter((draft) => draft.draftId !== draftId));
  };

  const generateCatalog = () => {
    const suggestions = runProductSearchAgent({
      products: catalogProducts,
      orders: data.orders,
      opportunities: data.opportunities,
    });

    if (suggestions.length === 0) {
      toast({ title: 'No new suggestions', description: 'Search agent did not find additional lines to add.' });
      return;
    }

    setCatalogDrafts((prev) => [...prev, ...suggestions.map(toDraft)]);
    toast({ title: 'Catalog suggestions ready', description: `${suggestions.length} auto-generated items were added for validation.` });
  };

  const saveCatalog = async () => {
    const cleanRecords = catalogProducts.filter((product) => product.name.trim().length > 0);
    await setProducts(cleanRecords);
    toast({ title: 'Catalog saved', description: `${cleanRecords.length} products/services are now available for offer selection.` });
  };

  const persistActionTask = async (action: ProductPositionAction, evaluation?: ProductActionEvaluation) => {
    const existingId = taskIdsByAction[action.id];
    const feedback = feedbackByAction[action.id]?.trim();

    try {
      if (existingId) {
        await updateTask(existingId, {
          priority: evaluation?.priority || action.priority,
          notes: [
            `Scenario: ${action.scenario}`,
            feedback ? `Feedback: ${feedback}` : 'Feedback: pending',
            evaluation?.evaluation || 'Evaluation not run yet.',
          ],
          actionResult: evaluation ? {
            outcome: 'Feedback evaluation completed',
            timestamp: new Date().toISOString(),
            aiAnalysis: evaluation.evaluation,
            alignmentScore: evaluation.priority === 'high' ? 90 : evaluation.priority === 'medium' ? 75 : 60,
            recommendations: [evaluation.scenarioAdjustment],
          } : undefined,
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
        notes: [
          `Scenario: ${action.scenario}`,
          `Recommended move: ${action.recommendedMove}`,
          feedback ? `Feedback: ${feedback}` : 'Feedback: pending',
        ],
        actionContent: {
          goal: action.goal,
          callScript: action.script,
          emailTemplate: `Subject: Positioning review for ${action.productName}\n\n${action.supportContent}`,
          presentationNotes: action.supportContent,
        },
        actionResult: evaluation ? {
          outcome: 'Initial feedback captured',
          timestamp: new Date().toISOString(),
          aiAnalysis: evaluation.evaluation,
          alignmentScore: evaluation.priority === 'high' ? 90 : evaluation.priority === 'medium' ? 75 : 60,
          recommendations: [evaluation.scenarioAdjustment],
        } : undefined,
      });

      setTaskIdsByAction((prev) => ({ ...prev, [action.id]: taskId }));
      toast({ title: 'Monitoring task created', description: `${action.title} is now part of the action plan.` });
    } catch (error) {
      console.error('Unable to persist product action', error);
      toast({
        title: 'Could not save action',
        description: 'The recommendation remains visible here, but it was not saved to monitoring.',
        variant: 'destructive',
      });
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
          <Badge variant="outline">Product &amp; Value Positioning Strategy</Badge>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Product &amp; Value Positioning Strategy</h2>
        <p className="text-muted-foreground text-sm mt-1 max-w-3xl">
          Build and validate your products/services catalog, enrich it with analysis/search agents, and convert it into lifecycle positioning and offer-ready actions.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Products/Services</p><p className="text-2xl font-bold">{catalogProducts.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Innovation Lines</p><p className="text-2xl font-bold text-primary">{topInnovation}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Commodity Lines</p><p className="text-2xl font-bold text-amber-600">{commodityCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Avg Market Fit</p><p className="text-2xl font-bold">{avgFit.toFixed(0)}%</p></CardContent></Card>
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog" className="gap-1"><Package className="h-3.5 w-3.5" /> Catalog Workspace</TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-1"><Package className="h-3.5 w-3.5" /> Portfolio</TabsTrigger>
          <TabsTrigger value="fit" className="gap-1"><Target className="h-3.5 w-3.5" /> Market Fit</TabsTrigger>
          <TabsTrigger value="actions" className="gap-1"><Lightbulb className="h-3.5 w-3.5" /> Action Playbook</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>Products & Services Catalog</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={generateCatalog}><Search className="h-4 w-4 mr-1" /> Generate with agents</Button>
                  <Button size="sm" onClick={saveCatalog}><CheckCircle2 className="h-4 w-4 mr-1" /> Save catalog</Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Add products/services with characteristics, estimated costs, and repositories. Auto-generated items stay editable until validated.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => addCatalogItem('product')}>Add product</Button>
                <Button variant="outline" size="sm" onClick={() => addCatalogItem('service')}>Add service</Button>
              </div>

              {catalogDrafts.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center border rounded-md">No catalog items yet. Add manually or generate with agents.</div>
              ) : (
                <div className="space-y-3">
                  {catalogDrafts.map((item) => (
                    <div key={item.draftId} className="border rounded-md p-3 space-y-3">
                      <div className="grid md:grid-cols-5 gap-3">
                        <div className="md:col-span-2">
                          <label className="text-xs text-muted-foreground">Name</label>
                          <Input value={item.name} onChange={(event) => updateDraft(item.draftId, 'name', event.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Category</label>
                          <Select value={item.category} onValueChange={(value) => updateDraft(item.draftId, 'category', value as 'product' | 'service')}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="product">Product</SelectItem>
                              <SelectItem value="service">Service</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Average value</label>
                          <Input type="number" value={item.averageValue} onChange={(event) => updateDraft(item.draftId, 'averageValue', Number(event.target.value))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Estimated cost</label>
                          <Input type="number" value={item.estimatedCost} onChange={(event) => updateDraft(item.draftId, 'estimatedCost', Number(event.target.value))} />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Type / lifecycle signal</label>
                          <Input value={item.type} onChange={(event) => updateDraft(item.draftId, 'type', event.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Repositories (comma-separated)</label>
                          <Input
                            value={(item.repositories || []).join(', ')}
                            onChange={(event) => updateDraft(item.draftId, 'repositories', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))}
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Characteristics (comma-separated)</label>
                          <Input
                            value={(item.characteristics || []).join(', ')}
                            onChange={(event) => updateDraft(item.draftId, 'characteristics', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Notes</label>
                          <Textarea value={item.comments} rows={2} onChange={(event) => updateDraft(item.draftId, 'comments', event.target.value)} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <Checkbox checked={item.validated} onCheckedChange={(checked) => updateDraft(item.draftId, 'validated', checked === true)} />
                          Validated for offer selection
                          <Badge variant="outline" className="ml-2">Source: {item.source || 'manual'}</Badge>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeCatalogItem(item.draftId)}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {strategicSignals.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Analysis + Search Agent Strategic Signals</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Product/Service</TableHead>
                    <TableHead className="text-xs">Innovation vs commodity</TableHead>
                    <TableHead className="text-xs">Offer model</TableHead>
                    <TableHead className="text-xs">Technology stage</TableHead>
                    <TableHead className="text-xs">Competes on</TableHead>
                    <TableHead className="text-xs">Recommended scenario</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {strategicSignals.map(({ product, signal }) => (
                      <TableRow key={product.name}>
                        <TableCell className="text-xs font-medium">{product.name}</TableCell>
                        <TableCell className="text-xs capitalize">{signal.lifecycleSignal}</TableCell>
                        <TableCell className="text-xs capitalize">{signal.offerModel}</TableCell>
                        <TableCell className="text-xs capitalize">{signal.technologyStage}</TableCell>
                        <TableCell className="text-xs capitalize">{signal.competitionFocus}</TableCell>
                        <TableCell className="text-xs capitalize">{signal.scenario}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="portfolio">
          {snapshot.products.length === 0 ? (
            <Card><CardContent className="py-10 text-sm text-muted-foreground text-center">Add or generate catalog items to activate portfolio analysis.</CardContent></Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Lifecycle Positioning Matrix</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-xs">Lifecycle</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs text-right">Pipeline</TableHead>
                    <TableHead className="text-xs text-right">Margin</TableHead>
                    <TableHead className="text-xs">Position</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {snapshot.products.map((product) => (
                      <TableRow key={product.name}>
                        <TableCell className="text-xs font-medium">{product.name}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={product.lifecycleLabel === 'Innovation' ? 'default' : product.lifecycleLabel === 'Commodity' ? 'secondary' : 'outline'}>
                            {product.lifecycleLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right">{fmt(product.revenue)}</TableCell>
                        <TableCell className="text-xs text-right">{fmt(product.pipeline)}</TableCell>
                        <TableCell className="text-xs text-right">{product.avgMargin.toFixed(1)}%</TableCell>
                        <TableCell className="text-xs">{product.positioning}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fit">
          {snapshot.products.length === 0 ? (
            <Card><CardContent className="py-10 text-sm text-muted-foreground text-center">Market-fit scoring appears once products/services are in the catalog.</CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {snapshot.products.map((product) => (
                <Card key={product.name}>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> {product.name}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Market fit score</span>
                      <span className="font-medium">{product.marketFitScore.toFixed(0)}%</span>
                    </div>
                    <Progress value={product.marketFitScore} className="h-2" />
                    <p className="text-xs text-muted-foreground">Weighted pipeline: {fmt(product.weightedPipeline)}</p>
                    <p className="text-xs text-muted-foreground">Notes: {product.notes || 'No additional notes provided.'}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          {snapshot.products.length === 0 ? (
            <Card><CardContent className="py-10 text-sm text-muted-foreground text-center">Action playbook activates after adding products/services to the catalog.</CardContent></Card>
          ) : (
            <>
              <div className="grid lg:grid-cols-3 gap-4">
                <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Scale</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Push high-fit offers with consultative value-selling and proof-based expansion.</CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Optimize</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Improve market coverage, pricing logic, and route-to-market for core products.</CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Re-evaluate</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Use voice or written feedback to change priority and trigger new scenarios when the market says so.</CardContent></Card>
              </div>

              <div className="grid xl:grid-cols-2 gap-4">
                {actionCards.map((action) => {
                  const evaluation = evaluations[action.id];
                  return (
                    <Card key={action.id} className="border-primary/10">
                      <CardHeader className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <CardTitle className="text-base">{action.title}</CardTitle>
                          <div className="flex gap-2">
                            <Badge variant={action.priority === 'high' ? 'destructive' : action.priority === 'medium' ? 'default' : 'secondary'}>
                              {evaluation?.priority || action.priority} priority
                            </Badge>
                            <Badge variant="outline">{action.scenario}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{action.recommendedMove}</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-md border bg-muted/20 p-3 space-y-2 text-xs">
                          <div>
                            <p className="font-semibold text-foreground">Goal</p>
                            <p className="text-muted-foreground">{action.goal}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Support content</p>
                            <p className="text-muted-foreground whitespace-pre-line">{action.supportContent}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Commercial script</p>
                            <p className="text-muted-foreground whitespace-pre-line">{action.script}</p>
                          </div>
                        </div>

                        <VoiceTextInput
                          label="Field feedback"
                          value={feedbackByAction[action.id] || ''}
                          onChange={(value) => setFeedbackByAction((prev) => ({ ...prev, [action.id]: value }))}
                          placeholder="Add voice or written feedback from the market. Example: price pressure is high and customers want a stronger service-value offer."
                          rows={4}
                        />

                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => handleEvaluateFeedback(action)}>Evaluate feedback</Button>
                          <Button variant="outline" onClick={() => persistActionTask(action, evaluation)}>
                            {taskIdsByAction[action.id] ? 'Update monitoring task' : 'Create monitoring task'}
                          </Button>
                        </div>

                        {evaluation && (
                          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2 text-xs">
                            <div className="flex items-center gap-2 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" /> Feedback impact
                            </div>
                            <p className="text-muted-foreground">{evaluation.evaluation}</p>
                            <p><span className="font-medium">Scenario update:</span> {evaluation.scenarioAdjustment}</p>
                            {evaluation.newActionNeeded && (
                              <p><span className="font-medium">Follow-up needed:</span> {evaluation.suggestedActionTitle || 'A new action should be added to the plan.'}</p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductStrategyPage;
