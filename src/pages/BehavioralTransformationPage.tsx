import { useMemo } from 'react';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Activity, Brain, Heart, Lightbulb, ShieldAlert, Target, Users } from 'lucide-react';
import { isNeglectedStatus, isOpenOpportunityStatus } from '@/lib/salesData';

const BehavioralTransformationPage = () => {
  const { data } = useData();
  const { opportunities, tasks, companyProfile } = data;

  const metrics = useMemo(() => {
    const openOpps = opportunities.filter((opp) => isOpenOpportunityStatus(opp.status));
    const neglected = opportunities.filter((opp) => isNeglectedStatus(opp.status));
    const adminTasks = tasks.filter((task) => ['report', 'meeting', 'data'].includes(task.category)).length;
    const valueTasks = tasks.filter((task) => ['follow_up', 'cross_sell', 'strategy', 'loyalty'].includes(task.category)).length;
    const overdue = tasks.filter((task) => task.status !== 'done' && task.dueDate && new Date(task.dueDate) < new Date()).length;
    const proactiveScore = Math.max(0, Math.min(100,
      55 + (valueTasks * 6) - (adminTasks * 5) - (neglected.length * 8) - (overdue * 4)
    ));

    return {
      openOpps: openOpps.length,
      neglected: neglected.length,
      overdue,
      adminTasks,
      valueTasks,
      proactiveScore,
      reactiveScore: 100 - proactiveScore,
    };
  }, [opportunities, tasks]);

  const leadershipActions = [
    'Set a weekly pipeline discipline meeting focused on opportunity movement and customer value, not reporting volume.',
    'Limit internal reporting and approval loops so commercial teams spend more time with customers.',
    'Coach managers to review strategic account plans, not only monthly numbers.',
    'Align incentives with proactive behaviors: hunting, account planning, cross-sell, and follow-up quality.',
  ];

  const aiLevers = [
    'Automate reporting and meeting prep so sales time shifts from internal administration to customer contact.',
    'Use AI to pre-build account briefs, follow-up emails, proposal drafts, and opportunity prioritization.',
    'Monitor neglected opportunities and overdue actions automatically.',
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">Pillar 5</span>
          <Badge variant="outline">Behavioral Transformation</Badge>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Behavioral Transformation</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Transform reactive teams into proactive commercial teams through coaching, incentives, accountability, and AI-supported discipline.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Proactive Score</p><p className="text-2xl font-bold text-primary">{metrics.proactiveScore}%</p><Progress value={metrics.proactiveScore} className="h-1.5 mt-2" /></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Reactive Load</p><p className="text-2xl font-bold text-amber-600">{metrics.reactiveScore}%</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Admin Tasks</p><p className="text-2xl font-bold">{metrics.adminTasks}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Neglected Deals</p><p className="text-2xl font-bold text-destructive">{metrics.neglected}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="diagnostic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diagnostic" className="gap-1"><Activity className="h-3.5 w-3.5" /> Diagnostic</TabsTrigger>
          <TabsTrigger value="coaching" className="gap-1"><Users className="h-3.5 w-3.5" /> Coaching</TabsTrigger>
          <TabsTrigger value="incentives" className="gap-1"><Target className="h-3.5 w-3.5" /> Incentives</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1"><Brain className="h-3.5 w-3.5" /> AI Support</TabsTrigger>
        </TabsList>

        <TabsContent value="diagnostic">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" /> Reactive Behaviors Detected</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>Open opportunities: {metrics.openOpps}</p>
                <p>Neglected opportunities: {metrics.neglected}</p>
                <p>Overdue commercial tasks: {metrics.overdue}</p>
                <p>Administrative workload proxies: {metrics.adminTasks} tasks</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> Desired Proactive Mode</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>Opportunity hunting and strategic account planning</p>
                <p>Value selling and systematic pipeline management</p>
                <p>More customer-facing time and less internal friction</p>
                <p>Leadership coaching and clear commercial accountability</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="coaching">
          <Card>
            <CardHeader><CardTitle className="text-base">Leadership Coaching Priorities</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {leadershipActions.map((item) => (
                <div key={item} className="border rounded-lg p-3 text-xs text-muted-foreground">{item}</div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incentives">
          <div className="grid lg:grid-cols-3 gap-4">
            <Card><CardHeader><CardTitle className="text-base">What to reward</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground space-y-2"><p>• Qualified opportunity creation</p><p>• Cross-sell growth in installed base</p><p>• Strategic account planning quality</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">What to reduce</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground space-y-2"><p>• Meeting-heavy routines</p><p>• Excessive approval chains</p><p>• Reporting that does not drive action</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">90-day shift</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground space-y-2"><p>• Simplify process rules</p><p>• Clarify decision authority</p><p>• Measure customer-facing activity weekly</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader><CardTitle className="text-base">AI as a Productivity Multiplier</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {aiLevers.map((item) => (
                <div key={item} className="border rounded-lg p-3 text-xs text-muted-foreground">{item}</div>
              ))}
              <div className="pt-2 text-xs text-foreground font-medium">
                Goal for {companyProfile.company_name || 'the team'}: keep the organization externally focused on markets and customers, not trapped in internal systems.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BehavioralTransformationPage;
