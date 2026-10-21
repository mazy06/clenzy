import { expect,it } from 'vitest';
import { conciergeProfilePath } from './baitlyConciergeApi';
it('keeps campaign attribution through profile navigation without forwarding private or routing parameters',() => {
  const path=conciergeProfilePath('profile','ar','?utm_source=salon&utm_medium=qr&utm_campaign=Rabat&organizationId=20&email=alice%40example.com&token=secret');
  expect(path).toBe('/conciergeries/profile?lang=ar&utm_source=salon&utm_medium=qr&utm_campaign=Rabat');
});
