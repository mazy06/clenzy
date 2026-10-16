import { baitlyDemoClients, demoManagementDirectory, demoPublicClient, guestReviewSummary, publicPortfolioPerformance } from '../baitlyDemoClients';
import { baitlyDemoProviders } from '../baitlyDemoCatalog';
jest.mock('../baitlyDemoCatalog', () => ({
  ...jest.requireActual('../baitlyDemoCatalog'), isBaitlyDemoCatalogEnabled: jest.fn(() => true),
}));
import { isBaitlyDemoCatalogEnabled } from '../baitlyDemoCatalog';

describe('Baitly public demo profiles', () => {
  it('resolves every review to the correct fictional author', () => {
    for (const review of baitlyDemoProviders.flatMap(provider => provider.demoReviews ?? [])) {
      const client = demoPublicClient(review.clientProfileId!);
      expect(client?.name).toBe(review.clientName);
      expect(client?.portraitIndex).toBe(review.portraitIndex);
    }
    expect(baitlyDemoClients).toHaveLength(6);
    expect(baitlyDemoClients.flatMap(client => client.properties)).toHaveLength(12);
    expect(baitlyDemoClients.flatMap(client => client.properties.flatMap(property => property.guestReviews))
      .every(review => Number.isInteger(review.portraitIndex) && review.portraitIndex >= 0 && review.portraitIndex < 6)).toBe(true);
    expect(baitlyDemoClients.every(client => client.bookingDomain.endsWith('.example'))).toBe(true);
  });
  it('does not expose a demo profile when the catalog is disabled', () => {
    (isBaitlyDemoCatalogEnabled as jest.Mock).mockReturnValueOnce(false);
    expect(demoPublicClient(baitlyDemoClients[0].id)).toBeUndefined();
    expect(demoPublicClient('real-user-id')).toBeUndefined();
  });
  it('weights occupancy by calendar nights and ignores invalid periods', () => {
    const property = baitlyDemoClients[0].properties[0];
    const properties = [{ ...property, performance: [{ year: 2025, calendarNights: 100, bookedNights: 80 }] },
      { ...property, performance: [{ year: 2025, calendarNights: 300, bookedNights: 120 },
        { year: 2025, calendarNights: 0, bookedNights: 50 }] }];
    expect(publicPortfolioPerformance(properties, 2025)?.occupancyPct).toBe(50);
    expect(publicPortfolioPerformance(properties, 2023)).toBeNull();
    expect(guestReviewSummary([])).toEqual({ count: 0, average: null });
  });
  it('lists published concierges and only owners explicitly seeking management', () => {
    expect(demoManagementDirectory('CONCIERGE')).toHaveLength(2);
    expect(demoManagementDirectory('OWNER')).toHaveLength(3);
    expect(demoManagementDirectory('OWNER').every(client => client.networkPublished && client.seekingManagement)).toBe(true);
    expect(demoManagementDirectory('OWNER').some(client => client.name === 'Philippe Laurent')).toBe(false);
    expect(demoManagementDirectory('CONCIERGE', 'safran')).toHaveLength(1);
    expect(demoManagementDirectory('OWNER', 'Paris')).toHaveLength(0);
    (isBaitlyDemoCatalogEnabled as jest.Mock).mockReturnValueOnce(false);
    expect(demoManagementDirectory('OWNER')).toEqual([]);
  });
});
