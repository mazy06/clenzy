// ============================================================================
// Analytics Utility Functions
// Pure calculation/helper functions with no React dependencies.
// Extracted from useAnalyticsEngine.ts.
// ============================================================================

import type { DashboardPeriod } from '../modules/dashboard/DashboardDateFilter';
import type { TrendValue } from '../types/analytics';

export const CHANNEL_COLORS: Record<string, string> = {
  airbnb: '#FF5A5F',
  booking: '#003580',
  direct: '#4A9B8E',
  other: '#94A3B8',
};

export function periodToDays(period: DashboardPeriod): number {
  switch (period) {
    case 'week': return 7;
    case 'month': return 30;
    case 'quarter': return 90;
    case 'year': return 365;
    default: return 30;
  }
}

export function getMonthLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

export function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getMonthLabel(d));
  }
  return months;
}

export function getNext6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(getMonthLabel(d));
  }
  return months;
}

export function daysBetween(a: string, b: string): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(0, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

export function calcGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function makeTrend(current: number, previous: number): TrendValue {
  return { value: current, previous, growth: calcGrowth(current, previous) };
}

export function filterByPeriod<T extends { checkIn: string; checkOut: string }>(
  reservations: T[],
  days: number,
): T[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return reservations.filter((r) => new Date(r.checkIn) >= cutoff || new Date(r.checkOut) >= cutoff);
}

export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}
