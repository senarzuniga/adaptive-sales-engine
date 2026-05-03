/**
 * Adaptive Sales Engine — Premium UI Components
 * Reusable, professional components with consistent styling
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { ThemeColors, themeTw } from '@/lib/theme';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';

// ========== KPI CARD ==========

interface KPICardProps {
  title: string;
  value: string | number;
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  prefix?: string;
  suffix?: string;
  tooltip?: string;
  className?: string;
}

export function KPICard({
  title,
  value,
  delta,
  deltaType = 'neutral',
  icon,
  prefix = '',
  suffix = '',
  tooltip,
  className,
}: KPICardProps) {
  const deltaColor =
    deltaType === 'positive'
      ? 'text-emerald-400'
      : deltaType === 'negative'
        ? 'text-red-400'
        : 'text-slate-400';

  const deltaIcon =
    deltaType === 'positive' ? (
      <TrendingUp className="h-3 w-3" />
    ) : deltaType === 'negative' ? (
      <TrendingDown className="h-3 w-3" />
    ) : null;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-5 transition-all duration-300 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/20',
        className
      )}
      title={tooltip}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-5" />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {title}
          </span>
          {icon && <div className="text-slate-500 group-hover:text-blue-400 transition-colors">{icon}</div>}
        </div>

        {/* Value */}
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-50">
            {prefix}
            {value}
            {suffix}
          </span>
        </div>

        {/* Delta */}
        {delta && (
          <div className={cn('flex items-center gap-1 text-sm font-medium', deltaColor)}>
            {deltaIcon}
            {delta}
          </div>
        )}
      </div>

      {/* Top border accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
}

// ========== STAT ROW ==========

interface StatRowProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  status?: 'positive' | 'negative' | 'neutral';
}

export function StatRow({ label, value, icon, status = 'neutral' }: StatRowProps) {
  const statusColor = {
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    neutral: 'text-slate-300',
  }[status];

  return (
    <div className="flex items-center justify-between py-3 px-1 border-b border-slate-700/50">
      <div className="flex items-center gap-3">
        {icon && <div className="text-slate-500">{icon}</div>}
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <span className={cn('font-semibold', statusColor)}>{value}</span>
    </div>
  );
}

// ========== STATUS BADGE ==========

interface StatusBadgeProps {
  status: 'active' | 'pending' | 'completed' | 'failed' | 'warning' | 'info' | 'draft' | 'processing';
  size?: 'sm' | 'md' | 'lg';
  icon?: boolean;
}

const statusConfig = {
  active: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '● ' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '✓ ' },
  success: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '✓ ' },
  pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: '◌ ' },
  warning: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: '⚠ ' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: '✗ ' },
  error: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: '✗ ' },
  info: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: 'ℹ ' },
  draft: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', icon: '📝 ' },
  processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: '⟳ ' },
};

export function StatusBadge({ status, size = 'md', icon = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold transition-all',
        config.bg,
        config.text,
        config.border,
        sizes[size]
      )}
    >
      {icon && config.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ========== PREMIUM CARD ==========

interface PremiumCardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  hoverable?: boolean;
}

const accentColors = {
  primary: 'border-l-blue-500',
  success: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  danger: 'border-l-red-500',
  info: 'border-l-cyan-500',
};

export function PremiumCard({
  title,
  subtitle,
  icon,
  children,
  accent,
  className,
  hoverable = true,
}: PremiumCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm p-5 transition-all duration-300',
        accent && cn('border-l-4', accentColors[accent]),
        hoverable && 'hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/50',
        className
      )}
    >
      {(title || icon) && (
        <div className="mb-4 flex items-center gap-3">
          {icon && <div className="text-slate-400">{icon}</div>}
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="text-slate-300">{children}</div>
    </div>
  );
}

// ========== SECTION HEADER ==========

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, icon, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && <div className="text-xl text-slate-400">{icon}</div>}
          <div>
            <h2 className="text-xl font-bold text-slate-50">{title}</h2>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {/* Gradient divider */}
      <div className="mt-4 h-0.5 bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-transparent" />
    </div>
  );
}

// ========== LOADING SKELETON ==========

export function SkeletonLoader({ lines = 3, width = 'w-full' }: { lines?: number; width?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 rounded-md bg-gradient-to-r from-slate-700 to-slate-800 animate-pulse',
            width
          )}
        />
      ))}
    </div>
  );
}

// ========== EMPTY STATE ==========

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-4xl text-slate-500">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-slate-200">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-slate-400">{description}</p>
      {action}
    </div>
  );
}

// ========== STATUS INDICATOR ==========

interface StatusIndicatorProps {
  status: 'online' | 'warning' | 'offline';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const statusIndicatorColors = {
  online: 'bg-emerald-500',
  warning: 'bg-amber-500',
  offline: 'bg-red-500',
};

export function StatusIndicator({ status, label, size = 'md', animated = true }: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const shadowClasses = {
    online: 'shadow-emerald-500/50',
    warning: 'shadow-amber-500/50',
    offline: 'shadow-red-500/50',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'rounded-full',
          sizeClasses[size],
          statusIndicatorColors[status],
          animated && `shadow-lg ${shadowClasses[status]} animate-pulse`
        )}
      />
      {label && <span className="text-xs text-slate-400">{label}</span>}
    </div>
  );
}

// ========== PROGRESS STEPS ==========

interface ProgressStepsProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function ProgressSteps({ steps, currentStep, onStepClick }: ProgressStepsProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-center flex-1">
          <button
            onClick={() => onStepClick?.(idx)}
            className={cn(
              'relative z-10 flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-all',
              idx < currentStep && 'bg-emerald-500 text-white',
              idx === currentStep && 'bg-blue-500 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900',
              idx > currentStep && 'border border-slate-600 bg-slate-800 text-slate-400'
            )}
          >
            {idx < currentStep ? '✓' : idx + 1}
          </button>

          {idx < steps.length - 1 && (
            <div
              className={cn(
                'mx-2 flex-1 h-1 rounded-full transition-all',
                idx < currentStep ? 'bg-emerald-500' : 'bg-slate-700'
              )}
            />
          )}

          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-slate-400">
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

// ========== NOTIFICATION BANNER ==========

interface NotificationBannerProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  onClose?: () => void;
}

const notificationConfig = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: '📘',
    titleColor: 'text-blue-300',
  },
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    icon: '✅',
    titleColor: 'text-emerald-300',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: '⚠️',
    titleColor: 'text-amber-300',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: '❌',
    titleColor: 'text-red-300',
  },
};

export function NotificationBanner({
  type,
  title,
  message,
  icon,
  action,
  onClose,
}: NotificationBannerProps) {
  const config = notificationConfig[type];

  return (
    <div className={cn('rounded-lg border p-4 animate-fade-in', config.bg, config.border)}>
      <div className="flex items-start gap-3">
        <div className="text-xl flex-shrink-0">{icon || config.icon}</div>
        <div className="flex-1">
          <h3 className={cn('font-semibold', config.titleColor)}>{title}</h3>
          <p className="text-sm text-slate-300">{message}</p>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ========== INFO ROW ==========

interface InfoRowProps {
  label: string;
  value: string | React.ReactNode;
  icon?: React.ReactNode;
  copy?: boolean;
}

export function InfoRow({ label, value, icon, copy }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-2 px-1 border-b border-slate-700/50 hover:bg-slate-700/10 transition-colors group">
      <div className="flex items-center gap-2">
        {icon && <span className="text-slate-500">{icon}</span>}
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-200">{value}</span>
        {copy && (
          <button className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-all">
            📋
          </button>
        )}
      </div>
    </div>
  );
}

// ========== TIMELINE ==========

interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  status: 'completed' | 'current' | 'pending';
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="space-y-4 pl-4 border-l-2 border-slate-700">
      {events.map((event, idx) => {
        const statusColor = {
          completed: 'bg-emerald-500',
          current: 'bg-blue-500 ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900',
          pending: 'bg-slate-600',
        }[event.status];

        return (
          <div key={idx} className="relative -ml-5">
            <div className={cn('h-3 w-3 rounded-full', statusColor)} />
            <div className="mt-1 ml-2">
              <p className="text-xs text-slate-500">{event.date}</p>
              <p className="font-semibold text-slate-200">{event.title}</p>
              {event.description && <p className="text-sm text-slate-400">{event.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
