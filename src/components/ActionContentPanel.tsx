import { useState } from 'react';
import type { MonitoringTask, ActionContent, ActionResult, TaskPillar } from '@/store/DataStore';
import { useData } from '@/store/DataStore';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Target, Phone, Mail, Presentation, FileText, Save, Sparkles,
  CheckCircle, AlertTriangle, ArrowLeft, ClipboardList, Loader2, Wand2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const PILLAR_LABELS: Record<TaskPillar, string> = {
  general: 'General', p0: '360º Analysis', p1: 'Sales Architecture', p2: 'KAM',
  p3: 'After-Sales', p4: 'AI Sales', p5: 'Behavioral', p6: 'Product Strategy',
};

interface ActionContentPanelProps {
  task: MonitoringTask;
  onUpdateContent: (content: ActionContent) => void;
  onSaveResult: (result: ActionResult) => void;
  onBack: () => void;
}

const emptyContent: ActionContent = { goal: '', callScript: '', emailTemplate: '', presentationNotes: '' };

export function ActionContentPanel({ task, onUpdateContent, onSaveResult, onBack }: ActionContentPanelProps) {
  const { data } = useData();
  const [content, setContent] = useState<ActionContent>(task.actionContent || emptyContent);
  const [resultText, setResultText] = useState(task.actionResult?.outcome || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dirty, setDirty] = useState(false);

  const updateField = (field: keyof ActionContent, value: string) => {
    setContent(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSaveContent = () => {
    onUpdateContent(content);
    setDirty(false);
  };

  // ─── AI: Generate action content ───
  const handleGenerateContent = async () => {
    setIsGenerating(true);
    try {
      // Build context data from loaded company data
      const contextData: any = {};
      if (data.orders.length > 0) {
        const customerRevenue: Record<string, number> = {};
        const productRevenue: Record<string, number> = {};
        data.orders.forEach(o => {
          customerRevenue[o.customerName] = (customerRevenue[o.customerName] || 0) + o.sellingPrice;
          productRevenue[o.productFamily] = (productRevenue[o.productFamily] || 0) + o.sellingPrice;
        });
        contextData.topCustomers = Object.entries(customerRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v]) => `${n} (€${v.toLocaleString()})`).join(', ');
        contextData.topProducts = Object.entries(productRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v]) => `${n} (€${v.toLocaleString()})`).join(', ');
      }
      if (data.opportunities.length > 0) {
        const totalPipeline = data.opportunities.filter(o => o.status !== 'Won' && o.status !== 'Lost').reduce((s, o) => s + o.estRevenue, 0);
        contextData.pipelineValue = `€${totalPipeline.toLocaleString()}`;
      }
      if (data.strategy.length > 0) {
        const totalTarget = data.strategy.reduce((s, st) => s + st.estRevenue, 0);
        contextData.strategyTargets = `Total target: €${totalTarget.toLocaleString()}`;
      }

      const { data: result, error } = await supabase.functions.invoke('generate-action-content', {
        body: {
          type: 'generate',
          task: { title: task.title, description: task.description, category: task.category, pillar: task.pillar, priority: task.priority, assignee: task.assignee },
          companyProfile: data.companyProfile,
          contextData,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const generated: ActionContent = {
        goal: result.goal || content.goal,
        callScript: result.callScript || content.callScript,
        emailTemplate: result.emailTemplate || content.emailTemplate,
        presentationNotes: result.presentationNotes || content.presentationNotes,
      };
      setContent(generated);
      setDirty(true);
      toast({ title: 'AI content generated', description: 'Review and customize the generated content before saving.' });
    } catch (e: any) {
      console.error('AI generation error:', e);
      toast({ title: 'AI generation failed', description: e.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── AI: Analyze result ───
  const handleAnalyzeResult = async () => {
    if (!resultText.trim()) return;
    setIsAnalyzing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('generate-action-content', {
        body: {
          type: 'analyze',
          task: { ...task, resultText, actionContent: content },
          companyProfile: data.companyProfile,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const analysisResult: ActionResult = {
        outcome: resultText,
        timestamp: new Date().toISOString(),
        aiAnalysis: result.aiAnalysis || 'Analysis completed.',
        alignmentScore: result.alignmentScore ?? 50,
        recommendations: result.recommendations || [],
      };
      onSaveResult(analysisResult);
      toast({ title: 'Result analyzed and saved' });
    } catch (e: any) {
      console.error('AI analysis error:', e);
      toast({ title: 'AI analysis failed', description: e.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const result = task.actionResult;
  const completionFields = [content.goal, content.callScript, content.emailTemplate, content.presentationNotes];
  const filledCount = completionFields.filter(f => f.trim().length > 0).length;
  const preparedness = (filledCount / completionFields.length) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-[10px]">{PILLAR_LABELS[task.pillar]}</Badge>
            <Badge variant={task.priority === 'critical' || task.priority === 'high' ? 'destructive' : 'default'} className="text-[10px]">
              {task.priority}
            </Badge>
          </div>
          <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>
          {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
        </div>
        <Button onClick={handleGenerateContent} disabled={isGenerating} className="gap-2" variant="outline">
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {isGenerating ? 'Generating...' : 'AI Generate All'}
        </Button>
      </div>

      {/* Preparedness Bar */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Action Preparedness
            </span>
            <span className="text-sm font-bold text-foreground">{preparedness.toFixed(0)}%</span>
          </div>
          <Progress value={preparedness} className="h-2" />
          <p className="text-[11px] text-muted-foreground mt-1">
            {filledCount}/{completionFields.length} content sections completed — the more you prepare, the higher your success rate.
          </p>
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="goal">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="goal" className="text-xs gap-1"><Target className="h-3 w-3" /> Goal</TabsTrigger>
          <TabsTrigger value="script" className="text-xs gap-1"><Phone className="h-3 w-3" /> Script</TabsTrigger>
          <TabsTrigger value="email" className="text-xs gap-1"><Mail className="h-3 w-3" /> Email</TabsTrigger>
          <TabsTrigger value="presentation" className="text-xs gap-1"><Presentation className="h-3 w-3" /> Slides</TabsTrigger>
          <TabsTrigger value="result" className="text-xs gap-1"><FileText className="h-3 w-3" /> Result</TabsTrigger>
        </TabsList>

        {/* Goal Tab */}
        <TabsContent value="goal">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Action Goal & Objective
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Define the specific objective of this action. What outcome do you need? What metrics define success?
              </p>
              <VoiceTextInput
                rows={5}
                placeholder="Example: Schedule a product demo with the procurement team at Acme Corp. Goal is to present our new pricing model and get a verbal commitment for a pilot program by end of Q2."
                value={content.goal}
                onChange={v => updateField('goal', v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Call Script Tab */}
        <TabsContent value="script">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" /> Call / Conversation Script
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Structured script for calls or meetings. Include opening, key talking points, objection handling, and closing.
              </p>
              <VoiceTextInput
                rows={12}
                placeholder="Opening, key talking points, objection handling, closing..."
                value={content.callScript}
                onChange={v => updateField('callScript', v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Template Tab */}
        <TabsContent value="email">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Email Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Draft the email including subject line, body, and call-to-action personalized for the target audience.
              </p>
              <VoiceTextInput
                rows={12}
                placeholder="Subject line, body, call-to-action..."
                value={content.emailTemplate}
                onChange={v => updateField('emailTemplate', v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Presentation Tab */}
        <TabsContent value="presentation">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Presentation className="h-4 w-4 text-primary" /> Presentation & Meeting Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Key slides, demo flow, meeting agenda, data points, and handout materials.
              </p>
              <VoiceTextInput
                rows={12}
                placeholder="Meeting agenda, key slides, materials..."
                value={content.presentationNotes}
                onChange={v => updateField('presentationNotes', v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Result Tab */}
        <TabsContent value="result">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Action Result & AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-medium">What was the outcome of this action?</Label>
                <VoiceTextInput
                  rows={5}
                  placeholder="Describe the result: what happened during the call/meeting/email? What did the customer say? What was agreed?"
                  value={resultText}
                  onChange={v => setResultText(v)}
                />
                <Button
                  className="mt-3 gap-2"
                  onClick={handleAnalyzeResult}
                  disabled={!resultText.trim() || isAnalyzing}
                >
                  {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isAnalyzing ? 'Analyzing...' : 'Save & Analyze Result'}
                </Button>
              </div>

              {result && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    {/* Alignment Score */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">Strategy Alignment</span>
                        <span className={`text-sm font-bold ${result.alignmentScore >= 70 ? 'text-success' : result.alignmentScore >= 40 ? 'text-warning' : 'text-destructive'}`}>
                          {result.alignmentScore}%
                        </span>
                      </div>
                      <Progress value={result.alignmentScore} className="h-2" />
                    </div>

                    {/* AI Analysis */}
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">AI Agent Analysis</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{result.aiAnalysis}</p>
                    </div>

                    {/* Recommendations */}
                    {result.recommendations.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          {result.alignmentScore >= 70
                            ? <CheckCircle className="h-4 w-4 text-success" />
                            : <AlertTriangle className="h-4 w-4 text-warning" />}
                          Recommended Next Actions
                        </h4>
                        <ul className="space-y-2">
                          {result.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="text-primary font-bold mt-0.5">→</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground">
                      Analyzed on {new Date(result.timestamp).toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      {dirty && (
        <div className="flex justify-end">
          <Button onClick={handleSaveContent} className="gap-2">
            <Save className="h-4 w-4" /> Save Action Content
          </Button>
        </div>
      )}
    </div>
  );
}
