import { consumeRequestIntent, rememberRequestProvider } from '../baitlyGuestIntent';
afterEach(() => { consumeRequestIntent(); });
it('keeps the management enquiry through login and consumes it once', () => {
  rememberRequestProvider(12, 'management');
  expect(consumeRequestIntent()).toEqual({ providerId: 12, purpose: 'management' });
  expect(consumeRequestIntent()).toBeUndefined();
});
it('replaces an earlier enquiry when the visitor chooses another service', () => {
  rememberRequestProvider(12, 'management'); rememberRequestProvider(14);
  expect(consumeRequestIntent()).toEqual({ providerId: 14, purpose: undefined });
});
