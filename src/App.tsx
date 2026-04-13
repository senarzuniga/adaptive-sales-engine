import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { DataProvider } from "@/store/DataStore";
import { AppLayout } from "@/components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import DataUploadPage from "./pages/DataUploadPage";
import CompanyInfoPage from "./pages/CompanyInfoPage";
import Analysis360Page from "./pages/Analysis360Page";
import PillarPage from "./pages/PillarPage";
import AfterSalesEnginePage from "./pages/AfterSalesEnginePage";
import MonitoringPage from "./pages/MonitoringPage";
import WeeklyPlannerPage from "./pages/WeeklyPlannerPage";
import CompanyContactsPage from "./pages/CompanyContactsPage";
import EmailCobotPage from "./pages/EmailCobotPage";
import SocialMediaSettingsPage from "./pages/SocialMediaSettingsPage";
import PortfolioAnalysisPage from "./pages/PortfolioAnalysisPage";
import MarketingContentPage from "./pages/MarketingContentPage";
import OfferPricingPage from "./pages/OfferPricingPage";
import ServiceContractBuilderPage from "./pages/ServiceContractBuilderPage";
import ProjectManagementPage from "./pages/ProjectManagementPage";
import BudgetCommandCenterPage from "./pages/BudgetCommandCenterPage";
import CostRatesPage from "./pages/CostRatesPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <DataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/upload" element={<DataUploadPage />} />
                <Route path="/company-info" element={<CompanyInfoPage />} />
                <Route path="/360-analysis" element={<Analysis360Page />} />
                <Route path="/sales-architecture" element={<PillarPage pillarKey="p1" pillarNumber={1} />} />
                <Route path="/kam" element={<PillarPage pillarKey="p2" pillarNumber={2} />} />
                <Route path="/after-sales" element={<AfterSalesEnginePage />} />
                <Route path="/ai-sales" element={<PillarPage pillarKey="p4" pillarNumber={4} />} />
                <Route path="/behavioral" element={<PillarPage pillarKey="p5" pillarNumber={5} />} />
                <Route path="/product-strategy" element={<PillarPage pillarKey="p6" pillarNumber={6} />} />
                <Route path="/monitoring" element={<MonitoringPage />} />
                <Route path="/weekly-planner" element={<WeeklyPlannerPage />} />
                <Route path="/team-directory" element={<CompanyContactsPage />} />
                <Route path="/email-cobot" element={<EmailCobotPage />} />
                <Route path="/social-media" element={<SocialMediaSettingsPage />} />
                <Route path="/portfolio-analysis" element={<PortfolioAnalysisPage />} />
                <Route path="/marketing-content" element={<MarketingContentPage />} />
                <Route path="/offer-pricing" element={<OfferPricingPage />} />
                <Route path="/service-contract-builder" element={<ServiceContractBuilderPage />} />
                <Route path="/project-management" element={<ProjectManagementPage />} />
                <Route path="/budget-command-center" element={<BudgetCommandCenterPage />} />
                <Route path="/cost-rates" element={<CostRatesPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </TooltipProvider>
      </DataProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
