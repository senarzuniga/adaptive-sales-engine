import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { CompanySelector } from '@/components/CompanySelector';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/store/DataStore';
import { Bell, Bot, UserRound } from 'lucide-react';

import type { ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { companies, activeCompanyId, data } = useData();
  const activeCompany = companies.find((company) => company.id === activeCompanyId);
  const alertCount = data.tasks.filter((task) => task.status !== 'done').length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border bg-card px-4 justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <SidebarTrigger />
              <CompanySelector />
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {activeCompany && (
                <Badge variant="outline" className="hidden md:inline-flex">
                  Active: {activeCompany.company_name}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1"><Bell className="h-3 w-3" /> {alertCount}</Badge>
              <Badge variant="outline" className="gap-1 hidden sm:inline-flex"><Bot className="h-3 w-3" /> AI Assistant</Badge>
              <Badge variant="outline" className="gap-1 hidden lg:inline-flex"><UserRound className="h-3 w-3" /> User</Badge>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

