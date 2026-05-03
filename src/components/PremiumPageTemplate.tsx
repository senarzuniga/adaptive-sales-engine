/**
 * Premium Page Template
 * Use this as a wrapper for all module pages to ensure consistent styling and layout
 */

import React from 'react';
import { SectionHeader, PremiumCard, NotificationBanner, SkeletonLoader } from '@/components/PremiumComponents';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PremiumPageProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  hasData?: boolean;
  isLoading?: boolean;
  emptyStateIcon?: React.ReactNode;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateAction?: React.ReactNode;
  notification?: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    onClose?: () => void;
  };
  className?: string;
  children: React.ReactNode;
}

/**
 * Premium Page Wrapper
 * Provides consistent header, layout, and styling for all module pages
 *
 * Usage:
 * ```tsx
 * <PremiumPageTemplate
 *   title="Product Management"
 *   subtitle="Manage and analyze products"
 *   icon="📦"
 *   hasData={hasData}
 *   isLoading={isLoading}
 *   actions={<Button onClick={() => {}}>Add Product</Button>}
 * >
 *   <div>Your page content here</div>
 * </PremiumPageTemplate>
 * ```
 */
export function PremiumPageTemplate({
  title,
  subtitle,
  icon,
  actions,
  hasData = true,
  isLoading = false,
  emptyStateIcon = '📭',
  emptyStateTitle = 'No Data Yet',
  emptyStateDescription = 'Start by uploading data or creating new items.',
  emptyStateAction,
  notification,
  className,
  children,
}: PremiumPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              {icon && <span className="text-3xl">{icon}</span>}
              <div>
                <h1 className="text-3xl font-bold text-slate-50">{title}</h1>
                {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
              </div>
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>

          {/* Decorative gradient line */}
          <div className="h-0.5 bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-transparent" />
        </div>

        {/* Notification Banner */}
        {notification && (
          <div className="mb-6 animate-slide-in-right">
            <NotificationBanner
              type={notification.type}
              title={notification.title}
              message={notification.message}
              onClose={notification.onClose}
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6 mb-6">
            <SkeletonLoader lines={5} />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !hasData && (
          <PremiumCard className="text-center py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="text-5xl">{emptyStateIcon}</div>
              <div>
                <h3 className="text-xl font-semibold text-slate-100">{emptyStateTitle}</h3>
                <p className="text-slate-400 text-sm mt-2">{emptyStateDescription}</p>
              </div>
              {emptyStateAction && <div className="mt-4">{emptyStateAction}</div>}
            </div>
          </PremiumCard>
        )}

        {/* Content */}
        {!isLoading && hasData && <div className={cn('animate-fade-in', className)}>{children}</div>}
      </div>
    </div>
  );
}

/**
 * Page Section Container
 * Use for grouping related content within a page
 */
interface PageSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageSection({
  title,
  subtitle,
  icon,
  action,
  children,
  className,
}: PageSectionProps) {
  return (
    <div className={cn('mb-8', className)}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        action={action}
      />
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/**
 * Content Grid
 * Responsive grid for displaying cards and content
 */
interface ContentGridProps {
  cols?: 'auto' | 1 | 2 | 3 | 4 | 5 | 6;
  gap?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

export function ContentGrid({
  cols = 3,
  gap = 'md',
  children,
  className,
}: ContentGridProps) {
  const colsClass = {
    auto: 'grid-cols-auto',
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-6',
  }[cols];

  const gapClass = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  }[gap];

  return (
    <div className={cn('grid', colsClass, gapClass, className)}>
      {children}
    </div>
  );
}

/**
 * Stats Row
 * Display key metrics or statistics
 */
interface StatsRowProps {
  stats: Array<{ label: string; value: string | number; icon?: React.ReactNode }>;
  className?: string;
}

export function StatsRow({ stats, className }: StatsRowProps) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6', className)}>
      {stats.map((stat, idx) => (
        <PremiumCard key={idx} className="text-center">
          {stat.icon && <div className="text-2xl mb-2 flex justify-center">{stat.icon}</div>}
          <div className="text-2xl font-bold text-slate-50">{stat.value}</div>
          <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
        </PremiumCard>
      ))}
    </div>
  );
}
