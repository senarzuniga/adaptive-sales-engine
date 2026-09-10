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
  contactCount: number;
  leadCount: number;
  sector: string;
  completeness: 'high' | 'medium' | 'low';
};

const normalizeAccountName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const KeyAccountManagementPage = () => {
  const { data } = useData();
  const { orders, opportunities, companyProfile, leads, contacts, enrichedProfiles } = data;

  const profileIndex = useMemo(
    () => new Map(enrichedProfiles.map((profile) => [normalizeAccountName(profile.companyName), profile])),
    [enrichedProfiles],
  );

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
          contactCount: 0,
          leadCount: 0,
          sector: '',
          completeness: 'low',
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

    leads.forEach((lead) => {
      const name = lead.companyName || lead.leadName || 'Unknown account';
      const record = ensure(name);
      record.leadCount += 1;
      if (lead.owner && !record.kamOwner) record.kamOwner = lead.owner;
      if (lead.region && !record.regions.includes(lead.region)) record.regions.push(lead.region);
      if (lead.sector && !record.sector) record.sector = lead.sector;
    });

    contacts.forEach((contact) => {
      const name = contact.companyName || contact.name || 'Unknown account';
      const record = ensure(name);
      record.contactCount += 1;
      if (contact.kam && !record.kamOwner) record.kamOwner = contact.kam;
      if (contact.region && !record.regions.includes(contact.region)) record.regions.push(contact.region);
      if (contact.department && !record.sector) record.sector = contact.department;
    });

    return Array.from(map.values())
      .map((account) => {
        const oppCount = opportunities.filter((opp) => (opp.customerName || 'Unknown account') === account.customer).length;
        const profile = profileIndex.get(normalizeAccountName(account.customer));
        const score = Math.round(
          Math.min(36, account.revenue / 30000) +
          Math.min(28, account.weightedPipeline / 25000) +
          (oppCount > 0 ? Math.min(12, (account.avgProb / Math.max(oppCount, 1)) / 6) : 0) +
          Math.min(10, account.contactCount * 2) +
          Math.min(8, account.leadCount * 2) +
          Math.min(10, (profile?.enrichmentScore || 0) / 10) -
          account.neglected * 5
        );
        const tier = score >= 60 ? 'Strategic' : score >= 30 ? 'Growth' : 'Watchlist';
        return {
          ...account,
          avgProb: oppCount > 0 ? account.avgProb / oppCount : 0,
          score,
          tier,
          sector: profile?.sector || account.sector,
          completeness: profile?.completeness || account.completeness,
        };
      })
      .sort((a, b) => (b.revenue + b.pipeline + b.contactCount * 1000) - (a.revenue + a.pipeline + a.contactCount * 1000));
  }, [contacts, leads, opportunities, orders, profileIndex]);

  const strategicAccounts = accounts.filter((account) => account.tier === 'Strategic').slice(0, 6);
  const focusAccount = strategicAccounts[0] || accounts[0];
  const focusProfile = focusAccount ? profileIndex.get(normalizeAccountName(focusAccount.customer)) : undefined;

  const knownContacts = useMemo(() => {
    if (!focusAccount) return [];
    const seen = new Set<string>();
    return contacts
      .filter((contact) => normalizeAccountName(contact.companyName || '') === normalizeAccountName(focusAccount.customer))
      .filter((contact) => {
        const key = `${contact.email}-${contact.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [contacts, focusAccount]);

  const stakeholderMap = useMemo(() => {
    if (!focusAccount) return [];
    return [
      { role: 'Economic buyer', influence: 'High', focus: 'ROI, payback, strategic fit', move: 'Present a quantified business case linked to the current offer and installed-base value.' },
      { role: 'Technical gatekeeper', influence: 'High', focus: 'Performance, integration, risk', move: `Use ${focusAccount.products[0] || 'the active solution'} proof points and execution evidence to remove objections.` },
      { role: 'Operations sponsor', influence: 'Medium', focus: 'Uptime, changeover, service continuity', move: 'Connect the commercial proposal with after-sales monitoring and operational support.' },
      { role: 'Procurement', influence: 'Medium', focus: 'Commercial terms, negotiation, delivery commitments', move: 'Prepare pricing defense, milestones, and a documented follow-up sequence.' },
    ];
  }, [focusAccount]);

  const valuePlans = useMemo(() => {
    return accounts.slice(0, 5).map((account) => ({
      customer: account.customer,
      plan: [
        `Protect ${fmt(account.revenue)} of current business with a scheduled executive and technical review cadence.`,
        `Prioritize ${fmt(account.pipeline)} open pipeline, attach owners, and remove ${account.neglected} unattended blockers.`,
        `Activate ${account.contactCount} known contacts and ${account.leadCount} prospect signals to expand ${account.products.slice(0, 2).join(', ') || 'adjacent offers'}.`,
      ],
      horizon: account.tier === 'Strategic' ? '24-36 month partnership roadmap' : '6-12 month growth plan',
    }));
  }, [accounts]);

  const totalPipeline = accounts.reduce((sum, account) => sum + account.pipeline, 0);
  const totalRevenue = accounts.reduce((sum, account) => sum + account.revenue, 0);
  const mappedContacts = accounts.reduce((sum, account) => sum + account.contactCount, 0);

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
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground">Mapped Contacts</p><p className="text-2xl font-bold">{mappedContacts}</p></CardContent></Card>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Upload or sync orders, opportunities, leads, and contacts to activate strategic account mapping.
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
              <CardHeader><CardTitle className="text-base">Strategic Account Heatmap</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Account</TableHead>
                    <TableHead className="text-xs text-right">Booked</TableHead>
                    <TableHead className="text-xs text-right">Pipeline</TableHead>
                    <TableHead className="text-xs text-right">Contacts</TableHead>
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs">Tier</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {accounts.slice(0, 12).map((account) => (
                      <TableRow key={account.customer}>
                        <TableCell className="text-xs font-medium">
                          <div>{account.customer}</div>
                          <div className="text-[10px] text-muted-foreground">{account.regions.join(', ') || account.sector || companyProfile.company_name || 'Portfolio'}</div>
                        </TableCell>
                        <TableCell className="text-xs text-right">{fmt(account.revenue)}</TableCell>
                        <TableCell className="text-xs text-right">{fmt(account.pipeline)}</TableCell>
                        <TableCell className="text-xs text-right">{account.contactCount}</TableCell>
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
            <div className="grid lg:grid-cols-2 gap-4">
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Known CRM Coverage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Linked contacts</span>
                    <Badge variant="outline">{knownContacts.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Prospect signals</span>
                    <Badge variant="outline">{focusAccount?.leadCount || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Profile completeness</span>
                    <Badge variant={focusProfile?.completeness === 'high' ? 'default' : focusProfile?.completeness === 'medium' ? 'secondary' : 'outline'}>{focusProfile?.completeness || 'low'}</Badge>
                  </div>
                  <div className="space-y-2 pt-1">
                    {knownContacts.length === 0 ? (
                      <p className="text-muted-foreground">No direct contacts are linked yet for this account.</p>
                    ) : knownContacts.map((contact) => (
                      <div key={`${contact.email}-${contact.name}`} className="border rounded-md p-2">
                        <p className="font-medium">{contact.name || contact.email}</p>
                        <p className="text-muted-foreground">{contact.role || 'Commercial contact'} · {contact.email || 'email pending'}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
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
                  <p>Year 1: stabilize account ownership, document buying centers, and remove unattended opportunities.</p>
                  <p>Year 2: expand share of wallet with productized automation, retrofits, and lifecycle service offers.</p>
                  <p>Year 3: formalize joint planning, installed-base reviews, and a renewal-led innovation roadmap.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Opportunity Prioritization</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>Prioritize the accounts with the highest weighted pipeline, strongest contact coverage, and clearest technical urgency.</p>
                  <p>Escalate unattended follow-up within 7 days and convert every setback into a tracked recovery action.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-primary" /> AI Support</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>AI should keep account context, market signals, offers, projects, and service recommendations connected in one execution loop.</p>
                  <p>The commercial team remains responsible for trust building, negotiation, and direct customer interaction.</p>
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
