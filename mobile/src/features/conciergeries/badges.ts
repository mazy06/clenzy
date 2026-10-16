export type ConciergeBadge = 'fire' | 'premium' | 'profit' | 'occupancy' | 'favorite' | 'small-homes' | 'full-service' | 'direct-booking';

/** Published facts only. Missing evidence never grants a badge. */
export interface BadgeEvidence {
  occupancyPct?: number | null;
  completeYear?: boolean;
  properties?: number;
  guestRating?: number | null;
  guestReviews?: number;
  services?: string[];
  smallHomesShare?: number;
  premiumVerified?: boolean;
  directBookingVerified?: boolean;
  comparableNetRevenueGrowthPct?: number;
  comparableMarketOccupancyPct?: number;
  comparableMarketSample?: number;
}

export function conciergeBadges(e: BadgeEvidence): ConciergeBadge[] {
  const badges: ConciergeBadge[] = [];
  const occupancy = e.occupancyPct;
  const annual = e.completeYear === true && (e.properties ?? 0) >= 2
    && occupancy != null && Number.isFinite(occupancy) && occupancy >= 0 && occupancy <= 100;
  if (annual && e.comparableMarketOccupancyPct != null && Number.isFinite(e.comparableMarketOccupancyPct)
    && e.comparableMarketOccupancyPct >= 0 && e.comparableMarketOccupancyPct <= 100
    && (e.comparableMarketSample ?? 0) >= 20 && occupancy! >= e.comparableMarketOccupancyPct + 10) badges.push('fire');
  if (e.premiumVerified === true) badges.push('premium');
  if (e.comparableNetRevenueGrowthPct != null && Number.isFinite(e.comparableNetRevenueGrowthPct)
    && e.comparableNetRevenueGrowthPct >= 10) badges.push('profit');
  if (annual && occupancy! >= 75) badges.push('occupancy');
  if (e.guestRating != null && Number.isFinite(e.guestRating) && e.guestRating >= 4.8 && e.guestRating <= 5
    && (e.guestReviews ?? 0) >= 20) badges.push('favorite');
  if ((e.properties ?? 0) >= 2 && e.smallHomesShare != null && e.smallHomesShare >= 0.7 && e.smallHomesShare <= 1) badges.push('small-homes');
  if (e.directBookingVerified === true) badges.push('direct-booking');
  if (['LISTINGS', 'PRICING', 'GUESTS', 'CLEANING', 'MAINTENANCE', 'OWNER_REPORTING'].every(service => e.services?.includes(service))) badges.push('full-service');
  // Keep an objective alongside a result when possible, rather than two similar metrics.
  const result = badges.find(b => ['fire', 'profit', 'occupancy', 'favorite'].includes(b));
  const specialty = badges.find(b => !['fire', 'profit', 'occupancy', 'favorite'].includes(b));
  return [...new Set([result, specialty, ...badges].filter((b): b is ConciergeBadge => b != null))];
}

export function demoConciergeBadges(client: PublicClient) {
  if (client.role !== 'CONCIERGE') return [];
  const year = new Date().getFullYear() - 1;
  const annual = client.annualPerformance?.find(p => p.year === year) ?? publicPortfolioPerformance(client.properties, year);
  const rating = guestReviewSummary(client.properties);
  const days = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
  return conciergeBadges({ occupancyPct: annual?.occupancyPct, properties: client.properties.length,
    completeYear: !!client.annualPerformance?.some(p => p.year === year) || client.properties.length > 0 && client.properties.every(property => property.performance.some(period =>
      period.year === year && period.calendarNights === days && period.bookedNights >= 0 && period.bookedNights <= days)),
    guestRating: rating.average, guestReviews: rating.count, services: client.managementServices,
    smallHomesShare: client.properties.length ? client.properties.filter(p => p.areaM2 != null && p.areaM2 > 0 && p.areaM2 <= 60).length / client.properties.length : undefined });
}
import { guestReviewSummary, publicPortfolioPerformance } from '@/features/marketplace/baitlyDemoClients';
import type { PublicClient } from './publicProfiles';
