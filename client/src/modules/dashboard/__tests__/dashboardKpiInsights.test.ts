import { describe, expect, it } from 'vitest';
import type { FinancialKpis } from '../../../hooks/useDashboardOverview';
import type { DashboardFinancialContext } from '../../../services/api/dashboardOverviewApi';
import { assessDashboardKpi, hasKpiBaseline } from '../dashboardKpiInsights';

const trend = { value: 120, previousValue: 100, growth: 20 };
const metrics = (): FinancialKpis => ({ occupancyRate: { value: 80, previousValue: 70, growth: 14.3 },
  totalRevenue: { ...trend }, adr: { ...trend }, revPAN: { ...trend }, bookings: { ...trend }, guestRating: { average: 4.8, count: 20 } });
const context: DashboardFinancialContext = { from: '2026-09-05', toExclusive: '2026-10-05', timezone: 'Europe/Paris',
  currency: 'EUR', metric: 'ACCOMMODATION_REVENUE', occupiedNights: 24, availableNights: 30 };

describe('dashboard KPI recommendations', () => {
  it.each([[80, 'excellent'], [60, 'good'], [40, 'watch'], [20, 'alarming'], [19.9, 'critical']] as const)(
    'classifies occupancy %s at the documented boundary', (value, level) => {
      const kpis = metrics(); kpis.occupancyRate.value = value;
      expect(assessDashboardKpi('occupancy', kpis, context, 1).level).toBe(level);
    });
  it.each([[15, 'excellent'], [0, 'good'], [-15, 'watch'], [-35, 'alarming'], [-35.1, 'critical']] as const)(
    'classifies revenue growth %s without relying on the absolute amount', (growth, level) => {
      const kpis = metrics(); kpis.totalRevenue.growth = growth;
      expect(assessDashboardKpi('revenue', kpis, context, 1).level).toBe(level);
    });
  it('does not call a start from zero an excellent 100% rise', () => {
    const kpis = metrics(); kpis.totalRevenue = { value: 400, previousValue: 0, growth: 100 };
    expect(assessDashboardKpi('revenue', kpis).reason).toBe('noBaseline');
    expect(hasKpiBaseline(kpis.totalRevenue)).toBe(false);
  });
  it('fails closed during a rolling deployment and for non-finite data', () => {
    const kpis = metrics(); kpis.totalRevenue = { value: 400, growth: 100 };
    expect(assessDashboardKpi('revenue', kpis).level).toBe('unrated');
    kpis.totalRevenue = { value: NaN, growth: 10, previousValue: 100 };
    expect(assessDashboardKpi('revenue', kpis).level).toBe('unrated');
    expect(assessDashboardKpi('revenue', null).level).toBe('unrated');
  });
  it('distinguishes a closed portfolio from unsold available nights', () => {
    const kpis = metrics(); kpis.occupancyRate.value = 0;
    expect(assessDashboardKpi('occupancy', kpis, { ...context, availableNights: 0 }, 1).level).toBe('unrated');
    expect(assessDashboardKpi('occupancy', kpis, context, 0).level).toBe('unrated');
    expect(assessDashboardKpi('occupancy', kpis, context, 1).level).toBe('critical');
    kpis.occupancyRate.previousValue = 0;
    expect(assessDashboardKpi('occupancy', kpis, context, 1).reason).toBe('noBaseline');
  });
  it('does not classify absent or too few reviews as a quality failure', () => {
    const kpis = metrics(); kpis.guestRating = { average: 0, count: 0 };
    expect(assessDashboardKpi('rating', kpis).reason).toBe('noReviews');
    kpis.guestRating = { average: 1, count: 4 };
    expect(assessDashboardKpi('rating', kpis).reason).toBe('fewReviews');
    kpis.guestRating.count = 5;
    expect(assessDashboardKpi('rating', kpis).level).toBe('critical');
  });
  it('does not encourage raising prices when revenue per available night falls', () => {
    const kpis = metrics(); kpis.revPAN.growth = -20;
    expect(assessDashboardKpi('adr', kpis)).toEqual({ level: 'watch', reason: 'priceBalance' });
  });
  it('withholds a bookings trend with a tiny baseline, but catches a real collapse to zero', () => {
    const kpis = metrics(); kpis.bookings = { value: 4, previousValue: 2, growth: 100 };
    expect(assessDashboardKpi('bookings', kpis).reason).toBe('fewBookings');
    kpis.bookings = { value: 0, previousValue: 15, growth: -100 };
    expect(assessDashboardKpi('bookings', kpis).level).toBe('critical');
  });
});
