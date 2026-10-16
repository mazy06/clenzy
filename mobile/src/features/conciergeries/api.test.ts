import { rankConciergeries, type ConciergePerformance } from './api';

const entry = (id: number, occupancyPct: number | null, ratingAvg: number | null, city = 'Paris') => ({
  provider: { id, displayName: `Société ${id}`, baseCity: city, coverageCities: [city] }, occupancyPct, ratingAvg,
} as ConciergePerformance);

it('puts unpublished metrics behind observed values and sorts each criterion independently', () => {
  const items = [entry(1, null, 4.9), entry(2, 80, 4.2), entry(3, 60, null)];
  expect(rankConciergeries(items, '', 'occupancy').map(item => item.provider.id)).toEqual([2, 3, 1]);
  expect(rankConciergeries(items, '', 'rating').map(item => item.provider.id)).toEqual([1, 2, 3]);
  expect(items.map(item => item.provider.id)).toEqual([1, 2, 3]);
});
it('filters company names and covered cities', () => {
  const items = [entry(1, 70, 4.3), entry(2, 80, 4.8, 'Lyon')];
  expect(rankConciergeries(items, ' LYON ', 'occupancy').map(item => item.provider.id)).toEqual([2]);
});
