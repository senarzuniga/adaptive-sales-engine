/**
 * Adaptive Sales Engine — Premium Design System
 * Central theme configuration for the entire application
 */

export const ThemeColors = {
  // Primary palette — Deep professional blue
  PRIMARY: '#1E3A5F',
  PRIMARY_LIGHT: '#2D5F8A',
  PRIMARY_DARK: '#0F2440',
  PRIMARY_GLOW: '#3B82F6',

  // Accent palette
  ACCENT_GREEN: '#10B981',
  ACCENT_ORANGE: '#F59E0B',
  ACCENT_RED: '#EF4444',
  ACCENT_PURPLE: '#8B5CF6',
  ACCENT_TEAL: '#14B8A6',

  // Neutral palette (for dark mode)
  BG_DARK: '#0F172A',
  BG_CARD: '#1E293B',
  BG_SIDEBAR: '#0F172A',
  BG_INPUT: '#334155',
  BORDER: '#475569',
  TEXT_PRIMARY: '#F1F5F9',
  TEXT_SECONDARY: '#94A3B8',
  TEXT_MUTED: '#64748B',

  // Light mode alternatives
  BG_LIGHT: '#F8FAFC',
  CARD_LIGHT: '#FFFFFF',
  TEXT_LIGHT: '#1E293B',
};

export const ThemeSpacing = {
  XS: '4px',
  SM: '8px',
  MD: '16px',
  LG: '24px',
  XL: '32px',
  '2XL': '48px',
};

export const ThemeRadius = {
  SM: '6px',
  MD: '10px',
  LG: '16px',
  XL: '24px',
};

export const ThemeShadows = {
  SM: '0 1px 2px rgba(0,0,0,0.3)',
  MD: '0 4px 6px rgba(0,0,0,0.4)',
  LG: '0 10px 25px rgba(0,0,0,0.5)',
  GLOW: '0 0 20px rgba(59,130,246,0.3)',
};

export const ThemeGradients = {
  PRIMARY: 'linear-gradient(135deg, #1E3A5F 0%, #3B82F6 100%)',
  DARK: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
  ACCENT: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
  SUCCESS: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
  WARNING: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
  DANGER: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
};

export const ThemeTransitions = {
  FAST: '0.15s ease',
  NORMAL: '0.3s ease',
  SLOW: '0.5s ease',
};

// Tailwind class utilities
export const themeTw = {
  cardHover: 'hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 -translate-y-0.5 hover:-translate-y-1',
  fadeIn: 'animate-fade-in',
  slideInRight: 'animate-slide-in-right',
  pulse: 'animate-pulse',
  gradientText: 'bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent',
};
