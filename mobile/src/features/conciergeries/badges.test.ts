import { conciergeBadges } from './badges';

test('does not grant badges without evidence or from malformed figures', () => {
  expect(conciergeBadges({})).toEqual([]);
  expect(conciergeBadges({ occupancyPct: 110, completeYear: true, properties: 3, guestRating: 6, guestReviews: 30 })).toEqual([]);
});
test('requires a comparable benchmark for outperforming, not just high occupation', () => {
  expect(conciergeBadges({ occupancyPct: 85, completeYear: true, properties: 3 })).toEqual(['occupancy']);
  expect(conciergeBadges({ occupancyPct: 85, completeYear: true, properties: 3, comparableMarketOccupancyPct: 70, comparableMarketSample: 20 })).toEqual(['fire', 'occupancy']);
});
test('requires enough reviews and complete annual occupancy', () => {
  expect(conciergeBadges({ guestRating: 4.9, guestReviews: 19, occupancyPct: 90, completeYear: false, properties: 3 })).toEqual([]);
  expect(conciergeBadges({ guestRating: 4.9, guestReviews: 20 })).toEqual(['favorite']);
});
test('returns all justified badges for detail, with the strongest result first for cards', () => {
  expect(conciergeBadges({ occupancyPct: 80, completeYear: true, properties: 4, premiumVerified: true, smallHomesShare: 0.8, directBookingVerified: true })).toEqual(['occupancy', 'premium', 'small-homes', 'direct-booking']);
  expect(conciergeBadges({ services: ['LISTINGS', 'PRICING', 'GUESTS', 'CLEANING', 'MAINTENANCE', 'OWNER_REPORTING'] })).toEqual(['full-service']);
});
