import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '@/store/DataStore';
import {
  createConfirmedEventFromTradeShow,
  decideNextBestAction,
  enrichLeadWithNextAction,
  generateEventPlan,
  runTradeShowStrategistAgent,
} from '@/agents/tradeShowStrategistAgent';
import {
  appendTradeShowHistory,
  deriveTravelInputs,
  estimateTradeShowTravelCosts,
  exportTradeShowLeads,
  fetchLinkedInTradeShowIntelligence,
  insertTradeShowLead,
  loadTradeShowWorkspace,
  persistWorkspaceSnapshot,
  upsertConfirmedEvent,
} from '@/integrations/tradeShows';
import {
  buildRoi,
  estimateCosts,
  priorityLabel,
  type ConfirmedEvent,
  type EventLead,
  type TradeShow,
  type TradeShowHistoryEntry,
} from '@/lib/tradeShows';
import { toast } from '@/hooks/use-toast';
import {
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Radar,
  RefreshCcw,
  Rocket,
  Search,
  Upload,
  Users,
} from 'lucide-react';

const toCurrency = (n: number) => `€${Math.round(n || 0).toLocaleString()}`;

export function TradeShowsHub() {
  const { data, activeCompanyId } = useData();
  const [activeTab, setActiveTab] = useState('recommended');
  const strategist = useMemo(() => runTradeShowStrategistAgent({
    company: data.companyProfile,
    products: data.products,
    strategy: data.strategy,
  }), [data.companyProfile, data.products, data.strategy]);

  const [confirmedEvents, setConfirmedEvents] = useState<ConfirmedEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [leadsByEvent, setLeadsByEvent] = useState<Record<string, EventLead[]>>({});
  const [history, setHistory] = useState<TradeShowHistoryEntry[]>([]);
  const [crmProvider, setCrmProvider] = useState<'hubspot' | 'salesforce'>('hubspot');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);

  const [leadName, setLeadName] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadRole, setLeadRole] = useState('');
  const [leadInterest, setLeadInterest] = useState<'A' | 'B' | 'C'>('B');
  const [leadNotes, setLeadNotes] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!activeCompanyId) {
      setConfirmedEvents([]);
      setSelectedEventId(null);
      setLeadsByEvent({});
      setHistory([]);
      return;
    }

    setIsLoadingWorkspace(true);
    loadTradeShowWorkspace(activeCompanyId)
      .then((workspace) => {
        if (cancelled) return;
        setConfirmedEvents(workspace.events);
        setLeadsByEvent(workspace.leadsByEvent);
        setHistory(workspace.history);
        setSelectedEventId((current) => current || workspace.events[0]?.id || null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingWorkspace(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeCompanyId]);

  useEffect(() => {
    if (!activeCompanyId) return;
    persistWorkspaceSnapshot(activeCompanyId, { events: confirmedEvents, leadsByEvent, history });
  }, [activeCompanyId, confirmedEvents, leadsByEvent, history]);

  useEffect(() => {
    if (selectedEventId && confirmedEvents.some((event) => event.id === selectedEventId)) return;
    setSelectedEventId(confirmedEvents[0]?.id || null);
  }, [confirmedEvents, selectedEventId]);

  const selectedConfirmed = confirmedEvents.find((e) => e.id === selectedEventId) || null;
  const selectedTradeShow: TradeShow | null = selectedConfirmed
    ? strategist.recommended.find((r) => r.id === selectedConfirmed.trade_show_id) || null
    : null;

  const selectedPlan = useMemo(() => {
    if (!selectedTradeShow) return null;
    return generateEventPlan({
      event: selectedTradeShow,
      company: data.companyProfile,
      products: data.products,
      strategy: data.strategy,
    });
  }, [selectedTradeShow, data.companyProfile, data.products, data.strategy]);

  const selectedLeads = selectedConfirmed ? leadsByEvent[selectedConfirmed.id] || [] : [];
  const selectedHistory = selectedConfirmed
    ? history.filter((entry) => entry.event_id === selectedConfirmed.id).slice(0, 6)
    : [];

  const persistEvent = async (
    event: ConfirmedEvent,
    actionType?: string,
    payload?: Record<string, unknown>,
  ) => {
    const saved = activeCompanyId ? await upsertConfirmedEvent(activeCompanyId, event) : event;
    setConfirmedEvents((prev) => {
      const exists = prev.some((entry) => entry.id === saved.id);
      if (!exists) return [saved, ...prev];
      return prev.map((entry) => entry.id === saved.id ? saved : entry);
    });

    if (activeCompanyId && actionType) {
      const historyEntry = await appendTradeShowHistory(activeCompanyId, saved.id, actionType, payload || {});
      setHistory((prev) => [historyEntry, ...prev]);
    }

    return saved;
  };

  const addConfirmed = async (tradeShow: TradeShow) => {
    const exists = confirmedEvents.some((event) => event.trade_show_id === tradeShow.id);
    if (exists) {
      toast({ title: 'Already confirmed', description: `${tradeShow.name} is already in confirmed events.` });
      return;
    }

    const confirmed = createConfirmedEventFromTradeShow(tradeShow);
    const plan = generateEventPlan({
      event: tradeShow,
      company: data.companyProfile,
      products: data.products,
      strategy: data.strategy,
    });

    const withPlan: ConfirmedEvent = {
      ...confirmed,
      objectives: plan.objectives,
      key_messages: plan.keyMessages,
      target_accounts: plan.accountTargets.map((account) => account.account),
    };

    setBusyAction(`${withPlan.id}:confirm`);
    try {
      const saved = await persistEvent(withPlan, 'event_confirmed', {
        tradeShowId: tradeShow.id,
        eventName: tradeShow.name,
      });
      setSelectedEventId(saved.id);
      setActiveTab('confirmed');
      toast({ title: 'Event confirmed', description: `${tradeShow.name} was added to confirmed trade shows.` });
    } finally {
      setBusyAction(null);
    }
  };

  const updateCostScenario = async (eventId: string, scenario: 'low' | 'medium' | 'high') => {
    const event = confirmedEvents.find((entry) => entry.id === eventId);
    if (!event) return;

    const travelInputs = deriveTravelInputs(event, event.venue, data.companyProfile.headquarters);
    const travelContext = event.travel_context || {
      source: 'fallback' as const,
      travel_distance_km: travelInputs.travelDistanceKm,
      country_cost_index: travelInputs.countryCostIndex,
      scenarios: estimateCosts({
        standSize: event.stand_size,
        teamSize: travelInputs.teamSize,
        travelDistanceKm: travelInputs.travelDistanceKm,
        countryCostIndex: travelInputs.countryCostIndex,
      }),
      last_updated_at: new Date().toISOString(),
    };

    const costs = travelContext.scenarios[scenario];
    const updated: ConfirmedEvent = {
      ...event,
      travel_context: travelContext,
      costs,
      roi: buildRoi(costs, {
        leadsGenerated: event.roi.leads_generated,
        qualifiedLeads: event.roi.qualified_leads,
        opportunitiesCreated: event.roi.opportunities_created,
        revenueGenerated: event.roi.revenue_generated,
      }),
    };

    await persistEvent(updated, 'cost_scenario_updated', { scenario, source: travelContext.source });
  };

  const updateRoiFields = async (
    eventId: string,
    field: 'leads_generated' | 'qualified_leads' | 'opportunities_created' | 'revenue_generated',
    value: number,
  ) => {
    const event = confirmedEvents.find((entry) => entry.id === eventId);
    if (!event) return;

    const draft = { ...event.roi, [field]: Number.isFinite(value) ? value : 0 };
    const updated: ConfirmedEvent = {
      ...event,
      roi: buildRoi(event.costs, {
        leadsGenerated: draft.leads_generated,
        qualifiedLeads: draft.qualified_leads,
        opportunitiesCreated: draft.opportunities_created,
        revenueGenerated: draft.revenue_generated,
      }),
    };

    await persistEvent(updated, 'roi_updated', { field, value: Number.isFinite(value) ? value : 0 });
  };

  const addLead = async () => {
    if (!selectedConfirmed) return;
    if (!leadName.trim() || !leadCompany.trim()) {
      toast({ title: 'Lead data required', description: 'Please add lead name and company.', variant: 'destructive' });
      return;
    }

    setBusyAction(`${selectedConfirmed.id}:lead`);
    try {
      const lead = enrichLeadWithNextAction({
        event_id: selectedConfirmed.id,
        name: leadName.trim(),
        company: leadCompany.trim(),
        role: leadRole.trim(),
        interest_level: leadInterest,
        notes: leadNotes.trim(),
      });

      const persistedLead = activeCompanyId
        ? await insertTradeShowLead(activeCompanyId, selectedConfirmed.id, lead)
        : lead;

      setLeadsByEvent((prev) => ({
        ...prev,
        [selectedConfirmed.id]: [...(prev[selectedConfirmed.id] || []), persistedLead],
      }));

      const updatedEvent: ConfirmedEvent = {
        ...selectedConfirmed,
        roi: buildRoi(selectedConfirmed.costs, {
          leadsGenerated: selectedConfirmed.roi.leads_generated + 1,
          qualifiedLeads: selectedConfirmed.roi.qualified_leads + (persistedLead.interest_level === 'C' ? 0 : 1),
          opportunitiesCreated: selectedConfirmed.roi.opportunities_created,
          revenueGenerated: selectedConfirmed.roi.revenue_generated,
        }),
      };
      await persistEvent(updatedEvent, 'lead_captured', {
        leadId: persistedLead.id,
        company: persistedLead.company,
        interest: persistedLead.interest_level,
      });

      setLeadName('');
      setLeadCompany('');
      setLeadRole('');
      setLeadInterest('B');
      setLeadNotes('');
      toast({ title: 'Lead captured', description: `${persistedLead.name} was added to the event lead list.` });
    } finally {
      setBusyAction(null);
    }
  };

  const refreshLinkedIn = async () => {
    if (!selectedConfirmed || !selectedTradeShow || !selectedPlan || !activeCompanyId) return;

    setBusyAction(`${selectedConfirmed.id}:linkedin`);
    try {
      const intelligence = await fetchLinkedInTradeShowIntelligence({
        companyId: activeCompanyId,
        event: selectedConfirmed,
        eventName: selectedTradeShow.name,
        industry: selectedTradeShow.industry,
        location: selectedTradeShow.location,
        targetAccounts: selectedConfirmed.target_accounts.length > 0
          ? selectedConfirmed.target_accounts
          : selectedPlan.accountTargets.map((account) => account.account),
        companyName: data.companyProfile.company_name,
      });

      await persistEvent({ ...selectedConfirmed, linkedin_intelligence: intelligence }, 'linkedin_intelligence_refreshed', {
        source: intelligence.source,
        attendingCompanies: intelligence.attending_companies.length,
      });
      toast({ title: 'LinkedIn intelligence updated', description: `Refreshed event intelligence from ${intelligence.source}.` });
    } finally {
      setBusyAction(null);
    }
  };

  const refreshTravelCosts = async () => {
    if (!selectedConfirmed || !selectedTradeShow) return;

    setBusyAction(`${selectedConfirmed.id}:travel`);
    try {
      const travelInputs = deriveTravelInputs(selectedConfirmed, selectedTradeShow.location, data.companyProfile.headquarters);
      const context = await estimateTradeShowTravelCosts({
        event: selectedConfirmed,
        eventName: selectedTradeShow.name,
        location: selectedTradeShow.location,
        teamSize: travelInputs.teamSize,
        travelDistanceKm: travelInputs.travelDistanceKm,
        countryCostIndex: travelInputs.countryCostIndex,
      });

      const updatedEvent: ConfirmedEvent = {
        ...selectedConfirmed,
        travel_context: context,
        costs: context.scenarios.medium,
        roi: buildRoi(context.scenarios.medium, {
          leadsGenerated: selectedConfirmed.roi.leads_generated,
          qualifiedLeads: selectedConfirmed.roi.qualified_leads,
          opportunitiesCreated: selectedConfirmed.roi.opportunities_created,
          revenueGenerated: selectedConfirmed.roi.revenue_generated,
        }),
      };

      await persistEvent(updatedEvent, 'travel_cost_refreshed', {
        source: context.source,
        travelDistanceKm: context.travel_distance_km,
      });
      toast({ title: 'Travel cost engine updated', description: `Cost scenarios refreshed from ${context.source}.` });
    } finally {
      setBusyAction(null);
    }
  };

  const exportLeadsToCrm = async () => {
    if (!selectedConfirmed || !activeCompanyId) return;
    if (selectedLeads.length === 0) {
      toast({ title: 'No leads to export', description: 'Capture at least one lead before exporting.', variant: 'destructive' });
      return;
    }

    setBusyAction(`${selectedConfirmed.id}:crm`);
    try {
      const exportStatus = await exportTradeShowLeads({
        companyId: activeCompanyId,
        event: selectedConfirmed,
        leads: selectedLeads,
        provider: crmProvider,
        companyName: data.companyProfile.company_name,
      });

      await persistEvent({ ...selectedConfirmed, crm_export: exportStatus }, 'crm_export_triggered', {
        provider: crmProvider,
        status: exportStatus.status,
        exportedCount: exportStatus.exported_count,
      });
      toast({ title: 'CRM export processed', description: exportStatus.message });
    } finally {
      setBusyAction(null);
    }
  };

  const linkedInIntelligence = selectedConfirmed?.linkedin_intelligence;
  const targetAccounts = linkedInIntelligence?.attending_companies.length
    ? linkedInIntelligence.attending_companies.map((account) => ({
      account: account.company,
      score: account.relevance,
      narrative: account.rationale,
    }))
    : (selectedPlan?.accountTargets || []).slice(0, 5).map((account) => ({
      account: account.account,
      score: account.account_score,
      narrative: account.meeting_suggestion,
    }));
  const competitorPatterns = linkedInIntelligence?.competitor_patterns || selectedPlan?.competitorMessaging || [];
  const counterMessaging = linkedInIntelligence?.counter_messaging || selectedPlan?.counterMessaging || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" /> Trade Shows Hub
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Autonomous trade show intelligence with connector-backed export, enrichment, travel-cost, and persistence workflows.</p>
          <p className="text-xs">Agent explainability: {strategist.explainability[0]}</p>
          {!activeCompanyId && <p className="text-xs text-amber-700">Select an active company to persist events, sync CRM exports, and store trade show history.</p>}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="recommended" className="gap-1"><Search className="h-3.5 w-3.5" /> Recommended Trade Shows</TabsTrigger>
          <TabsTrigger value="confirmed" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Confirmed Trade Shows ({confirmedEvents.length})</TabsTrigger>
          <TabsTrigger value="detail" className="gap-1"><CalendarDays className="h-3.5 w-3.5" /> Event Detail View</TabsTrigger>
        </TabsList>

        <TabsContent value="recommended" className="space-y-3">
          <div className="grid gap-3">
            {strategist.recommended.map((event) => {
              const priority = priorityLabel(event.total_score);
              return (
                <Card key={event.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{event.name}</p>
                        <p className="text-xs text-muted-foreground">{event.location} • {event.date} • {event.industry}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={priority === 'HIGH PRIORITY' ? 'destructive' : priority === 'MEDIUM' ? 'default' : 'secondary'}>{priority}</Badge>
                        <Badge variant="outline">Score {event.total_score.toFixed(2)}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground grid md:grid-cols-2 gap-2">
                      <p>Audience: {event.audience_type}</p>
                      <p>Attendance: {event.estimated_attendance.toLocaleString()}</p>
                      <p>Cost range: {event.estimated_cost_range}</p>
                      <p>Strategic fit: {event.strategic_fit_score.toFixed(2)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {event.recommended_actions.map((action) => <Badge key={action} variant="outline" className="text-[10px]">{action}</Badge>)}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button disabled={busyAction === `${event.id}:confirm`} onClick={() => void addConfirmed(event)}>Confirm Event</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="confirmed">
          {isLoadingWorkspace ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading trade show workspace...</CardContent></Card>
          ) : confirmedEvents.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No confirmed trade shows yet. Confirm one from recommendations.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {confirmedEvents.map((event) => {
                const show = strategist.recommended.find((entry) => entry.id === event.trade_show_id);
                return (
                  <Card key={event.id} className={selectedEventId === event.id ? 'ring-2 ring-primary/40' : ''}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{show?.name || event.trade_show_id}</p>
                          <p className="text-xs text-muted-foreground">{event.venue} • {event.event_date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{event.status}</Badge>
                          {event.crm_export && <Badge variant={event.crm_export.status === 'exported' ? 'default' : 'secondary'}>{event.crm_export.provider} {event.crm_export.status}</Badge>}
                        </div>
                      </div>
                      <div className="grid md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <p>Stand: {event.stand_size}</p>
                        <p>Total Cost: {toCurrency(event.costs.total_cost)}</p>
                        <p>ROI ratio: {event.roi.ROI_ratio.toFixed(2)}x</p>
                        <p>Leads: {leadsByEvent[event.id]?.length || 0}</p>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setSelectedEventId(event.id)}>Open Detail</Button>
                        <Button size="sm" onClick={() => { setSelectedEventId(event.id); setActiveTab('detail'); }}>Manage Lifecycle</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="detail" className="space-y-4">
          {!selectedConfirmed || !selectedTradeShow || !selectedPlan ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Select a confirmed trade show to open Event Detail View.</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Event Overview</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p><span className="font-medium">Event:</span> {selectedTradeShow.name}</p>
                      <p><span className="font-medium">Venue:</span> {selectedConfirmed.venue}</p>
                      <p><span className="font-medium">Date:</span> {selectedConfirmed.event_date}</p>
                      <p><span className="font-medium">Audience:</span> {selectedTradeShow.audience_type}</p>
                    </div>
                    <div className="space-y-1">
                      <p><span className="font-medium">Competitor presence:</span> {selectedTradeShow.exhibitor_profile}</p>
                      <p><span className="font-medium">Historical performance:</span> {selectedConfirmed.roi.opportunities_created} opportunities, {toCurrency(selectedConfirmed.roi.revenue_generated)} revenue</p>
                      <p><span className="font-medium">Priority:</span> {priorityLabel(selectedTradeShow.total_score)}</p>
                      <p><span className="font-medium">Persistence:</span> {activeCompanyId ? 'Supabase-backed with local fallback' : 'Local session only'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={!activeCompanyId || busyAction === `${selectedConfirmed.id}:linkedin`} onClick={() => void refreshLinkedIn()}>
                      <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Refresh LinkedIn Intelligence
                    </Button>
                    <Button variant="outline" size="sm" disabled={busyAction === `${selectedConfirmed.id}:travel`} onClick={() => void refreshTravelCosts()}>
                      <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Refresh Travel Cost API
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Rocket className="h-4 w-4 text-primary" /> Strategic Planning</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium mb-1">AI Objectives</p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {selectedPlan.objectives.map((objective) => <li key={objective}>{objective}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium mb-1">AI Key Messages</p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {selectedPlan.keyMessages.map((message) => <li key={message}>{message}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Content Matching Recommendations</p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {selectedPlan.recommendedAssets.map((asset) => <li key={asset}>{asset}</li>)}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Cost Calculator & ROI Engine</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void updateCostScenario(selectedConfirmed.id, 'low')}>Low Scenario</Button>
                    <Button size="sm" variant="outline" onClick={() => void updateCostScenario(selectedConfirmed.id, 'medium')}>Medium Scenario</Button>
                    <Button size="sm" variant="outline" onClick={() => void updateCostScenario(selectedConfirmed.id, 'high')}>High Scenario</Button>
                  </div>
                  <div className="grid md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                    <p>Total cost: {toCurrency(selectedConfirmed.costs.total_cost)}</p>
                    <p>Cost per lead: {toCurrency(selectedConfirmed.roi.cost_per_lead)}</p>
                    <p>ROI ratio: {selectedConfirmed.roi.ROI_ratio.toFixed(2)}x</p>
                    <p>Travel source: {selectedConfirmed.travel_context?.source || 'fallback'}</p>
                  </div>
                  <div className="grid md:grid-cols-4 gap-2">
                    <Input type="number" placeholder="Leads" value={selectedConfirmed.roi.leads_generated} onChange={(e) => void updateRoiFields(selectedConfirmed.id, 'leads_generated', Number(e.target.value || 0))} />
                    <Input type="number" placeholder="Qualified" value={selectedConfirmed.roi.qualified_leads} onChange={(e) => void updateRoiFields(selectedConfirmed.id, 'qualified_leads', Number(e.target.value || 0))} />
                    <Input type="number" placeholder="Opportunities" value={selectedConfirmed.roi.opportunities_created} onChange={(e) => void updateRoiFields(selectedConfirmed.id, 'opportunities_created', Number(e.target.value || 0))} />
                    <Input type="number" placeholder="Revenue" value={selectedConfirmed.roi.revenue_generated} onChange={(e) => void updateRoiFields(selectedConfirmed.id, 'revenue_generated', Number(e.target.value || 0))} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Lead Management System</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid md:grid-cols-2 gap-2">
                    <Input placeholder="Lead name" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
                    <Input placeholder="Company" value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} />
                    <Input placeholder="Role" value={leadRole} onChange={(e) => setLeadRole(e.target.value)} />
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={leadInterest} onChange={(e) => setLeadInterest(e.target.value as 'A' | 'B' | 'C')}>
                      <option value="A">Interest A</option>
                      <option value="B">Interest B</option>
                      <option value="C">Interest C</option>
                    </select>
                  </div>
                  <Textarea placeholder="Notes" value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} rows={2} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <select className="flex h-9 rounded-md border border-input bg-background px-3 text-sm" value={crmProvider} onChange={(e) => setCrmProvider(e.target.value as 'hubspot' | 'salesforce')}>
                        <option value="hubspot">HubSpot Export</option>
                        <option value="salesforce">Salesforce Export</option>
                      </select>
                      <Button variant="outline" disabled={!activeCompanyId || busyAction === `${selectedConfirmed.id}:crm`} onClick={() => void exportLeadsToCrm()}>
                        <Upload className="mr-1 h-3.5 w-3.5" /> Export Leads
                      </Button>
                    </div>
                    <Button disabled={busyAction === `${selectedConfirmed.id}:lead`} onClick={() => void addLead()}>Capture Lead</Button>
                  </div>
                  {selectedConfirmed.crm_export && (
                    <div className="rounded border border-primary/20 bg-primary/5 p-3 text-xs">
                      <p className="font-medium">Latest CRM export</p>
                      <p>{selectedConfirmed.crm_export.provider} • {selectedConfirmed.crm_export.status} • {selectedConfirmed.crm_export.exported_count} leads</p>
                      <p className="text-muted-foreground">{selectedConfirmed.crm_export.message}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {selectedLeads.map((lead) => (
                      <div key={lead.id} className="rounded border p-2 text-xs">
                        <p className="font-medium">{lead.name} • {lead.company} ({lead.interest_level})</p>
                        <p className="text-muted-foreground">{lead.role} • {lead.notes || 'No notes'}</p>
                        <p className="text-primary">Next action: {lead.next_action}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> LinkedIn Intelligence + Account Targeting</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded border border-primary/20 bg-primary/5 p-3 text-xs">
                    <p className="font-medium">Intelligence summary</p>
                    <p>{linkedInIntelligence?.summary || 'No external enrichment yet. Use the refresh action to call the LinkedIn intelligence adapter.'}</p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Prioritized Target Accounts</p>
                    <div className="space-y-2">
                      {targetAccounts.map((account) => (
                        <div key={account.account} className="rounded border p-2 text-xs">
                          <p className="font-medium">{account.account} • Score {account.score.toFixed(2)}</p>
                          <p className="text-muted-foreground">{account.narrative}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Competitor Messaging Patterns</p>
                    <div className="space-y-2">
                      {competitorPatterns.map((pattern) => (
                        <div key={pattern.company} className="rounded border p-2 text-xs">
                          <p className="font-medium">{pattern.company} • {pattern.positioning}</p>
                          <p className="text-muted-foreground">{pattern.message}</p>
                          <p>Keywords: {pattern.keywords.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Recommended Counter-Messaging</p>
                    <ul className="list-disc list-inside text-muted-foreground text-xs">
                      {counterMessaging.map((message) => <li key={message}>{message}</li>)}
                    </ul>
                  </div>
                  <div className="rounded border border-primary/30 bg-primary/5 p-3 text-xs">
                    {(() => {
                      const nba = decideNextBestAction({
                        revenueProbability: Math.min(0.95, selectedTradeShow.total_score + 0.08),
                        value: Math.max(50000, selectedConfirmed.roi.revenue_generated || 120000),
                        cost: selectedConfirmed.costs.total_cost,
                        effort: 9000,
                      });
                      return (
                        <>
                          <p className="font-medium">Next Best Action Engine</p>
                          <p>{nba.action}</p>
                          <p>Expected impact: {toCurrency(nba.expected_impact)}</p>
                        </>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Activity History</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {selectedHistory.length === 0 ? (
                    <p className="text-muted-foreground">No persisted activity yet for this event.</p>
                  ) : selectedHistory.map((entry) => (
                    <div key={entry.id} className="rounded border p-2">
                      <p className="font-medium">{entry.action_type}</p>
                      <p className="text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
