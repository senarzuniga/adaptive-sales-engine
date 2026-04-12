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
import MonitoringPage from "./pages/MonitoringPage";
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
                <Route path="/after-sales" element={<PillarPage pillarKey="p3" pillarNumber={3} />} />
                <Route path="/ai-sales" element={<PillarPage pillarKey="p4" pillarNumber={4} />} />
                <Route path="/behavioral" element={<PillarPage pillarKey="p5" pillarNumber={5} />} />
                <Route path="/product-strategy" element={<PillarPage pillarKey="p6" pillarNumber={6} />} />
                <Route path="/monitoring" element={<MonitoringPage />} />
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
