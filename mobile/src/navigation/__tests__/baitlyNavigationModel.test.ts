import { baitlyTabs, physicalTabIndex } from '../baitlyNavigationModel';

it('gives visitors four public destinations without an operational workspace', () => {
  expect(baitlyTabs('guest').map(tab => tab.name)).toEqual(['Marketplace', 'Properties', 'Reels', 'Profile']);
});

it('gives owners and concierges their day, bookings, homes and account', () => {
  expect(baitlyTabs('owner').map(tab => tab.name)).toEqual(['Today', 'Calendar', 'Properties', 'Profile']);
  expect(baitlyTabs('concierge').map(tab => tab.name)).toEqual(['Today', 'Calendar', 'Properties', 'Profile']);
});

it('limits providers to their activity', () => {
  expect(baitlyTabs('provider', true).map(tab => tab.name)).toEqual(['Today', 'Tracking', 'Messages', 'Profile']);
  expect(baitlyTabs('provider', false).map(tab => tab.name)).toEqual(['Today', 'Messages', 'Profile']);
});

it('shows provider requests only when quotes are supported', () => {
  expect(baitlyTabs('provider', true).find(tab => tab.name === 'Tracking')).toMatchObject({ label: 'requests', artwork: 'tracking' });
  expect(baitlyTabs('provider', false).find(tab => tab.name === 'Tracking')).toBeUndefined();
  expect(baitlyTabs('provider')[0]).toMatchObject({ name: 'Today', label: 'missions', artwork: 'missions' });
});

it.each([4, 5])('positions the selected tab correctly in both directions for %i destinations', count => {
  const indices = Array.from({ length: count }, (_, index) => index);
  expect(indices.map(index => physicalTabIndex(index, count, false))).toEqual(indices);
  expect(indices.map(index => physicalTabIndex(index, count, true))).toEqual([...indices].reverse());
});

it.each(['guest', 'owner', 'concierge', 'provider'] as const)('limits %s to four visible menus', mode => {
  for (const quotes of [true, false]) expect(baitlyTabs(mode, quotes).length).toBeLessThanOrEqual(4);
});
