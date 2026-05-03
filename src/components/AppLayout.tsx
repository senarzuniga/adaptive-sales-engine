import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { CompanySelector } from '@/components/CompanySelector';
import { PanelPromptBox } from '@/components/PanelPromptBox';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border bg-card px-4 justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <CompanySelector />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
          <PanelPromptBox />
        </div>
      </div>
    </SidebarProvider>
  );
}
