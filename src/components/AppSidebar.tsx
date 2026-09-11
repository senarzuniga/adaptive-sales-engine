import { useLanguage } from '@/i18n/LanguageContext';
import { NavLink } from '@/components/NavLink';
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
  Activity,
  BarChart3,
  Bot,
  Brain,
  Building2,
  CalendarDays,
  Calculator,
  Contact,
  FileText,
  FolderKanban,
  Heart,
  Info,
  Landmark,
  Layers,
  LayoutDashboard,
  Megaphone,
  Package,
  PieChart,
  SearchCheck,
  Settings2,
  Share2,
  Upload,
  Users,
  Wrench,
} from 'lucide-react';

type NavSection = {
  label: string;
  items: Array<{ title: string; url: string; icon: any }>;
};

export function AppSidebar() {
  const { language, setLanguage } = useLanguage();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const isEs = language === 'es';

  const sections: NavSection[] = [
    {
      label: isEs ? 'Ejecucion diaria' : 'Daily Execution',
      items: [
        { title: isEs ? 'Mi trabajo' : 'My Work', url: '/', icon: LayoutDashboard },
        { title: isEs ? 'Repositorio de acciones' : 'Action Repository', url: '/commercial-actions-repository', icon: Layers },
        { title: isEs ? 'Planificador semanal' : 'Weekly Planner', url: '/weekly-planner', icon: CalendarDays },
      ],
    },
    {
      label: isEs ? 'Empresa' : 'Company',
      items: [
        { title: isEs ? 'Empresas' : 'Companies', url: '/companies', icon: Building2 },
        { title: isEs ? 'Organizacion' : 'Organization', url: '/company-info', icon: Info },
        { title: isEs ? 'Personas y contactos' : 'People & Contacts', url: '/team-directory', icon: Contact },
        { title: isEs ? 'Carga de datos' : 'Data Upload', url: '/upload', icon: Upload },
      ],
    },
    {
      label: 'CRM',
      items: [
        { title: isEs ? 'Clientes y contexto' : 'Customers & Context', url: '/kam', icon: Users },
        { title: isEs ? 'Analisis 360' : '360 Analysis', url: '/360-analysis', icon: BarChart3 },
        { title: isEs ? 'Cobot de email' : 'Email Cobot', url: '/email-cobot', icon: Bot },
      ],
    },
    {
      label: isEs ? 'Ventas' : 'Sales',
      items: [
        { title: isEs ? 'Ofertas y pipeline' : 'Offers & Pipeline', url: '/commercial-actions-repository', icon: Layers },
        { title: isEs ? 'Pricing y costes' : 'Pricing & Costs', url: '/offer-pricing', icon: Calculator },
        { title: isEs ? 'Inteligencia comercial' : 'Sales Intelligence', url: '/ai-sales', icon: Brain },
        { title: isEs ? 'Arquitectura comercial' : 'Sales Architecture', url: '/sales-architecture', icon: Building2 },
      ],
    },
    {
      label: isEs ? 'Proyectos' : 'Projects',
      items: [
        { title: isEs ? 'Control de proyectos' : 'Project Control', url: '/project-management', icon: FolderKanban },
        { title: isEs ? 'Project finance' : 'Project Finance', url: '/budget-command-center', icon: Landmark },
        { title: isEs ? 'Monitoreo' : 'Monitoring', url: '/monitoring', icon: Activity },
        { title: isEs ? 'Postventa' : 'After Sales', url: '/after-sales', icon: Wrench },
      ],
    },
    {
      label: isEs ? 'Productos y marketing' : 'Products & Marketing',
      items: [
        { title: isEs ? 'Estrategia de producto' : 'Product Strategy', url: '/product-strategy', icon: Package },
        { title: isEs ? 'Contenido de marketing' : 'Marketing Content', url: '/marketing-content', icon: Megaphone },
        { title: isEs ? 'Redes sociales' : 'Social Media', url: '/social-media', icon: Share2 },
      ],
    },
    {
      label: isEs ? 'Finanzas y conocimiento' : 'Finance & Knowledge',
      items: [
        { title: isEs ? 'Budget command center' : 'Budget Command Center', url: '/budget-command-center', icon: Landmark },
        { title: isEs ? 'Tasas y costes' : 'Cost Rates', url: '/cost-rates', icon: Settings2 },
        { title: isEs ? 'Inteligencia empresarial' : 'Business Intelligence', url: '/business-intelligence', icon: SearchCheck },
        { title: isEs ? 'Analisis de portfolio' : 'Portfolio Analysis', url: '/portfolio-analysis', icon: PieChart },
      ],
    },
    {
      label: 'AI',
      items: [
        { title: isEs ? 'Ventas aumentadas por IA' : 'AI-Augmented Sales', url: '/ai-sales', icon: Brain },
        { title: isEs ? 'Transformacion conductual' : 'Behavioral Transform', url: '/behavioral', icon: Heart },
        { title: isEs ? 'Informes ejecutivos' : 'Executive Reports', url: '/360-analysis', icon: FileText },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-3 py-4 border-b border-sidebar-border">
          {!collapsed ? (
            <div>
              <h1 className="text-xl font-bold text-primary tracking-tight">ASE</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Adaptive Sales Engine</p>
            </div>
          ) : (
            <h1 className="text-lg font-bold text-primary text-center">A</h1>
          )}
        </div>

        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{collapsed ? '' : section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.url + item.title}>
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
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            {!collapsed && <span className="text-xs text-muted-foreground">{isEs ? 'Idioma' : 'Language'}:</span>}
            <button
              onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {language === 'en' ? 'EN -> ES' : 'ES -> EN'}
            </button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}


