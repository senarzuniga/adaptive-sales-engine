import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, DollarSign, Target, Percent, Package, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isOpenOpportunityStatus, isWonStatus } from '@/lib/salesData';

const DashboardPage = () => {
  const { t } = useLanguage();
  const { data, hasData } = useData();
  const navigate = useNavigate();

  const totalRevenue = data.orders.reduce((s, o) => s + o.sellingPrice, 0);
  const totalMargin = data.orders.reduce((s, o) => s + o.margin, 0);
  const avgMargin = totalRevenue > 0 ? (totalMargin / totalRevenue * 100) : 0;
  const openOpps = data.opportunities.filter(o => isOpenOpportunityStatus(o.status)).length;
  const wonOpps = data.opportunities.filter(o => isWonStatus(o.status)).length;
  const convRate = data.opportunities.length > 0 ? (wonOpps / data.opportunities.length * 100) : 0;
  const avgDeal = data.orders.length > 0 ? totalRevenue / data.orders.length : 0;
  const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n > 0 ? n.toFixed(0) : '—';

  const parseRevenueText = (text: string): number | null => {
    const m = text.replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*([MmKkBb]?)/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const s = m[2].toUpperCase();
    if (isNaN(n)) return null;
    return s === 'M' ? n * 1e6 : s === 'B' ? n * 1e9 : s === 'K' ? n * 1e3 : n;
  };
  const profileRevenue = parseRevenueText(data.companyProfile.annual_revenue ?? '');
  const revenueDisplay = profileRevenue !== null ? `€${fmt(profileRevenue)}` : hasData ? `€${fmt(totalRevenue)}` : '—';

  const kpiCards = [
    { label: t.dashboard.totalRevenue, value: revenueDisplay, icon: DollarSign },
    { label: t.dashboard.activeOpportunities, value: hasData ? String(openOpps) : '—', icon: Target },
    { label: t.dashboard.conversionRate, value: hasData && data.opportunities.length > 0 ? `${convRate.toFixed(1)}%` : '—', icon: Percent },
    { label: t.dashboard.avgDealSize, value: hasData ? fmt(avgDeal) : '—', icon: Package },
  ];

  const pillarSummaries = [
    { key: 'p0', ...t.pillars.p0 },
    { key: 'p1', ...t.pillars.p1 },
    { key: 'p2', ...t.pillars.p2 },
    { key: 'p3', ...t.pillars.p3 },
    { key: 'p4', ...t.pillars.p4 },
    { key: 'p5', ...t.pillars.p5 },
    { key: 'p6', ...t.pillars.p6 },
  ];

  const pillarRoutes = ['360-analysis', 'sales-architecture', 'kam', 'after-sales', 'ai-sales', 'behavioral', 'product-strategy'];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h2 className="text-2xl font-semibold text-foreground">{t.dashboard.title}</h2>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/upload')} className="gap-2">
            <Upload className="h-4 w-4" /> {t.dashboard.uploadData}
          </Button>
          <Button variant="outline">{t.dashboard.exportReport}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold text-foreground tabular-nums">{kpi.value}</div>
              {!hasData && <p className="text-xs text-muted-foreground mt-2">{t.dashboard.noDataYet}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasData && (
        <Card className="mb-8">
          <CardContent className="py-12 text-center">
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t.dashboard.noDataYet}</h3>
            <p className="text-muted-foreground mb-4">{t.dashboard.uploadPrompt}</p>
            <Button onClick={() => navigate('/upload')} className="gap-2">
              <Upload className="h-4 w-4" /> {t.dashboard.uploadData}
            </Button>
          </CardContent>
        </Card>
      )}

      <h3 className="text-lg font-semibold text-foreground mb-4">Transformation Pillars</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {pillarSummaries.map((pillar, i) => (
          <Card key={pillar.key} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/${pillarRoutes[i]}`)}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {t.dashboard.pillar} {i}
                </span>
              </div>
              <h4 className="font-semibold text-foreground mb-1">{pillar.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{pillar.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
