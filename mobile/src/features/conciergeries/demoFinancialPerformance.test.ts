import { demoFinancialPerformance } from './demoFinancialPerformance';
import type { DemoPublicClient } from '@/features/marketplace/baitlyDemoClients';

test('demo financial ratios share the occupancy periods and use MAD, not an assumed euro currency', () => {
  const client = { properties: [{ type: 'APARTMENT', performance: [
    { year: 2024, bookedNights: 200, calendarNights: 365 },
    { year: 2025, bookedNights: 250, calendarNights: 365 },
  ] }] } as DemoPublicClient;
  const [previous, current] = demoFinancialPerformance(client);
  expect(previous.currency).toBe('MAD');
  expect(previous.averageNightlyRate).toBe(850);
  expect(current.averageNightlyRate).toBe(915);
  expect(current.revenuePerCalendarNight).toBeCloseTo(250 * 915 / 365);
  expect(current.revenueGrowthPct).toBeCloseTo((250 * 915 / (200 * 850) - 1) * 100);
  expect(current.recordedCostMarginPct).toBeCloseTo((915 - 240) / 915 * 100);
});
