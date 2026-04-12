import { useLanguage } from '@/i18n/LanguageContext';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  BarChart3,
  Building2,
  Users,
  Wrench,
  Brain,
  Heart,
  Package,
  Upload,
  Info,
  LayoutDashboard,
  Activity,
  CalendarDays,
} from 'lucide-react';

export function AppSidebar() {
  const { t, language, setLanguage } = useLanguage();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  const pillars = [
    { title: t.nav.dashboard, url: '/', icon: LayoutDashboard },
    { title: t.nav.dataUpload, url: '/upload', icon: Upload },
    { title: t.nav.companyInfo, url: '/company-info', icon: Info },
    { title: t.nav.analysis360, url: '/360-analysis', icon: BarChart3 },
    { title: t.nav.salesArchitecture, url: '/sales-architecture', icon: Building2 },
    { title: t.nav.kam, url: '/kam', icon: Users },
    { title: t.nav.afterSales, url: '/after-sales', icon: Wrench },
    { title: t.nav.aiSales, url: '/ai-sales', icon: Brain },
    { title: t.nav.behavioral, url: '/behavioral', icon: Heart },
    { title: t.nav.productStrategy, url: '/product-strategy', icon: Package },
    { title: t.nav.monitoring, url: '/monitoring', icon: Activity },
    { title: t.nav.weeklyPlanner, url: '/weekly-planner', icon: CalendarDays },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <div className="px-3 py-4">
            {!collapsed && (
              <div>
                <h1 className="text-xl font-bold text-primary tracking-tight">{t.appName}</h1>
                <p className="text-xs text-muted-foreground mt-0.5">{t.appSubtitle}</p>
              </div>
            )}
            {collapsed && (
              <h1 className="text-lg font-bold text-primary text-center">A</h1>
            )}
          </div>
          <SidebarGroupLabel>{collapsed ? '' : 'Navigation'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pillars.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            {!collapsed && <span className="text-xs text-muted-foreground">{t.language}:</span>}
            <button
              onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {language === 'en' ? 'EN → ES' : 'ES → EN'}
            </button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
