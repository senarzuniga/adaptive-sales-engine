/**
 * Premium Sidebar Navigation
 * Enhanced branding, organization, and visual hierarchy
 */

import { useLanguage } from '@/i18n/LanguageContext';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Briefcase,
  Contact,
  Bot,
  Share2,
  PieChart,
  Megaphone,
  Calculator,
  FolderKanban,
  Landmark,
  Settings2,
  SearchCheck,
  Layers,
  Zap,
  TrendingUp,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusIndicator } from './PremiumComponents';

const navigationGroups = [
  {
    label: '✨ Quick Access',
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard },
      { title: 'Saved Companies', url: '/companies', icon: Briefcase },
    ],
  },
  {
    label: '📊 Core Analytics',
    items: [
      { title: 'Data Upload', url: '/upload', icon: Upload },
      { title: 'Company Info', url: '/company-info', icon: Info },
      { title: '360 Analysis', url: '/360-analysis', icon: BarChart3 },
      { title: 'Portfolio Analysis', url: '/portfolio-analysis', icon: PieChart },
      { title: 'Business Intelligence', url: '/business-intelligence', icon: SearchCheck },
    ],
  },
  {
    label: '🏢 Commercial Intelligence',
    items: [
      { title: 'Sales Architecture', url: '/sales-architecture', icon: Building2 },
      { title: 'Key Account Mgmt', url: '/kam', icon: Users },
      { title: 'After Sales Engine', url: '/after-sales', icon: Wrench },
      { title: 'AI Sales Augmented', url: '/ai-sales', icon: Brain },
      { title: 'Behavioral Transform', url: '/behavioral', icon: Heart },
    ],
  },
  {
    label: '📦 Product Management',
    items: [
      { title: 'Product Catalog', url: '/product-catalog', icon: Package },
      { title: 'Product Strategy', url: '/product-strategy', icon: TrendingUp },
      { title: 'Commercial Actions', url: '/commercial-actions-repository', icon: Layers },
    ],
  },
  {
    label: '📋 Operations',
    items: [
      { title: 'Weekly Planner', url: '/weekly-planner', icon: CalendarDays },
      { title: 'Project Management', url: '/project-management', icon: FolderKanban },
      { title: 'Monitoring', url: '/monitoring', icon: Activity },
    ],
  },
  {
    label: '💼 Business Support',
    items: [
      { title: 'Budget Command Center', url: '/budget-command-center', icon: Landmark },
      { title: 'Cost & Rates', url: '/cost-rates', icon: Calculator },
      { title: 'Offer & Pricing', url: '/offer-pricing', icon: Calculator },
      { title: 'Service Contract Builder', url: '/service-contract-builder', icon: GraduationCap },
    ],
  },
  {
    label: '🤖 Engagement',
    items: [
      { title: 'Team Directory', url: '/team-directory', icon: Contact },
      { title: 'Email Cobot', url: '/email-cobot', icon: Bot },
      { title: 'Marketing Content', url: '/marketing-content', icon: Megaphone },
      { title: 'Social Media', url: '/social-media', icon: Share2 },
    ],
  },
];

const systemModules = [
  { name: 'Data Ingestion', status: 'online' as const, detail: '✓ Active' },
  { name: 'Product Catalog', status: 'online' as const, detail: '247 items' },
  { name: 'AI Engine', status: 'online' as const, detail: 'GPT-4 Turbo' },
  { name: 'Knowledge Graph', status: 'online' as const, detail: '15K+ nodes' },
  { name: 'Reporting', status: 'warning' as const, detail: '1 pending' },
];

export function AppSidebar() {
  const { t } = useLanguage();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (url: string) => location.pathname === url;

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-700 bg-slate-900">
      <SidebarContent className="bg-gradient-to-b from-slate-900 to-slate-950">
        {/* Brand Header */}
        {!collapsed && (
          <div className="px-4 py-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                🏢
              </div>
              <div>
                <h1 className="text-sm font-bold gradient-text">Adaptive</h1>
                <p className="text-xs text-slate-500">Sales Engine</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">AI-Powered B2B Intelligence</p>
          </div>
        )}

        {/* Navigation Groups */}
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-3">
            {!collapsed && (
              <SidebarGroupLabel className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.url)}
                      className={cn(
                        'relative transition-all duration-200 group mx-1',
                        isActive(item.url)
                          ? 'bg-blue-500/20 text-blue-300 border-l-2 border-blue-500'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      )}
                      tooltip={collapsed ? item.title : undefined}
                    >
                      {/* Active indicator bar */}
                      {isActive(item.url) && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-blue-500 rounded-r" />
                      )}

                      <item.icon className="h-4 w-4 flex-shrink-0" />

                      {!collapsed && (
                        <>
                          <span className="flex-1 text-sm font-medium">{item.title}</span>
                          {isActive(item.url) && (
                            <Zap className="h-3 w-3 text-blue-400 animate-glow-pulse" />
                          )}
                        </>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* System Status Footer */}
      {!collapsed && (
        <SidebarFooter className="border-t border-slate-700/50 bg-gradient-to-t from-slate-950 to-slate-900">
          <div className="px-4 py-4 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              System Status
            </div>
            <div className="space-y-2">
              {systemModules.map((module) => (
                <div key={module.name} className="flex items-center gap-2 text-xs">
                  <StatusIndicator status={module.status} size="sm" />
                  <span className="text-slate-400 flex-1">{module.name}</span>
                  <span className="text-slate-600 text-xs">{module.detail}</span>
                </div>
              ))}
            </div>

            {/* Footer branding */}
            <div className="pt-3 border-t border-slate-700/50 text-xs text-slate-500 text-center">
              <p>Adaptive Sales Engine</p>
              <p>v2.1.0 • © 2024 Ingecart</p>
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
