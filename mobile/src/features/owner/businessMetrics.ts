import { apiClient } from '@/api/apiClient';
export type BusinessPeriod = 'month' | 'quarter' | 'year';
export interface Trend { value: number; growth: number; previousValue?: number | null }
export interface BusinessOverview {
  financialContext: { from: string; toExclusive: string; currency: string; occupiedNights: number; availableNights: number };
  totalRevenue: Trend; occupancyRate: Trend; adr: Trend; revPan: Trend; bookings: Trend;
  guestRating: { average: number; count: number }; properties: { active: number; total: number };
  interventions: { today: number; upcoming: number; completed: number; total: number; completionRate: number };
  urgentInterventionsCount: number; pendingPaymentsCount: number;
  revenueByChannel?: { source: string; label: string; amount: number; pct: number }[];
}
export interface BusinessReport { currency: string; rows: { metrics: Record<string, number> }[] }
export interface BusinessPayout { periodStart: string; currency?: string; status: string; commissionAmount: number; netAmount: number }
export function reportTotals(report: BusinessReport) {
  const total = (key: string) => report.rows.reduce((sum, row) => {
    const value = row.metrics[key]; if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Missing ${key}`);
    return sum + value;
  }, 0);
  const revenue = total('REVENUE'), fees = total('FEES'), margin = total('MARGIN');
  return { revenue, fees, margin, costs: Math.max(0, revenue - fees - margin), marginPct: revenue > 0 ? margin / revenue * 100 : null };
}
/** Date strings are civil dates. The PMS report's end is inclusive, the summary's end exclusive. */
export function reportEnd(toExclusive: string) {
  const date = new Date(`${toExclusive}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10);
}
export function payoutTotals(items: BusinessPayout[], from: string, toExclusive: string) {
  const totals = new Map<string, { commission: number; paid: number; pending: number }>();
  let unknownCurrency = false;
  items.filter(item => item.periodStart >= from && item.periodStart < toExclusive && ['PENDING','APPROVED','PROCESSING','PAID'].includes(item.status)).forEach(item => {
    if (!item.currency || !/^[A-Z]{3}$/.test(item.currency)) { unknownCurrency = true; return; }
    if (!Number.isFinite(item.netAmount) || !Number.isFinite(item.commissionAmount)) throw new Error('Invalid payout');
    const bucket = totals.get(item.currency) ?? { commission: 0, paid: 0, pending: 0 };
    bucket.commission += item.commissionAmount;
    if (item.status === 'PAID') bucket.paid += item.netAmount; else bucket.pending += item.netAmount;
    totals.set(item.currency, bucket);
  });
  return { totals: [...totals].map(([currency, values]) => ({ currency, ...values })), unknownCurrency };
}
export const businessApi = {
  overview: (period: BusinessPeriod, signal?: AbortSignal) => apiClient.get<BusinessOverview>('/dashboard/overview-summary', { params: { period }, signal }),
  report: (overview: BusinessOverview) => apiClient.post<BusinessReport>('/reports/views/execute', {
    dimensions: ['PERIOD'], metrics: ['REVENUE','FEES','MARGIN'], granularity: 'MONTH',
    from: overview.financialContext.from, to: reportEnd(overview.financialContext.toExclusive),
  }),
  payouts: (signal?: AbortSignal) => apiClient.get<BusinessPayout[]>('/accounting/payouts', { signal }),
};
export function demoBusiness(period: BusinessPeriod) {
  const days = period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
  const nights = Math.round(days * 8 * .75), revenue = nights * 520, fees = revenue * .15, costs = nights * 44;
  const end = new Date(); const start = new Date(end); start.setDate(start.getDate() - days);
  const civil = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const trend = (value: number): Trend => ({ value, previousValue: value / 1.12, growth: 12 });
  const overview: BusinessOverview = { financialContext: { from: civil(start), toExclusive: civil(end), currency: 'MAD', occupiedNights: nights, availableNights: days*8 },
    totalRevenue: trend(revenue), occupancyRate: { value: nights/(days*8)*100, previousValue: 68, growth: 10.3 }, adr: trend(520), revPan: trend(revenue/(days*8)), bookings: trend(Math.round(nights/3)),
    guestRating: { average: 4.8, count: Math.round(days*.8) }, properties: { active: 8, total: 9 }, interventions: { today: 4, upcoming: 12, completed: Math.round(days*2.4), total: Math.round(days*2.6), completionRate: 92.3 },
    urgentInterventionsCount: 2, pendingPaymentsCount: 3, revenueByChannel: [{ source: 'AIRBNB', label: 'Airbnb', amount: revenue*.6, pct: 60 }, { source: 'BOOKING', label: 'Booking.com', amount: revenue*.3, pct: 30 }, { source: 'DIRECT', label: 'Direct', amount: revenue*.1, pct: 10 }] };
  const report: BusinessReport = { currency: 'MAD', rows: [{ metrics: { REVENUE: revenue, FEES: fees, MARGIN: revenue-fees-costs } }] };
  const payouts: BusinessPayout[] = [{ periodStart: civil(start), currency:'MAD', status:'PAID', commissionAmount: revenue*.08, netAmount: revenue*.54 }, { periodStart:civil(start), currency:'MAD', status:'APPROVED', commissionAmount:revenue*.02, netAmount:revenue*.12 }];
  return { overview, report, payouts };
}
