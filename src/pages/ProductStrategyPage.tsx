import { useMemo, useState } from 'react';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { toast } from '@/hooks/use-toast';
import { BarChart3, CheckCircle2, Lightbulb, Package, Sparkles, Target, TrendingUp } from 'lucide-react';
import { fmt } from '@/components/analysis360/AnalysisUtils';
import {
  ProductActionEvaluation,
  ProductPositionAction,
  buildProductPositioningActions,
  buildProductStrategySnapshot,
  evaluateProductActionFeedback,
} from '@/lib/productStrategy';

const ProductStrategyPage = () => {
  const { data, addTask, updateTask } = useData();
  const [feedbackByAction, setFeedbackByAction] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<Record<string, ProductActionEvaluation>>({});
  const [taskIdsByAction, setTaskIdsByAction] = useState<Record<string, string>>({});

  const snapshot = useMemo(() => buildProductStrategySnapshot({
    products: data.products,
    orders: data.orders,
    opportunities: data.opportunities,
  }), [data.products, data.orders, data.opportunities]);

  const actionCards = useMemo(
    () => buildProductPositioningActions(snapshot.products, data.companyProfile.company_name || 'your company'),
    [snapshot.products, data.companyProfile.company_name],
  );

  const topInnovation = snapshot.products.filter((product) => product.lifecycleLabel === 'Innovation').length;
  const commodityCount = snapshot.products.filter((product) => product.lifecycleLabel === 'Commodity').length;
  const avgFit = snapshot.products.length > 0
    ? snapshot.products.reduce((sum, product) => sum + product.marketFitScore, 0) / snapshot.products.length
    : 0;

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
          Commercial performance depends on what you sell and how the market perceives it. This workspace turns portfolio analysis into practical actions with goals, scripts, support content, and feedback-driven reprioritization.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Products Analyzed</p><p className="text-2xl font-bold">{snapshot.products.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Innovation Lines</p><p className="text-2xl font-bold text-primary">{topInnovation}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Commodity Lines</p><p className="text-2xl font-bold text-amber-600">{commodityCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Avg Market Fit</p><p className="text-2xl font-bold">{avgFit.toFixed(0)}%</p></CardContent></Card>
      </div>

      {snapshot.products.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Upload products, orders, or opportunities to activate lifecycle positioning, action planning, and feedback evaluation.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="actions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="portfolio" className="gap-1"><Package className="h-3.5 w-3.5" /> Portfolio</TabsTrigger>
            <TabsTrigger value="fit" className="gap-1"><Target className="h-3.5 w-3.5" /> Market Fit</TabsTrigger>
            <TabsTrigger value="actions" className="gap-1"><Lightbulb className="h-3.5 w-3.5" /> Action Playbook</TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio">
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
          </TabsContent>

          <TabsContent value="fit">
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
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
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
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default ProductStrategyPage;
