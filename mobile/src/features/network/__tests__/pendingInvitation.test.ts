import { captureInvitation, consumeInvitation } from '../pendingInvitation';
beforeEach(() => { consumeInvitation(); });
it('keeps an invitation through login and consumes it once', () => {
  const token = 'a'.repeat(72);
  expect(captureInvitation(`clenzy://network-invitation?token=${token}`)).toBe(true);
  expect(consumeInvitation()).toBe(token); expect(consumeInvitation()).toBeNull();
});
it('rejects foreign origins and malformed secrets', () => {
  expect(captureInvitation(`https://attacker.test/network-invitation?token=${'a'.repeat(72)}`)).toBe(false);
  expect(captureInvitation('clenzy://network-invitation?token=short')).toBe(false);
  expect(consumeInvitation()).toBeNull();
});
