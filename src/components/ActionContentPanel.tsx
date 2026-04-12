import { useState } from 'react';
import type { MonitoringTask, ActionContent, ActionResult, TaskPillar } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Target, Phone, Mail, Presentation, FileText, Save, Sparkles,
  CheckCircle, AlertTriangle, ArrowLeft, ClipboardList
} from 'lucide-react';

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
  const [content, setContent] = useState<ActionContent>(task.actionContent || emptyContent);
  const [resultText, setResultText] = useState(task.actionResult?.outcome || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dirty, setDirty] = useState(false);

  const updateField = (field: keyof ActionContent, value: string) => {
    setContent(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSaveContent = () => {
    onUpdateContent(content);
    setDirty(false);
  };

  const handleAnalyzeResult = () => {
    if (!resultText.trim()) return;
    setIsAnalyzing(true);
    // Local AI simulation — will be replaced with real AI agent when cloud is enabled
    setTimeout(() => {
      const hasGoal = !!content.goal;
      const resultLower = resultText.toLowerCase();
      const recommendations: string[] = [];
      let alignmentScore = 50;

      if (hasGoal) {
        const goalWords = content.goal.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const matchCount = goalWords.filter(w => resultLower.includes(w)).length;
        alignmentScore = Math.min(100, Math.round((matchCount / Math.max(goalWords.length, 1)) * 100 + 30));
      }

      if (resultLower.includes('no answer') || resultLower.includes('not available') || resultLower.includes('no response')) {
        recommendations.push('Schedule a follow-up within 48 hours using a different channel (email if call failed, or vice versa).');
        alignmentScore = Math.max(20, alignmentScore - 20);
      }
      if (resultLower.includes('interested') || resultLower.includes('positive')) {
        recommendations.push('Prepare a tailored proposal emphasizing the value proposition discussed.');
        recommendations.push('Schedule a formal meeting within the next 5 business days to capitalize on momentum.');
        alignmentScore = Math.min(100, alignmentScore + 15);
      }
      if (resultLower.includes('objection') || resultLower.includes('concern') || resultLower.includes('price')) {
        recommendations.push('Prepare a competitive analysis document addressing the specific objections raised.');
        recommendations.push('Consider offering a pilot program or adjusted payment terms to mitigate risk perception.');
      }
      if (resultLower.includes('meeting') || resultLower.includes('scheduled') || resultLower.includes('next step')) {
        recommendations.push('Prepare presentation materials aligned with the customer\'s specific pain points.');
        alignmentScore = Math.min(100, alignmentScore + 10);
      }
      if (resultLower.includes('lost') || resultLower.includes('rejected') || resultLower.includes('competitor')) {
        recommendations.push('Document lessons learned and share with the team for strategy refinement.');
        recommendations.push('Analyze competitor positioning and update the value proposition for similar accounts.');
        alignmentScore = Math.max(10, alignmentScore - 25);
      }
      if (recommendations.length === 0) {
        recommendations.push('Document specific outcomes and next steps for this action.');
        recommendations.push('Review if the action goal was fully addressed and plan any follow-up needed.');
      }

      const analysis = alignmentScore >= 70
        ? `Strong alignment with strategy. The outcome indicates progress toward the defined goal. ${task.pillar !== 'general' ? `This action contributes positively to the ${PILLAR_LABELS[task.pillar]} pillar objectives.` : ''}`
        : alignmentScore >= 40
        ? `Partial alignment. The result shows some progress but additional actions may be needed to fully meet the strategic objective. Consider adjusting the approach based on the recommendations below.`
        : `Low alignment with strategy. The outcome suggests significant deviation from the planned goal. Immediate review and corrective actions are recommended to realign with the commercial strategy.`;

      const result: ActionResult = {
        outcome: resultText,
        timestamp: new Date().toISOString(),
        aiAnalysis: analysis,
        alignmentScore,
        recommendations,
      };
      onSaveResult(result);
      setIsAnalyzing(false);
    }, 1200);
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
              <Textarea
                rows={5}
                placeholder="Example: Schedule a product demo with the procurement team at Acme Corp. Goal is to present our new pricing model and get a verbal commitment for a pilot program by end of Q2. Success = meeting scheduled + agenda confirmed."
                value={content.goal}
                onChange={e => updateField('goal', e.target.value)}
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
                Prepare a structured script for calls or face-to-face meetings. Include opening, key talking points, objection handling, and closing.
              </p>
              <Textarea
                rows={12}
                placeholder={`Opening:
"Good morning [Name], this is [Your Name] from [Company]. I'm calling because we've been analyzing opportunities in [their sector] and I believe we can help you with [specific pain point]."

Key Talking Points:
1. Reference their current situation / recent news
2. Present the value proposition specific to their needs
3. Share a relevant success story from a similar company

Objection Handling:
• "Too expensive" → Focus on ROI and total cost of ownership
• "Already have a provider" → Ask about satisfaction level and gaps
• "Not the right time" → Plant the seed for future follow-up

Close:
"Based on what we've discussed, I'd like to propose a brief 30-minute meeting where I can show you exactly how this would work for [their company]. Would [date] or [date] work for you?"`}
                value={content.callScript}
                onChange={e => updateField('callScript', e.target.value)}
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
                Draft the email for this action. Include subject line, body, and call-to-action. Personalize for the target audience.
              </p>
              <Textarea
                rows={12}
                placeholder={`Subject: [Personalized subject line]

Dear [Name],

[Opening paragraph — reference something specific to them]

[Value proposition paragraph — what you're offering and why it matters to them]

[Social proof — brief success story or metric from a similar client]

[Call to action — specific next step with proposed dates/times]

Best regards,
[Your name]
[Your title]
[Contact info]`}
                value={content.emailTemplate}
                onChange={e => updateField('emailTemplate', e.target.value)}
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
                Outline key slides, demo flow, or meeting agenda. Include data points, visuals to prepare, and handout materials.
              </p>
              <Textarea
                rows={12}
                placeholder={`Meeting Agenda:
1. Introduction & rapport building (5 min)
2. Discovery — confirm their challenges (10 min)
3. Solution presentation (15 min)
4. Case study / ROI demonstration (10 min)
5. Q&A and objection handling (10 min)
6. Next steps & close (5 min)

Key Slides to Prepare:
• Company overview (tailored to their industry)
• Problem statement specific to their segment
• Solution architecture diagram
• ROI calculator with their numbers
• Implementation timeline
• Customer success stories from their sector

Materials to Bring:
• Printed proposal summary
• Product datasheet
• Reference customer contacts`}
                value={content.presentationNotes}
                onChange={e => updateField('presentationNotes', e.target.value)}
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
                <Textarea
                  rows={5}
                  className="mt-1"
                  placeholder="Describe the result: what happened during the call/meeting/email? What did the customer say? What was agreed? Any objections or concerns raised?"
                  value={resultText}
                  onChange={e => setResultText(e.target.value)}
                />
                <Button
                  className="mt-3 gap-2"
                  onClick={handleAnalyzeResult}
                  disabled={!resultText.trim() || isAnalyzing}
                >
                  <Sparkles className="h-4 w-4" />
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
