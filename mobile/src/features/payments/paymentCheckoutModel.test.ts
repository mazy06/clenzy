import { phaseAfterCheck, safeCheckoutUrl } from './paymentCheckoutModel';

it('whenProviderConfirmedPayment_thenCheckoutIsPaid', () => {
  expect(phaseAfterCheck('PAID', 1, 8)).toBe('paid');
});
it('whenProviderRejectedPayment_thenCheckoutFailed', () => {
  expect(phaseAfterCheck('FAILED', 1, 8)).toBe('failed');
  expect(phaseAfterCheck('CANCELLED', 1, 8)).toBe('failed');
});
it('whenStatusStaysPending_thenKeepCheckingThenOfferToResume', () => {
  expect(phaseAfterCheck('PROCESSING', 3, 8)).toBe('checking');
  expect(phaseAfterCheck('PROCESSING', 8, 8)).toBe('unfinished');
  expect(phaseAfterCheck(undefined, 8, 8)).toBe('unfinished');
});
it('whenCheckoutUrlIsNotHttps_thenItIsRefused', () => {
  expect(safeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test')).toBe('https://checkout.stripe.com/c/pay/cs_test');
  expect(safeCheckoutUrl('http://evil.example')).toBeNull();
  expect(safeCheckoutUrl('javascript:alert(1)')).toBeNull();
  expect(safeCheckoutUrl(null)).toBeNull();
});
