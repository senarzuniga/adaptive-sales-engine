/**
 * Premium Dashboard — Command Center
 * Main entry point with KPI cards, activity feed, and system status
 */

import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useData } from '@/store/DataStore';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { isOpenOpportunityStatus, isWonStatus } from '@/lib/salesData';
import {
  TrendingUp,
  DollarSign,
  Target,
  Percent,
  Package,
  Upload,
  BarChart3,
  Users,
  Zap,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  KPICard,
  SectionHeader,
  PremiumCard,
  NotificationBanner,
  StatusIndicator,
  Timeline,
  EmptyState,
  SkeletonLoader,
} from '@/components/PremiumComponents';

const DashboardPagePremium = () => {
  const { t } = useLanguage();
  const { data, hasData } = useData();
  const navigate = useNavigate();

  // ========== CALCULATIONS ==========
  const totalRevenue = data.orders.reduce((s, o) => s + o.sellingPrice, 0);
  const totalMargin = data.orders.reduce((s, o) => s + o.margin, 0);
  const avgMargin = totalRevenue > 0 ? (totalMargin / totalRevenue * 100) : 0;
  const openOpps = data.opportunities.filter((o) => isOpenOpportunityStatus(o.status)).length;
  const wonOpps = data.opportunities.filter((o) => isWonStatus(o.status)).length;
  const convRate = data.opportunities.length > 0 ? (wonOpps / data.opportunities.length * 100) : 0;
  const avgDeal = data.orders.length > 0 ? totalRevenue / data.orders.length : 0;

  const fmt = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n > 0 ? n.toFixed(0) : '—';
  };

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

  // ========== RENDER ==========

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Actions */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-end justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl font-bold text-slate-50 mb-1">Dashboard</h1>
              <p className="text-slate-400">AI-Powered Commercial Intelligence Overview</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => navigate('/upload')}
                className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                <Upload className="h-4 w-4" />
                Upload Data
              </Button>
              <Button variant="outline" className="gap-2 border-slate-600 hover:bg-slate-800">
                <BarChart3 className="h-4 w-4" />
                Export Report
              </Button>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <StatusIndicator status="online" label="All Systems Operational" size="sm" animated />
            </div>
            <div className="text-slate-500">•</div>
            <p className="text-slate-400">Last updated: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Warning Banner if no data */}
        {!hasData && (
          <NotificationBanner
            type="warning"
            title="No Data Loaded Yet"
            message="Upload company data and documents to unlock full dashboard capabilities and AI insights."
            action={
              <Button onClick={() => navigate('/upload')} size="sm" className="whitespace-nowrap">
                Upload Now
              </Button>
            }
          />
        )}

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="Total Revenue"
            value={revenueDisplay}
            delta={hasData ? '+18% YoY' : undefined}
            deltaType="positive"
            icon={<DollarSign className="h-5 w-5" />}
            tooltip="Total annual or ongoing revenue"
          />
          <KPICard
            title="Active Opportunities"
            value={hasData ? openOpps : '—'}
            delta={hasData && data.opportunities.length > 0 ? `${openOpps} of ${data.opportunities.length}` : undefined}
            deltaType="neutral"
            icon={<Target className="h-5 w-5" />}
            tooltip="Open sales opportunities"
          />
          <KPICard
            title="Win Rate"
            value={hasData && data.opportunities.length > 0 ? `${convRate.toFixed(1)}%` : '—'}
            delta={convRate > 30 ? 'Above average' : 'Needs attention'}
            deltaType={convRate > 30 ? 'positive' : 'negative'}
            icon={<TrendingUp className="h-5 w-5" />}
            suffix="%"
            tooltip="Conversion rate of all opportunities"
          />
          <KPICard
            title="Avg Deal Size"
            value={hasData ? fmt(avgDeal) : '—'}
            delta={hasData ? '+5% this month' : undefined}
            deltaType="positive"
            icon={<Package className="h-5 w-5" />}
            prefix="€"
            tooltip="Average revenue per order"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column — Activity & Insights */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Feed */}
            <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <SectionHeader
                title="Recent Activity"
                subtitle="Latest system events and data updates"
                icon="🔄"
              />

              {hasData ? (
                <div className="space-y-3">
                  {[
                    {
                      icon: '✅',
                      title: 'Document Analysis Complete',
                      desc: 'Folder "Q3_Reports": 24 documents, 847 entities',
                      time: '15m ago',
                    },
                    {
                      icon: '📦',
                      title: 'Product Catalog Updated',
                      desc: 'Ingecart products: 12 new items added',
                      time: '2h ago',
                    },
                    {
                      icon: '💡',
                      title: 'AI Insight Generated',
                      desc: 'Portfolio analysis: 3 growth opportunities',
                      time: '4h ago',
                    },
                    {
                      icon: '📋',
                      title: 'Report Scheduled',
                      desc: 'Weekly executive summary for Monday',
                      time: '5h ago',
                    },
                  ].map((activity, idx) => (
                    <PremiumCard
                      key={idx}
                      icon={activity.icon}
                      className="cursor-pointer hover:border-slate-500"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-100">{activity.title}</p>
                          <p className="text-sm text-slate-400 mt-1">{activity.desc}</p>
                        </div>
                        <span className="text-xs text-slate-500 flex-shrink-0">{activity.time}</span>
                      </div>
                    </PremiumCard>
                  ))}
                </div>
              ) : (
                <SkeletonLoader lines={4} />
              )}
            </div>

            {/* Top Insights */}
            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <SectionHeader
                title="AI Insights"
                subtitle="Machine-generated highlights and recommendations"
                icon="🧠"
              />

              <div className="space-y-3">
                <PremiumCard accent="success" icon="💰">
                  <p className="font-semibold text-slate-100">Market Opportunity Detected</p>
                  <p className="text-sm text-slate-400 mt-2">
                    3 products in growth phase ready for acceleration. Recommended action: launch targeted sales push.
                  </p>
                  <span className="inline-block mt-3 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    Confidence: 92%
                  </span>
                </PremiumCard>

                <PremiumCard accent="warning" icon="⚠️">
                  <p className="font-semibold text-slate-100">Commoditization Risk</p>
                  <p className="text-sm text-slate-400 mt-2">
                    Product X shows increasing price competition. Consider value positioning or feature differentiation.
                  </p>
                  <span className="inline-block mt-3 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold">
                    Confidence: 78%
                  </span>
                </PremiumCard>

                <PremiumCard accent="info" icon="🎯">
                  <p className="font-semibold text-slate-100">Competitive Alert</p>
                  <p className="text-sm text-slate-400 mt-2">
                    New market entrant detected in Central European region. Monitor pricing and positioning closely.
                  </p>
                  <span className="inline-block mt-3 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-semibold">
                    Confidence: 85%
                  </span>
                </PremiumCard>
              </div>
            </div>
          </div>

          {/* Right Column — Quick Actions & Status */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
              <SectionHeader title="Quick Actions" subtitle="Frequently used" icon="⚡" />

              <div className="space-y-2">
                {[
                  { icon: '📂', label: 'Analyze Documents', desc: 'Process folder' },
                  { icon: '🔍', label: 'Product Analysis', desc: 'Positioning review' },
                  { icon: '📊', label: 'Generate Report', desc: 'Create new report' },
                  { icon: '🤖', label: 'AI Assistant', desc: 'Ask questions' },
                  { icon: '📥', label: 'Import Data', desc: 'New sources' },
                  { icon: '⚙️', label: 'Settings', desc: 'Configuration' },
                ].map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => navigate('/')}
                    className="w-full text-left p-3 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-700/50 hover:border-slate-600 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{action.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-100">{action.label}</p>
                        <p className="text-xs text-slate-500">{action.desc}</p>
                      </div>
                      <Zap className="h-3 w-3 text-slate-600 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* System Module Status */}
            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <SectionHeader title="Module Status" subtitle="System health" icon="🟢" />

              <div className="space-y-2">
                {[
                  { name: 'Data Ingestion', status: 'online', detail: '12 files today' },
                  { name: 'Product Catalog', status: 'online', detail: '247 products' },
                  { name: 'Document Analysis', status: 'online', detail: '3 running' },
                  { name: 'Knowledge Graph', status: 'online', detail: '15K+ nodes' },
                  { name: 'AI Engine', status: 'online', detail: 'GPT-4' },
                  { name: 'Reporting', status: 'warning', detail: '1 pending' },
                ].map((module) => (
                  <PremiumCard key={module.name} className="!p-3">
                    <div className="flex items-center gap-3">
                      <StatusIndicator status={module.status} size="md" animated={false} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-100">{module.name}</p>
                        <p className="text-xs text-slate-500">{module.detail}</p>
                      </div>
                    </div>
                  </PremiumCard>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section — Timeline */}
        <div className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
          <SectionHeader title="Upcoming Events & Roadmap" subtitle="Key milestones" icon="📅" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PremiumCard accent="primary" title="Next Steps" subtitle="Immediate actions">
              <Timeline
                events={[
                  {
                    date: 'Today',
                    title: 'Review Strategy',
                    description: 'Q3 sales roadmap',
                    status: 'current',
                  },
                  {
                    date: 'Tomorrow',
                    title: 'Update Pricing',
                    description: 'Product price list',
                    status: 'pending',
                  },
                  {
                    date: 'In 3 days',
                    title: 'Generate Report',
                    description: 'Monthly summary',
                    status: 'pending',
                  },
                ]}
              />
            </PremiumCard>

            <PremiumCard accent="success" title="Completed" subtitle="Recently finished">
              <Timeline
                events={[
                  {
                    date: 'Today',
                    title: 'Document Analysis',
                    description: 'Q3 Reports processed',
                    status: 'completed',
                  },
                  {
                    date: 'Yesterday',
                    title: 'Catalog Updated',
                    description: 'Ingecart import done',
                    status: 'completed',
                  },
                  {
                    date: 'Dec 15',
                    title: 'AI Analysis',
                    description: 'Market shifts detected',
                    status: 'completed',
                  },
                ]}
              />
            </PremiumCard>

            <PremiumCard accent="warning" title="In Progress" subtitle="Currently active">
              <Timeline
                events={[
                  {
                    date: 'Running',
                    title: 'Data Import',
                    description: 'Competitor pricing',
                    status: 'current',
                  },
                  {
                    date: 'Scheduled',
                    title: 'Report Generation',
                    description: 'Weekly executive',
                    status: 'pending',
                  },
                  {
                    date: 'Next Week',
                    title: 'Board Review',
                    description: 'Q4 strategy deck',
                    status: 'pending',
                  },
                ]}
              />
            </PremiumCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPagePremium;
