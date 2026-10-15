jest.mock('@/api/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
import { businessApi, demoBusiness, payoutTotals, reportEnd, reportTotals } from './businessMetrics';
import { apiClient } from '@/api/apiClient';
it('uses the exact PMS period boundary when executing the financial report', async () => {
  expect(reportEnd('2024-03-01')).toBe('2024-02-29');
  const overview = demoBusiness('month').overview;
  await businessApi.report(overview);
  expect(apiClient.post).toHaveBeenCalledWith('/reports/views/execute', expect.objectContaining({ from: overview.financialContext.from, to: reportEnd(overview.financialContext.toExclusive), metrics: ['REVENUE','FEES','MARGIN'] }));
});
it('retains negative margins and does not fabricate a margin from missing metrics', () => {
  expect(reportTotals({ currency:'EUR',rows:[{metrics:{ REVENUE:100, FEES:20, MARGIN:-30 }}] })).toMatchObject({ costs:110,margin:-30,marginPct:-30 });
  expect(() => reportTotals({currency:'EUR',rows:[{metrics:{REVENUE:100}}]})).toThrow();
  expect(reportTotals({currency:'EUR',rows:[]}).marginPct).toBeNull();
});
it('separates payout currencies, paid and pending amounts and excludes failed transfers', () => {
  const base={periodStart:'2026-10-01',commissionAmount:10,netAmount:90};
  const result=payoutTotals([{...base,currency:'EUR',status:'PAID'},{...base,currency:'MAD',status:'APPROVED'},{...base,currency:'EUR',status:'FAILED'},{...base,status:'PENDING'}], '2026-10-01','2026-11-01');
  expect(result.totals).toEqual([{currency:'EUR',commission:10,paid:90,pending:0},{currency:'MAD',commission:10,paid:0,pending:90}]);
  expect(result.unknownCurrency).toBe(true);
});
it.each(['month','quarter','year'] as const)('keeps %s sample occupancy and financial figures consistent', period => {
  const {overview,report}=demoBusiness(period);
  const totals=reportTotals(report);
  expect(totals.revenue).toBe(overview.totalRevenue.value);
  expect(overview.adr.value*overview.financialContext.occupiedNights).toBe(totals.revenue);
  expect(overview.revPan.value*overview.financialContext.availableNights).toBeCloseTo(totals.revenue);
});
