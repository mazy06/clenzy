import { baitlyDemoRequests, demoRequestsPage } from './baitlyDemoRequests';

test('demo requests cannot refer to real requests or interventions', () => {
  expect(baitlyDemoRequests.every(item => item.id < 0 && item.providerId < 0 && !item.interventionId)).toBe(true);
  expect(new Set(baitlyDemoRequests.map(item => item.id)).size).toBe(baitlyDemoRequests.length);
});
test('status filtering returns only matching demo proposals', () => {
  const page = demoRequestsPage('sent', 'QUOTED');
  expect(page.items).toHaveLength(1);
  expect(page.items[0].quotedCurrency).toBe('MAD');
  expect(page.items.every(item => item.status === 'QUOTED')).toBe(true);
  expect(page.totalElements).toBe(page.items.length);
});
