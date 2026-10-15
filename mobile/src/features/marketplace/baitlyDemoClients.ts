import snapshot from './baitlyDemoClients.json';
import { isBaitlyDemoCatalogEnabled } from './baitlyDemoCatalog';

export interface DemoGuestReview {
  id: string; name: string; portraitIndex: number; rating: number; date: string; comment: string;
}
export interface DemoPublicProperty {
  id: string; name: string; type: 'RIAD' | 'APARTMENT'; city: string;
  guests: number; bedrooms: number; bathrooms: number; areaM2: number;
  description: string; photos: string[]; amenities: string[];
  guestReviews: DemoGuestReview[];
  performance: { year: number; calendarNights: number; bookedNights: number }[];
}
export interface DemoPublicClient {
  id: string; demo: true; name: string; role: 'OWNER' | 'CONCIERGE';
  organization: string | null; portraitIndex: number; city: string; bio: string;
  bookingDomain: string; properties: DemoPublicProperty[];
  managementServices: string[]; managementFeePct: number | null;
  networkPublished: boolean; seekingManagement: boolean;
}
export const baitlyDemoClients = snapshot as DemoPublicClient[];
export function demoPublicClient(id: string): DemoPublicClient | undefined {
  return isBaitlyDemoCatalogEnabled() ? baitlyDemoClients.find(client => client.demo && client.id === id) : undefined;
}
export function demoManagementDirectory(role: 'OWNER' | 'CONCIERGE', search = '') {
  if (!isBaitlyDemoCatalogEnabled()) return [];
  const query = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  return baitlyDemoClients.filter(client => client.demo && client.networkPublished && client.role === role
    && (role !== 'OWNER' || client.seekingManagement)
    && [client.name, client.organization ?? '', client.city].some(value => value.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(query)));
}
/** Aggregates only the published fictional portfolio, with a common yearly denominator. */
export function publicPortfolioPerformance(properties: { performance: DemoPublicProperty['performance'] }[], year: number) {
  const periods = properties.flatMap(property => property.performance.filter(period => period.year === year
    && Number.isFinite(period.calendarNights) && period.calendarNights > 0 && Number.isFinite(period.bookedNights)
    && period.bookedNights >= 0 && period.bookedNights <= period.calendarNights));
  const calendar = periods.reduce((total, period) => total + period.calendarNights, 0);
  const booked = periods.reduce((total, period) => total + period.bookedNights, 0);
  return calendar ? { bookedNights: booked, calendarNights: calendar, occupancyPct: booked / calendar * 100 } : null;
}
export function guestReviewSummary(properties: { guestReviews: { rating: number }[];guestRatingAvg?:number|null;guestRatingCount?:number }[]) {
  const totals=properties.map(property=>{
    if(property.guestRatingCount!=null && property.guestRatingCount>=0 && (property.guestRatingCount===0 || typeof property.guestRatingAvg==='number' && property.guestRatingAvg>=1 && property.guestRatingAvg<=5))
      return {count:property.guestRatingCount,sum:(property.guestRatingAvg??0)*property.guestRatingCount};
    const reviews=property.guestReviews.filter(review=>Number.isFinite(review.rating)&&review.rating>=1&&review.rating<=5);
    return {count:reviews.length,sum:reviews.reduce((sum,review)=>sum+review.rating,0)};
  });
  const count=totals.reduce((sum,entry)=>sum+entry.count,0);
  return {count,average:count?totals.reduce((sum,entry)=>sum+entry.sum,0)/count:null};
}
