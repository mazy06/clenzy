import type { DemoPublicClient } from '@/features/marketplace/baitlyDemoClients';
import type { FinancialPerformance } from './publicProfiles';

/** Fictional MAD amounts for the local demonstration, never an API fallback. */
export function demoFinancialPerformance(client: DemoPublicClient): FinancialPerformance[] {
  const years = [...new Set(client.properties.flatMap(p => p.performance.map(period => period.year)))].sort();
  const periods = years.map(year => {
    let booked = 0, calendar = 0, revenue = 0, costs = 0;
    client.properties.forEach((property, index) => {
      const period = property.performance.find(p => p.year === year);
      if (!period) return;
      const nightly = (property.type === 'RIAD' ? 1450 : 850) + index * 100 + (year - years[0]) * 65;
      booked += period.bookedNights; calendar += period.calendarNights;
      revenue += period.bookedNights * nightly;
      costs += period.bookedNights * (property.type === 'RIAD' ? 390 : 240);
    });
    return { year, currency: 'MAD', properties: client.properties.length, bookedNights: booked,
      calendarNights: calendar, occupancyPct: calendar ? booked / calendar * 100 : undefined,
      averageNightlyRate: booked ? revenue / booked : undefined,
      revenuePerCalendarNight: calendar ? revenue / calendar : undefined,
      recordedCostMarginPct: revenue ? (revenue - costs) / revenue * 100 : undefined,
      financialCoveragePct: 100, costCoveragePct: 100 };
  });
  return periods.map((period, index) => {
    const previous = periods[index - 1]?.revenuePerCalendarNight;
    return { ...period, revenueGrowthPct: previous && period.revenuePerCalendarNight != null
      ? (period.revenuePerCalendarNight / previous - 1) * 100 : undefined };
  });
}
