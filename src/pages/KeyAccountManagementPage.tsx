import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/store/DataStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Network, Target, TrendingUp, Users, ShieldCheck, Lightbulb, FileText, Mail, Briefcase, Landmark, Factory, Sparkles, PencilLine } from 'lucide-react';
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

  const strategicOverrideStorageKey = 'ase_strategic_account_overrides';
  const [strategicOverrides, setStrategicOverrides] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(strategicOverrideStorageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(strategicOverrideStorageKey, JSON.stringify(strategicOverrides));
  }, [strategicOverrides]);

  const isAccountStrategic = (customerName: string, fallbackTier?: string) => {
    const key = normalizeAccountName(customerName);
    return strategicOverrides[key] ?? (fallbackTier === 'Strategic');
  };

  const strategicAccounts = accounts.filter((account) => {
    const explicitSelection = strategicOverrides[normalizeAccountName(account.customer)];
    return explicitSelection ?? account.tier === 'Strategic';
  }).slice(0, 6);
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

  const [selectedAccountName, setSelectedAccountName] = useState<string>(strategicAccounts[0]?.customer || accounts[0]?.customer || '');
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [accountNotes, setAccountNotes] = useState<Record<string, string>>({});
  const [documentsByAccount, setDocumentsByAccount] = useState<Record<string, Array<{ id: string; name: string; type: string; owner: string; updatedAt: string }>>>({});

  const selectedAccount = accounts.find((account) => account.customer === selectedAccountName) || accounts[0];

  const selectedAccountOrders = useMemo(() => {
    if (!selectedAccount) return [];
    return orders.filter((order) => (order.customerName || 'Unknown account') === selectedAccount.customer);
  }, [orders, selectedAccount]);

  const selectedAccountOpportunities = useMemo(() => {
    if (!selectedAccount) return [];
    return opportunities.filter((opp) => (opp.customerName || 'Unknown account') === selectedAccount.customer);
  }, [opportunities, selectedAccount]);

  const selectedAccountContacts = useMemo(() => {
    if (!selectedAccount) return [];
    return contacts.filter((contact) => (contact.companyName || contact.name || 'Unknown account') === selectedAccount.customer);
  }, [contacts, selectedAccount]);

  const selectedAccountLeads = useMemo(() => {
    if (!selectedAccount) return [];
    return leads.filter((lead) => (lead.companyName || lead.leadName || 'Unknown account') === selectedAccount.customer);
  }, [leads, selectedAccount]);

  const selectedAccountDocs = useMemo(() => {
    if (!selectedAccount) return [] as Array<{ id: string; name: string; type: string; owner: string; updatedAt: string }>;
    return documentsByAccount[selectedAccount.customer] || [
      { id: 'doc-1', name: 'Commercial proposal', type: 'PDF', owner: 'Sales', updatedAt: '2026-08-24' },
      { id: 'doc-2', name: 'Technical specification', type: 'DOCX', owner: 'Engineering', updatedAt: '2026-08-19' },
      { id: 'doc-3', name: 'Payment report', type: 'XLSX', owner: 'Finance', updatedAt: '2026-08-14' },
    ];
  }, [documentsByAccount, selectedAccount]);

  const selectedAccountMails = useMemo(() => {
    const base = selectedAccountContacts.map((contact) => ({
      sender: contact.name || 'Commercial contact',
      subject: `Follow-up ${selectedAccount?.customer || 'account'}`,
      email: contact.email || 'noreply@account.local',
      status: 'Pending action',
    }));

    if (base.length === 0) {
      return [
        { sender: 'Operations Team', subject: 'Commercial follow-up review', email: 'ops@ingecart.es', status: 'Awaiting response' },
        { sender: 'Customer care', subject: 'Project alignment call', email: 'care@customer.local', status: 'Scheduled' },
      ];
    }

    return base.slice(0, 3);
  }, [selectedAccount, selectedAccountContacts]);

  const aiAccountSummary = useMemo(() => {
    if (!selectedAccount) return 'No account selected.';

    const booked = fmt(selectedAccount.revenue);
    const pipeline = fmt(selectedAccount.pipeline);
    const contacts = selectedAccount.contactCount;
    const activeOrders = selectedAccountOrders.length;
    const openOpps = selectedAccountOpportunities.filter((opp) => isOpenOpportunityStatus(opp.status)).length;
    const risk = selectedAccount.neglected > 0 ? 'requires follow-up' : 'stable';

    return `${selectedAccount.customer} keeps ${booked} in booked revenue and ${pipeline} in open pipeline. There are ${contacts} mapped contacts, ${activeOrders} commercial orders and ${openOpps} active opportunity tracks. The commercial exposure is ${risk}, with a clear need to align owners, technical response and payment follow-up in the next working cycle.`;
  }, [selectedAccount, selectedAccountOpportunities, selectedAccountOrders]);

  const updateSelectedNotes = (nextValue: string) => {
    if (!selectedAccount) return;
    setAccountNotes((current) => ({ ...current, [selectedAccount.customer]: nextValue }));
  };

  const handleAddDocument = () => {
    if (!selectedAccount) return;

    const newDoc = {
      id: `doc-${Date.now()}`,
      name: `Customer note ${selectedAccountDocs.length + 1}`,
      type: 'PDF',
      owner: 'Account Team',
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    setDocumentsByAccount((current) => ({
      ...current,
      [selectedAccount.customer]: [...(current[selectedAccount.customer] || selectedAccountDocs), newDoc],
    }));
  };

  const selectedAccountRisk = selectedAccount ? (selectedAccount.neglected > 2 ? 'High' : selectedAccount.neglected > 0 ? 'Medium' : 'Low') : 'Low';
  const selectedAccountDebt = selectedAccount ? Math.max(0, selectedAccount.revenue * 0.14) : 0;
  const selectedAccountCollections = selectedAccount ? Math.max(0, selectedAccount.revenue * 0.36) : 0;
  const selectedAccountPlants = selectedAccount ? [selectedAccount.regions[0] || 'Core region', `${selectedAccount.customer} production layout`, `${selectedAccount.products[0] || 'Automation'} lines`] : [];
  const selectedAccountProjects = selectedAccount ? selectedAccountOpportunities.slice(0, 3).map((opp) => ({
    name: opp.oppNumber || 'Active opportunity',
    status: opp.status,
    value: opp.estRevenue || 0,
  })) : [];

  type AccountMailThread = {
    id: string;
    accountName: string;
    sender: string;
    recipient: string;
    subject: string;
    receivedAt: string;
    summary: string;
    direction: 'inbound' | 'outbound';
  };

  const [accountMailThreads, setAccountMailThreads] = useState<AccountMailThread[]>(() => {
    try {
      const existing = localStorage.getItem('ase_account_mail_threads');
      if (existing) return JSON.parse(existing);
    } catch {
      // ignore invalid persisted data
    }

    return [
      {
        id: 'mail-cgo-01',
        accountName: 'Cascades',
        sender: 'cgo@ingecart.es',
        recipient: 'commercial@cascades.com',
        subject: 'Piscataway conveyor follow-up',
        receivedAt: '2026-08-17',
        summary: 'Commercial alignment for the conveyor line, engineering scope confirmation, and purchase order follow-up.',
        direction: 'outbound',
      },
      {
        id: 'mail-cgo-02',
        accountName: 'Cascades',
        sender: 'commercial@cascades.com',
        recipient: 'cgo@ingecart.es',
        subject: 'Project schedule confirmation',
        receivedAt: '2026-08-21',
        summary: 'Schedule and procurement timeline for the palletizer and exit conveyor scope.',
        direction: 'inbound',
      },
      {
        id: 'mail-cgo-03',
        accountName: 'International Paper',
        sender: 'cgo@ingecart.es',
        recipient: 'procurement@ip.com',
        subject: 'Waterloo AMR proposal review',
        receivedAt: '2026-08-22',
        summary: 'Follow-up on the Waterloo AMR proposal and customer decision timeline for rapidbond support.',
        direction: 'outbound',
      },
      {
        id: 'mail-cgo-04',
        accountName: 'Saica',
        sender: 'cgo@ingecart.es',
        recipient: 'saica.procurement@saica.com',
        subject: 'Auditoría de servicios',
        receivedAt: '2026-08-26',
        summary: 'Revisión del alcance del proyecto de auditoría y coordinación de servicios técnicos.',
        direction: 'outbound',
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('ase_account_mail_threads', JSON.stringify(accountMailThreads));
  }, [accountMailThreads]);

  const [accountPlants, setAccountPlants] = useState<Record<string, Array<{ id: string; plantName: string; region: string; status: string; contact: string; notes: string }>>>(() => {
    try {
      const existing = localStorage.getItem('ase_account_plants');
      return existing ? JSON.parse(existing) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('ase_account_plants', JSON.stringify(accountPlants));
  }, [accountPlants]);

  const toggleStrategicStatus = (accountName: string) => {
    const key = normalizeAccountName(accountName);
    setStrategicOverrides((current) => ({
      ...current,
      [key]: !(current[key] ?? false),
    }));
  };

  const assignMailToAccount = (mailId: string, accountName: string) => {
    setAccountMailThreads((current) => current.map((mail) => mail.id === mailId ? { ...mail, accountName } : mail));
  };

  const addPlantToAccount = () => {
    if (!selectedAccount) return;
    const plantName = `${selectedAccount.customer} plant ${Date.now().toString().slice(-3)}`;
    setAccountPlants((current) => ({
      ...current,
      [selectedAccount.customer]: [
        ...(current[selectedAccount.customer] || []),
        {
          id: `plant-${Date.now()}`,
          plantName,
          region: selectedAccount.regions[0] || 'Core region',
          status: 'Monitoring',
          contact: selectedAccount.kamOwner || 'Owner pending',
          notes: 'Plant linked to the account and available for operational review.',
        },
      ],
    }));
  };

  const selectedAccountStrategic = selectedAccount ? isAccountStrategic(selectedAccount.customer, selectedAccount.tier) : false;

  const [selectedMetric, setSelectedMetric] = useState<'booked' | 'pipeline' | 'contacts'>('booked');
  const [customerPaymentTerms, setCustomerPaymentTerms] = useState<Record<string, string>>({
    default: '10% downpayment; 40% supply approval; 50% delivery and SAT',
  });
  const [supplierPaymentTerms, setSupplierPaymentTerms] = useState<Record<string, string>>({
    default: 'Supplier payment 90 days from invoicing; current policy: 4-month engineering rollout with equal monthly allocation and 30% first 4-month phase',
  });

  const metricCards = [
    {
      key: 'booked' as const,
      label: 'Booked Revenue',
      total: totalRevenue,
      description: 'Pedidos cerrados / ingresos realmente facturables',
      accent: 'default',
    },
    {
      key: 'pipeline' as const,
      label: 'Open Pipeline',
      total: totalPipeline,
      description: 'Ofertas y oportunidades abiertas con probabilidad y riesgo',
      accent: 'secondary',
    },
    {
      key: 'contacts' as const,
      label: 'Mapped Contacts',
      total: mappedContacts,
      description: 'Contactos cargados, stakeholders y leads validados',
      accent: 'outline',
    },
  ];

  const metricRecords = useMemo(() => ({
    booked: orders.map((order) => ({
      id: order.id || `${order.customerName}-${order.oppNumber}`,
      title: order.customerName || 'Pedido',
      value: order.sellingPrice || 0,
      summary: `${order.productFamily || 'Product'} · ${order.scope || 'Scope pending'} · ${order.poDate || 'Date pending'}`,
      meta: {
        amount: order.sellingPrice || 0,
        margin: order.margin || 0,
        kam: order.kam || 'Unassigned',
        status: order.poDate ? 'Booked' : 'Awaiting PO',
        product: order.productFamily || 'Portfolio',
        region: order.region || 'Not assigned',
      },
    })),
    pipeline: opportunities.map((opp) => ({
      id: opp.oppNumber || `${opp.customerName}-${opp.status}`,
      title: opp.customerName || 'Opportunity',
      value: opp.estRevenue || 0,
      summary: `${opp.productFamily || 'Product'} · ${opp.status} · ${opp.contractProb || 0}%`,
      meta: {
        amount: opp.estRevenue || 0,
        margin: opp.margin || 0,
        kam: opp.kam || 'Unassigned',
        status: opp.status,
        product: opp.productFamily || 'Portfolio',
        region: opp.region || 'Not assigned',
      },
    })),
    contacts: [
      ...selectedAccountContacts.map((contact) => ({
        id: `${contact.email}-${contact.name}`,
        title: contact.name || 'Contacto',
        value: 1,
        summary: `${contact.role || 'Stakeholder'} · ${contact.email || 'Email pending'}`,
        meta: { amount: 1, margin: 0, kam: contact.kam || 'Unassigned', status: 'Active', product: 'Stakeholder', region: contact.region || 'Not assigned' },
      })),
      ...selectedAccountLeads.map((lead) => ({
        id: `${lead.leadName}-${lead.companyName}`,
        title: lead.leadName || lead.companyName || 'Lead',
        value: 1,
        summary: `${lead.status || 'Open'} · ${lead.email || 'Email pending'}`,
        meta: { amount: 1, margin: 0, kam: lead.owner || 'Unassigned', status: lead.status || 'Open', product: 'Lead', region: lead.region || 'Not assigned' },
      })),
    ],
  }), [opportunities, orders, selectedAccountContacts, selectedAccountLeads]);

  const selectedMetricRecords = metricRecords[selectedMetric];

  const getPaymentModelForAccount = (value: number) => {
    const customerTerms = customerPaymentTerms[selectedAccount?.customer || 'default'] || customerPaymentTerms.default;
    const supplierTerms = supplierPaymentTerms[selectedAccount?.customer || 'default'] || supplierPaymentTerms.default;

    return {
      customerTerms,
      supplierTerms,
      downPayment: value * 0.1,
      approvalMilestone: value * 0.4,
      deliveryMilestone: value * 0.5,
      engineeringAllocation: value * 0.3,
      serviceReserve: value * 0.05,
      financialCost: value * 0.015,
      commercialCost: value * 0.02,
      commission: value * 0.025,
    };
  };

  const paymentModel = selectedAccount ? getPaymentModelForAccount(selectedAccount.revenue || selectedAccount.pipeline || 0) : getPaymentModelForAccount(0);

  const selectedMetricTotal = selectedMetric === 'contacts' ? selectedMetricRecords.reduce((sum, entry) => sum + (entry.value || 0), 0) : selectedMetricRecords.reduce((sum, entry) => sum + (entry.value || 0), 0);

  const selectedAccountMailsForAccount = useMemo(() => {
    if (!selectedAccount) return [];
    const normalized = normalizeAccountName(selectedAccount.customer);
    return accountMailThreads.filter((thread) => normalizeAccountName(thread.accountName) === normalized || thread.sender.includes('cgo@ingecart.es'));
  }, [accountMailThreads, selectedAccount]);

  const selectedAccountPlantList = useMemo(() => {
    if (!selectedAccount) return [];
    return accountPlants[selectedAccount.customer] || [
      { id: `${selectedAccount.customer}-plant-1`, plantName: `${selectedAccount.customer} plant`, region: selectedAccount.regions[0] || 'Core region', status: 'Active', contact: selectedAccount.kamOwner || 'Owner pending', notes: 'Operational base linked to the current account.' },
    ];
  }, [accountPlants, selectedAccount]);

  const linkedOffersForSelectedAccount = useMemo(() => {
    if (!selectedAccount) return [];
    return [...selectedAccountOrders, ...selectedAccountOpportunities].slice(0, 8).map((record: any) => ({
      id: record.id || record.oppNumber || record.poDate || record.customerName,
      name: record.customerName || record.oppNumber || 'Linked commercial record',
      type: record.sellingPrice ? 'Order' : 'Opportunity',
      status: record.status || (record.poDate ? 'Booked' : 'Open'),
      value: record.sellingPrice || record.estRevenue || 0,
      product: record.productFamily || record.scope || 'Portfolio',
    }));
  }, [selectedAccount, selectedAccountOpportunities, selectedAccountOrders]);

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
        <Card className="transition hover:border-primary/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Strategic Accounts</p>
            <button type="button" className="text-left w-full" onClick={() => setSelectedMetric('booked')}>
              <p className="text-2xl font-bold">{strategicAccounts.length}</p>
            </button>
          </CardContent>
        </Card>
        {metricCards.map((card) => (
          <Card key={card.key} className={selectedMetric === card.key ? 'border-primary/60 bg-primary/5 transition' : 'transition hover:border-primary/50'}>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <button type="button" className="text-left w-full" onClick={() => setSelectedMetric(card.key)}>
                <p className="text-2xl font-bold">{fmt(card.total)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{card.description}</p>
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{selectedMetric === 'booked' ? 'Booked revenue breakdown' : selectedMetric === 'pipeline' ? 'Open pipeline drilldown' : 'Contact and stakeholder coverage'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Total {fmt(selectedMetricTotal)}</Badge>
            <Badge variant="outline">{selectedMetricRecords.length} records</Badge>
            <Badge variant="outline">{selectedAccount?.customer || 'Portfolio'}</Badge>
          </div>
          <div className="grid xl:grid-cols-[1.2fr_1fr] gap-4">
            <div className="space-y-3">
              {selectedMetricRecords.slice(0, 6).map((record) => (
                <div key={record.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{record.title}</p>
                      <p className="text-[11px] text-muted-foreground">{record.summary}</p>
                    </div>
                    <Badge variant="secondary">{fmt(record.value)}</Badge>
                  </div>
                  <div className="mt-2 grid sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                    <span>Owner: {record.meta.kam}</span>
                    <span>Region: {record.meta.region}</span>
                    <span>Status: {record.meta.status}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-md border p-3 bg-muted/20">
              <p className="text-sm font-medium">Cashflow and payment model</p>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <p>Customer terms: {paymentModel.customerTerms}</p>
                <p>Supplier terms: {paymentModel.supplierTerms}</p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="rounded border bg-background p-2"><p className="text-[10px] uppercase">Downpayment</p><p className="font-medium text-foreground">{fmt(paymentModel.downPayment)}</p></div>
                  <div className="rounded border bg-background p-2"><p className="text-[10px] uppercase">Approval</p><p className="font-medium text-foreground">{fmt(paymentModel.approvalMilestone)}</p></div>
                  <div className="rounded border bg-background p-2"><p className="text-[10px] uppercase">Delivery</p><p className="font-medium text-foreground">{fmt(paymentModel.deliveryMilestone)}</p></div>
                  <div className="rounded border bg-background p-2"><p className="text-[10px] uppercase">Guarantee</p><p className="font-medium text-foreground">{fmt(paymentModel.serviceReserve)}</p></div>
                </div>
              </div>
            </div>
          </div>

          {(selectedMetric === 'booked' || selectedMetric === 'pipeline') && (selectedMetric === 'booked' ? selectedAccountOrders : selectedAccountOpportunities).length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{selectedMetric === 'booked' ? 'Order detail' : 'Offer / opportunity detail'}</div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs">Owner</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Margin</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedMetric === 'booked' ? selectedAccountOrders : selectedAccountOpportunities).map((entry: any) => (
                      <TableRow key={entry.id || entry.oppNumber || entry.poDate || entry.customerName}>
                        <TableCell className="text-xs font-medium">{entry.customerName || entry.oppNumber || 'Record'}</TableCell>
                        <TableCell className="text-xs">{entry.productFamily || entry.scope || 'Not assigned'}</TableCell>
                        <TableCell className="text-xs">{entry.kam || 'Unassigned'}</TableCell>
                        <TableCell className="text-xs text-right">{fmt(entry.sellingPrice || entry.estRevenue || 0)}</TableCell>
                        <TableCell className="text-xs text-right">{fmt(entry.margin || 0)}</TableCell>
                        <TableCell className="text-xs">{entry.status || entry.poDate || 'Open'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

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
            <TabsTrigger value="account-detail" className="gap-1"><Target className="h-3.5 w-3.5" /> Account Detail</TabsTrigger>
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
                      <TableRow
                        key={account.customer}
                        onClick={() => setSelectedAccountName(account.customer)}
                        className={selectedAccount?.customer === account.customer ? 'bg-muted/60 cursor-pointer' : 'cursor-pointer hover:bg-muted/30'}
                      >
                        <TableCell className="text-xs font-medium">
                          <div>{account.customer}</div>
                          <div className="text-[10px] text-muted-foreground">{account.regions.join(', ') || account.sector || companyProfile.company_name || 'Portfolio'}</div>
                        </TableCell>
                        <TableCell className="text-xs text-right">{fmt(account.revenue)}</TableCell>
                        <TableCell className="text-xs text-right">{fmt(account.pipeline)}</TableCell>
                        <TableCell className="text-xs text-right">{account.contactCount}</TableCell>
                        <TableCell className="text-xs">{account.kamOwner || 'Unassigned'}</TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2">
                            <Badge variant={account.tier === 'Strategic' ? 'default' : account.tier === 'Growth' ? 'secondary' : 'outline'}>{account.tier}</Badge>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleStrategicStatus(account.customer);
                              }}
                              className={isAccountStrategic(account.customer, account.tier) ? 'rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary' : 'rounded-full border border-dashed border-muted-foreground/60 px-2 py-0.5 text-[9px] font-medium text-muted-foreground'}
                            >
                              {isAccountStrategic(account.customer, account.tier) ? 'Strategic' : 'Standard'}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account-detail">
            {selectedAccount && (
              <div className="space-y-4">
                <div className="grid xl:grid-cols-[260px_1fr] gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Accounts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {accounts.slice(0, 10).map((account) => (
                        <button
                          key={account.customer}
                          type="button"
                          onClick={() => setSelectedAccountName(account.customer)}
                          className={selectedAccount.customer === account.customer ? 'w-full rounded-md border border-primary/40 bg-primary/5 p-2 text-left' : 'w-full rounded-md border border-border p-2 text-left hover:bg-muted/40'}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium">{account.customer}</span>
                            <Badge variant={account.tier === 'Strategic' ? 'default' : account.tier === 'Growth' ? 'secondary' : 'outline'}>{account.tier}</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{fmt(account.pipeline)} in pipeline</p>
                        </button>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{selectedAccount.customer}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">{selectedAccount.regions.join(', ') || selectedAccount.sector || 'Portfolio account'} · {selectedAccount.kamOwner || 'Owner pending'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant={selectedAccountStrategic ? 'default' : 'outline'} size="sm" onClick={() => toggleStrategicStatus(selectedAccount.customer)}>{selectedAccountStrategic ? 'Strategic ON' : 'Set as strategic'}</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingAccount((current) => !current)}><PencilLine className="mr-2 h-3.5 w-3.5" />{isEditingAccount ? 'Lock' : 'Edit'}</Button>
                        <Button type="button" size="sm" onClick={() => updateSelectedNotes(aiAccountSummary)}><Sparkles className="mr-2 h-3.5 w-3.5" />AI brief</Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
                        <div className="rounded-md border p-3"><p className="text-[10px] uppercase text-muted-foreground">Booked revenue</p><p className="text-lg font-semibold mt-1">{fmt(selectedAccount.revenue)}</p></div>
                        <div className="rounded-md border p-3"><p className="text-[10px] uppercase text-muted-foreground">Open pipeline</p><p className="text-lg font-semibold mt-1">{fmt(selectedAccount.pipeline)}</p></div>
                        <div className="rounded-md border p-3"><p className="text-[10px] uppercase text-muted-foreground">Weighted pipeline</p><p className="text-lg font-semibold mt-1">{fmt(selectedAccount.weightedPipeline)}</p></div>
                        <div className="rounded-md border p-3"><p className="text-[10px] uppercase text-muted-foreground">Risk</p><p className="text-lg font-semibold mt-1">{selectedAccountRisk}</p></div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4 text-primary" /> Account snapshot</div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p><span className="font-medium text-foreground">Products:</span> {selectedAccount.products.join(', ') || 'No assigned products'}</p>
                            <p><span className="font-medium text-foreground">Contacts:</span> {selectedAccount.contactCount}</p>
                            <p><span className="font-medium text-foreground">Leads:</span> {selectedAccount.leadCount}</p>
                            <p><span className="font-medium text-foreground">Opportunity volume:</span> {selectedAccountOpportunities.length}</p>
                            <p><span className="font-medium text-foreground">Completeness:</span> {selectedAccount.completeness}</p>
                          </div>
                        </div>

                        <div className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> AI account insight</div>
                          <p className="text-xs text-muted-foreground">{accountNotes[selectedAccount.customer] || aiAccountSummary}</p>
                          {isEditingAccount && (
                            <textarea
                              value={accountNotes[selectedAccount.customer] || aiAccountSummary}
                              onChange={(event) => updateSelectedNotes(event.target.value)}
                              rows={5}
                              className="w-full rounded-md border bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                          )}
                        </div>
                      </div>

                      <div className="grid lg:grid-cols-4 gap-4">
                        <div className="rounded-md border p-3"><div className="flex items-center gap-2 text-sm font-medium"><Landmark className="h-4 w-4 text-primary" /> Finance</div><div className="mt-2 space-y-2 text-xs text-muted-foreground"><p>Collections: {fmt(selectedAccountCollections)}</p><p>Debt exposure: {fmt(selectedAccountDebt)}</p><p>Payments: {selectedAccountOrders.length ? 'Tracked' : 'Pending'}</p>{isEditingAccount ? (
                          <>
                            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Customer payment terms</label>
                            <textarea value={customerPaymentTerms[selectedAccount.customer] || customerPaymentTerms.default} onChange={(event) => setCustomerPaymentTerms((current) => ({ ...current, [selectedAccount.customer]: event.target.value }))} rows={3} className="w-full rounded-md border bg-background p-2 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Supplier payment schedule</label>
                            <textarea value={supplierPaymentTerms[selectedAccount.customer] || supplierPaymentTerms.default} onChange={(event) => setSupplierPaymentTerms((current) => ({ ...current, [selectedAccount.customer]: event.target.value }))} rows={3} className="w-full rounded-md border bg-background p-2 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                          </>
                        ) : (
                          <>
                            <p>Customer terms: {customerPaymentTerms[selectedAccount.customer] || customerPaymentTerms.default}</p>
                            <p>Supplier terms: {supplierPaymentTerms[selectedAccount.customer] || supplierPaymentTerms.default}</p>
                          </>
                        )}</div></div>
                        <div className="rounded-md border p-3"><div className="flex items-center gap-2 text-sm font-medium"><Mail className="h-4 w-4 text-primary" /> Mail threads</div><div className="mt-2 space-y-2 text-xs text-muted-foreground">{selectedAccountMailsForAccount.length === 0 ? <p>No mail threads mapped</p> : selectedAccountMailsForAccount.map((mail) => (
                          <div key={mail.id} className="border rounded-md p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-foreground">{mail.subject}</p>
                              <Badge variant={mail.direction === 'inbound' ? 'secondary' : 'outline'}>{mail.direction}</Badge>
                            </div>
                            <p>{mail.sender}</p>
                            <p>{mail.summary}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">Account:</span>
                              <select
                                value={mail.accountName}
                                onChange={(event) => assignMailToAccount(mail.id, event.target.value)}
                                className="w-full rounded-md border bg-background px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                              >
                                {accounts.map((account) => (
                                  <option key={account.customer} value={account.customer}>{account.customer}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}</div></div>
                        <div className="rounded-md border p-3"><div className="flex items-center justify-between gap-2 text-sm font-medium"><div className="flex items-center gap-2"><Factory className="h-4 w-4 text-primary" /> Active plants</div><Button type="button" variant="outline" size="sm" onClick={addPlantToAccount}>Add plant</Button></div><div className="mt-2 space-y-2 text-xs text-muted-foreground">{selectedAccountPlantList.map((plant) => (<div key={plant.id} className="border-b pb-1 last:border-b-0 last:pb-0"><p className="font-medium text-foreground">{plant.plantName}</p><p>{plant.region} · {plant.status}</p><p>{plant.contact}</p></div>))}</div></div>
                        <div className="rounded-md border p-3"><div className="flex items-center gap-2 text-sm font-medium"><Briefcase className="h-4 w-4 text-primary" /> Active project signals</div><div className="mt-2 space-y-2 text-xs text-muted-foreground">{selectedAccountProjects.length === 0 ? <p>No mapped projects</p> : selectedAccountProjects.map((project) => (<div key={project.name} className="border-b pb-1 last:border-b-0 last:pb-0"><p className="font-medium text-foreground">{project.name}</p><p>{project.status}</p><p>{fmt(project.value)}</p></div>))}</div></div>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-4">
                        <div className="rounded-md border p-3">
                          <div className="flex items-center gap-2 text-sm font-medium"><Briefcase className="h-4 w-4 text-primary" /> Offers and project links</div>
                          <div className="mt-3 space-y-2 text-xs">
                            {linkedOffersForSelectedAccount.length === 0 ? <p className="text-muted-foreground">No linked commercial records found.</p> : linkedOffersForSelectedAccount.map((record) => (
                              <div key={record.id} className="flex items-center justify-between border rounded-md p-2">
                                <div>
                                  <p className="font-medium text-foreground">{record.name}</p>
                                  <p className="text-muted-foreground">{record.type} · {record.product}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium text-foreground">{fmt(record.value)}</p>
                                  <p className="text-muted-foreground">{record.status}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-md border p-3">
                          <div className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4 text-primary" /> Contacts</div>
                          <div className="mt-3 space-y-2 text-xs">
                            {selectedAccountContacts.length === 0 ? <p className="text-muted-foreground">No contacts loaded</p> : selectedAccountContacts.slice(0, 5).map((contact) => (
                              <div key={`${contact.email}-${contact.name}`} className="border rounded-md p-2">
                                <p className="font-medium text-foreground">{contact.name || contact.email || 'Contact'}</p>
                                <p className="text-muted-foreground">{contact.role || 'Commercial contact'}</p>
                                <p className="text-muted-foreground">{contact.email || 'Email pending'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-4">
                        <div className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-primary" /> Documents</div><Button type="button" variant="outline" size="sm" onClick={handleAddDocument}>Add document</Button></div>
                          <div className="mt-3 space-y-2 text-xs">
                            {selectedAccountDocs.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between border rounded-md p-2">
                                <div>
                                  <p className="font-medium text-foreground">{doc.name}</p>
                                  <p className="text-muted-foreground">{doc.type} · {doc.owner}</p>
                                </div>
                                <span className="text-muted-foreground">{doc.updatedAt}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-md border p-3">
                          <div className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4 text-primary" /> Contacts</div>
                          <div className="mt-3 space-y-2 text-xs">
                            {selectedAccountContacts.length === 0 ? <p className="text-muted-foreground">No contacts loaded</p> : selectedAccountContacts.slice(0, 5).map((contact) => (
                              <div key={`${contact.email}-${contact.name}`} className="border rounded-md p-2">
                                <p className="font-medium text-foreground">{contact.name || contact.email || 'Contact'}</p>
                                <p className="text-muted-foreground">{contact.role || 'Commercial contact'}</p>
                                <p className="text-muted-foreground">{contact.email || 'Email pending'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
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
