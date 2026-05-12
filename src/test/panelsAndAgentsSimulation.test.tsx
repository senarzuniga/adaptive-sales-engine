import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { DataProvider, useData } from '@/store/DataStore';
import { AppLayout } from '@/components/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import DataUploadPage from '@/pages/DataUploadPage';
import CompanyInfoPage from '@/pages/CompanyInfoPage';
import Analysis360Page from '@/pages/Analysis360Page';
import SalesArchitecturePage from '@/pages/SalesArchitecturePage';
import KeyAccountManagementPage from '@/pages/KeyAccountManagementPage';
import AfterSalesEnginePage from '@/pages/AfterSalesEnginePage';
import AiAugmentedSalesPage from '@/pages/AiAugmentedSalesPage';
import BehavioralTransformationPage from '@/pages/BehavioralTransformationPage';
import ProductStrategyPage from '@/pages/ProductStrategyPage';
import MonitoringPage from '@/pages/MonitoringPage';
import WeeklyPlannerPage from '@/pages/WeeklyPlannerPage';
import CompanyContactsPage from '@/pages/CompanyContactsPage';
import EmailCobotPage from '@/pages/EmailCobotPage';
import SocialMediaSettingsPage from '@/pages/SocialMediaSettingsPage';
import PortfolioAnalysisPage from '@/pages/PortfolioAnalysisPage';
import MarketingContentPage from '@/pages/MarketingContentPage';
import OfferPricingPage from '@/pages/OfferPricingPage';
import ServiceContractBuilderPage from '@/pages/ServiceContractBuilderPage';
import BudgetCommandCenterPage from '@/pages/BudgetCommandCenterPage';
import CostRatesPage from '@/pages/CostRatesPage';
import BusinessIntelligencePage from '@/pages/BusinessIntelligencePage';
import CommercialActionsRepositoryPage from '@/pages/CommercialActionsRepositoryPage';
import SavedCompaniesPage from '@/pages/SavedCompaniesPage';
import { runDataManagementAgent } from '@/agents/dataManagementAgent';
import { runCustomerEnrichmentAgent } from '@/agents/customerEnrichmentAgent';
import { runProductAnalysisAgent, runProductSearchAgent } from '@/agents/productCatalogAgents';

const renderPanel = (path: string, panel: JSX.Element) => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <DataProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={[path]}>
              <AppLayout>{panel}</AppLayout>
            </MemoryRouter>
          </TooltipProvider>
        </DataProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
};

const panels: Array<[string, JSX.Element]> = [
  ['/', <DashboardPage />],
  ['/upload', <DataUploadPage />],
  ['/company-info', <CompanyInfoPage />],
  ['/360-analysis', <Analysis360Page />],
  ['/sales-architecture', <SalesArchitecturePage />],
  ['/kam', <KeyAccountManagementPage />],
  ['/after-sales', <AfterSalesEnginePage />],
  ['/ai-sales', <AiAugmentedSalesPage />],
  ['/behavioral', <BehavioralTransformationPage />],
  ['/product-strategy', <ProductStrategyPage />],
  ['/monitoring', <MonitoringPage />],
  ['/weekly-planner', <WeeklyPlannerPage />],
  ['/team-directory', <CompanyContactsPage />],
  ['/email-cobot', <EmailCobotPage />],
  ['/social-media', <SocialMediaSettingsPage />],
  ['/portfolio-analysis', <PortfolioAnalysisPage />],
  ['/marketing-content', <MarketingContentPage />],
  ['/offer-pricing', <OfferPricingPage />],
  ['/service-contract-builder', <ServiceContractBuilderPage />],
  ['/budget-command-center', <BudgetCommandCenterPage />],
  ['/cost-rates', <CostRatesPage />],
  ['/business-intelligence', <BusinessIntelligencePage />],
  ['/commercial-actions-repository', <CommercialActionsRepositoryPage />],
  ['/companies', <SavedCompaniesPage />],
];

const Probe = () => {
  const { activeCompanyId, data } = useData();
  return (
    <pre data-testid="loaded-snapshot">
      {JSON.stringify({
        activeCompanyId,
        companyName: data.companyProfile.company_name,
        orders: data.orders.length,
        opportunities: data.opportunities.length,
        products: data.products.length,
        strategy: data.strategy.length,
        leads: data.leads.length,
        contacts: data.contacts.length,
      })}
    </pre>
  );
};

describe('Loaded data simulation, panel smoke simulation, and agent simulation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    localStorage.clear();
  });

  it('loads seeded local data into DataProvider', async () => {
    const companyId = 'local_simco';
    localStorage.setItem('acs_companies', JSON.stringify([{ id: companyId, company_name: 'SimCo', enrichment_status: 'pending' }]));
    localStorage.setItem('acs_active_company', companyId);
    localStorage.setItem(`acs_orders_${companyId}`, JSON.stringify([{ customerName: 'Sim Customer', productFamily: 'Retal', sellingPrice: 1000 }]));
    localStorage.setItem(`acs_opps_${companyId}`, JSON.stringify([{ customerName: 'Sim Customer', productFamily: 'AMR', estRevenue: 2000, status: 'open' }]));
    localStorage.setItem(`acs_products_${companyId}`, JSON.stringify([{ name: 'Retal', type: 'equipment', averageValue: 12000, comments: '' }]));
    localStorage.setItem(`acs_strategy_${companyId}`, JSON.stringify([{ productFamily: 'Retal', estRevenue: 50000, margin: 25 }]));
    localStorage.setItem(`acs_leads_${companyId}`, JSON.stringify([{ leadName: 'Eva Lead', companyName: 'Sim Customer' }]));
    localStorage.setItem(`acs_contacts_${companyId}`, JSON.stringify([{ name: 'Eva Contact', companyName: 'Sim Customer', email: 'eva@simco.test' }]));

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <DataProvider>
            <Probe />
          </DataProvider>
        </LanguageProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      const snapshot = JSON.parse(screen.getByTestId('loaded-snapshot').textContent || '{}');
      expect(snapshot.activeCompanyId).toBe(companyId);
      expect(snapshot.companyName).toBe('SimCo');
      expect(snapshot.orders).toBe(1);
      expect(snapshot.opportunities).toBe(1);
      expect(snapshot.products).toBe(1);
      expect(snapshot.strategy).toBe(1);
      expect(snapshot.leads).toBe(1);
      expect(snapshot.contacts).toBe(1);
    });
  });

  it('renders all working panel routes without crashing', () => {
    panels.forEach(([path, panel]) => {
      const { container, unmount } = renderPanel(path, panel);
      expect(container.querySelector('main')).not.toBeNull();
      unmount();
    });
  });

  it('simulates active frontend agents with loaded data', () => {
    const input = {
      orders: [
        {
          poDate: '2026-01-01',
          firstOfferDate: '2025-12-15',
          oppNumber: 'SIM-001',
          region: 'Europe',
          country: 'Spain',
          customerName: 'Sim Customer',
          scope: 'Automation package',
          productFamily: 'Retal',
          segment: 'Packaging',
          purchasingYear: '2026',
          purchasingQuarter: 'Q1',
          purchasingMonth: 'January',
          sellingPrice: 120000,
          margin: 30,
          kam: 'Diego',
        },
      ],
      opportunities: [
        {
          oppNumber: 'SIM-OPP-001',
          status: 'open',
          region: 'Europe',
          country: 'Spain',
          customerName: 'Sim Customer',
          scope: 'AMR routing extension',
          productFamily: 'AMR Systems',
          segment: 'Packaging',
          estPurchasingYear: '2026',
          estPurchasingQuarter: 'Q3',
          estRevenue: 180000,
          contractProb: 60,
          margin: 28,
          contact: 'Eva Contact',
          kam: 'Diego',
        },
      ],
      products: [
        {
          name: 'Retal',
          averageValue: 90000,
          type: 'equipment',
          comments: 'validated line',
          category: 'product' as const,
          characteristics: ['high throughput'],
          estimatedCost: 60000,
          repositories: ['docs'],
          validated: true,
          source: 'manual' as const,
        },
      ],
      strategy: [
        {
          productFamily: 'Retal',
          numberOfSegment: '3',
          region: 'Europe',
          estPurchasingQuarter: 'Q4',
          estRevenue: 450000,
          margin: 27,
          kam: 'Diego',
        },
      ],
      leads: [
        {
          leadName: 'Eva Lead',
          companyName: 'Sim Customer',
          email: 'eva@simco.test',
          phone: '',
          region: 'Europe',
          country: 'Spain',
          sector: 'Packaging',
          status: 'new',
          source: 'web',
          owner: 'Diego',
          estimatedValue: 30000,
          notes: '',
        },
      ],
      contacts: [
        {
          name: 'Eva Contact',
          email: 'eva@simco.test',
          phone: '',
          role: 'Operations Manager',
          department: 'Operations',
          companyName: 'Sim Customer',
          region: 'Europe',
          country: 'Spain',
          kam: 'Diego',
          notes: '',
        },
      ],
    };

    const management = runDataManagementAgent(input);
    expect(Object.keys(management.registries.companies).length).toBeGreaterThan(0);
    expect(management.quality.some((entry) => entry.dataset === 'orders')).toBe(true);

    const enrichment = runCustomerEnrichmentAgent({ ...input, registries: management.registries });
    expect(enrichment.profiles.length).toBeGreaterThan(0);
    expect(enrichment.profiles[0].companyName).toBe('Sim Customer');

    const catalogSuggestions = runProductSearchAgent({
      products: input.products,
      orders: input.orders,
      opportunities: input.opportunities,
    });
    expect(Array.isArray(catalogSuggestions)).toBe(true);

    const productSignals = runProductAnalysisAgent(input.products[0]);
    expect(productSignals.lifecycleSignal).toBeTruthy();
    expect(productSignals.scenario).toBeTruthy();
  });
});
