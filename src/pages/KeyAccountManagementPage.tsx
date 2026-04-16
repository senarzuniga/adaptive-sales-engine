import { useMemo } from 'react';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Network, Target, TrendingUp, Users, ShieldCheck, Lightbulb } from 'lucide-react';
import { fmt } from '@/components/analysis360/AnalysisUtils';
import { isNeglectedStatus, isOpportunityCoveredByOrder, isOpenOpportunityStatus } from '@/lib/salesData';

type AccountRecord = {
  customer: string;
  revenue: number;
  pipeline: number;
  weightedPipeline: number;
  avgProb: number;
  neglected: number;
  kamOwner: string;
  regions: string[];
  products: string[];
  score: number;
  tier: 'Strategic' | 'Growth' | 'Watchlist';
};

const KeyAccountManagementPage = () => {
  const { data } = useData();
  const { orders, opportunities, companyProfile } = data;

  const accounts = useMemo<AccountRecord[]>(() => {
    const map = new Map<string, AccountRecord>();

    const ensure = (name: string) => {
      if (!map.has(name)) {
        map.set(name, {
          customer: name,
          revenue: 0,
          pipeline: 0,
          weightedPipeline: 0,
          avgProb: 0,
          neglected: 0,
          kamOwner: '',
          regions: [],
          products: [],
          score: 0,
          tier: 'Watchlist',
        });
      }
      return map.get(name)!;
    };

    orders.forEach((order) => {
      const name = order.customerName || 'Unknown account';
      const record = ensure(name);
      record.revenue += order.sellingPrice || 0;
      if (order.kam && !record.kamOwner) record.kamOwner = order.kam;
      if (order.region && !record.regions.includes(order.region)) record.regions.push(order.region);
      if (order.productFamily && !record.products.includes(order.productFamily)) record.products.push(order.productFamily);
    });

    opportunities.forEach((opp) => {
      const name = opp.customerName || 'Unknown account';
      const record = ensure(name);
      if (isOpenOpportunityStatus(opp.status) && !isOpportunityCoveredByOrder(opp, orders)) {
        record.pipeline += opp.estRevenue || 0;
        record.weightedPipeline += (opp.estRevenue || 0) * ((opp.contractProb || 0) / 100);
      }
      if (isNeglectedStatus(opp.status)) record.neglected += 1;
      if (opp.kam && !record.kamOwner) record.kamOwner = opp.kam;
      if (opp.region && !record.regions.includes(opp.region)) record.regions.push(opp.region);
      if (opp.productFamily && !record.products.includes(opp.productFamily)) record.products.push(opp.productFamily);
      record.avgProb += opp.contractProb || 0;
    });

    return Array.from(map.values())
      .map((account) => {
        const oppCount = opportunities.filter((opp) => (opp.customerName || 'Unknown account') === account.customer).length;
        const score = Math.round(
          Math.min(40, account.revenue / 25000) +
          Math.min(35, account.weightedPipeline / 20000) +
          (oppCount > 0 ? Math.min(15, (account.avgProb / Math.max(oppCount, 1)) / 5) : 0) -
          account.neglected * 5
        );
        const tier = score >= 60 ? 'Strategic' : score >= 30 ? 'Growth' : 'Watchlist';
        return {
          ...account,
          avgProb: oppCount > 0 ? account.avgProb / oppCount : 0,
          score,
          tier,
        };
      })
      .sort((a, b) => (b.revenue + b.pipeline) - (a.revenue + a.pipeline));
  }, [orders, opportunities]);

  const strategicAccounts = accounts.filter((account) => account.tier === 'Strategic').slice(0, 6);
  const focusAccount = strategicAccounts[0] || accounts[0];

  const stakeholderMap = useMemo(() => {
    if (!focusAccount) return [];
    return [
      { role: 'Economic buyer', influence: 'High', focus: 'ROI, payback, strategic fit', move: 'Present business case with revenue and lifecycle value.' },
      { role: 'Technical gatekeeper', influence: 'High', focus: 'Performance, integration, risk', move: `Show proof points for ${focusAccount.products[0] || 'the proposed solution'}.` },
      { role: 'Operations sponsor', influence: 'Medium', focus: 'Uptime, ease of adoption', move: 'Position service reliability and execution support.' },
      { role: 'Procurement', influence: 'Medium', focus: 'Commercial terms, negotiation', move: 'Prepare price-defense logic and multiyear value bundle.' },
    ];
  }, [focusAccount]);

  const valuePlans = useMemo(() => {
    return accounts.slice(0, 5).map((account) => ({
      customer: account.customer,
      plan: [
        `Protect ${fmt(account.revenue)} of current business with an executive review cadence.`,
        `Prioritize ${fmt(account.pipeline)} open pipeline and remove ${account.neglected} unattended blockers.`,
        `Expand share of wallet through ${account.products.slice(0, 2).join(', ') || 'adjacent offers'} and service-based upsell.`,
      ],
      horizon: account.tier === 'Strategic' ? '24-36 month partnership roadmap' : '6-12 month growth plan',
    }));
  }, [accounts]);

  const totalPipeline = accounts.reduce((sum, account) => sum + account.pipeline, 0);
  const totalRevenue = accounts.reduce((sum, account) => sum + account.revenue, 0);
  const neglectedAccounts = accounts.filter((account) => account.neglected > 0).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">Pillar 2</span>
          <Badge variant="outline">Key Account Value Systems</Badge>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Key Account Management</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Strategic account mapping, stakeholder analysis, value creation planning, and multiyear partnership development.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Strategic Accounts</p><p className="text-2xl font-bold">{strategicAccounts.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Booked Revenue</p><p className="text-2xl font-bold">{fmt(totalRevenue)}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Open Pipeline</p><p className="text-2xl font-bold">{fmt(totalPipeline)}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Accounts at Risk</p><p className="text-2xl font-bold text-destructive">{neglectedAccounts}</p></CardContent></Card>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Upload orders and opportunities to activate strategic account mapping, stakeholder intelligence, and value-creation plans.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="mapping" className="space-y-4">
          <TabsList>
            <TabsTrigger value="mapping" className="gap-1"><Building2 className="h-3.5 w-3.5" /> Strategic Mapping</TabsTrigger>
            <TabsTrigger value="stakeholders" className="gap-1"><Users className="h-3.5 w-3.5" /> Stakeholders</TabsTrigger>
            <TabsTrigger value="value" className="gap-1"><Target className="h-3.5 w-3.5" /> Value Plans</TabsTrigger>
            <TabsTrigger value="partnerships" className="gap-1"><Network className="h-3.5 w-3.5" /> Long-Term Partnerships</TabsTrigger>
          </TabsList>

          <TabsContent value="mapping">
            <Card>
              <CardHeader><CardTitle className="text-base">Strategic Account Mapping</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Account</TableHead>
                    <TableHead className="text-xs text-right">Booked</TableHead>
                    <TableHead className="text-xs text-right">Pipeline</TableHead>
                    <TableHead className="text-xs text-right">Weighted</TableHead>
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs">Tier</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {accounts.slice(0, 12).map((account) => (
                      <TableRow key={account.customer}>
                        <TableCell className="text-xs font-medium">{account.customer}</TableCell>
                        <TableCell className="text-xs text-right">{fmt(account.revenue)}</TableCell>
                        <TableCell className="text-xs text-right">{fmt(account.pipeline)}</TableCell>
                        <TableCell className="text-xs text-right">{fmt(account.weightedPipeline)}</TableCell>
                        <TableCell className="text-xs">{account.kamOwner || 'Unassigned'}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={account.tier === 'Strategic' ? 'default' : account.tier === 'Growth' ? 'secondary' : 'outline'}>{account.tier}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stakeholders">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stakeholder Analysis</CardTitle>
                <p className="text-xs text-muted-foreground">Focused on {focusAccount?.customer || companyProfile.company_name || 'the current top account'}.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {stakeholderMap.map((row) => (
                  <div key={row.role} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium">{row.role}</p>
                      <Badge variant={row.influence === 'High' ? 'default' : 'secondary'}>{row.influence}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Priority: {row.focus}</p>
                    <p className="text-xs text-foreground mt-1">Recommended move: {row.move}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="value">
            <div className="grid md:grid-cols-2 gap-4">
              {valuePlans.map((account) => (
                <Card key={account.customer}>
                  <CardHeader><CardTitle className="text-base">{account.customer}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {account.plan.map((item) => <p key={item} className="text-xs text-muted-foreground">• {item}</p>)}
                    <div className="pt-2 text-xs text-foreground font-medium">Horizon: {account.horizon}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="partnerships">
            <div className="grid lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Multiyear Strategy</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>Year 1: stabilize account ownership, remove neglected deals, and standardize executive reviews.</p>
                  <p>Year 2: expand share of wallet with cross-sell and lifecycle services.</p>
                  <p>Year 3: formalize joint planning, renewal governance, and innovation roadmap.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Opportunity Prioritization</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>Prioritize strategic accounts with the highest weighted pipeline and the clearest buying signals.</p>
                  <p>Escalate unattended opportunities within 7 days and assign an owner immediately.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-primary" /> AI Support</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>AI should support account intelligence, market signals, installed-base expansion, and proposal preparation.</p>
                  <p>The human team remains responsible for trust building, negotiation, and long-term partnership growth.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default KeyAccountManagementPage;
