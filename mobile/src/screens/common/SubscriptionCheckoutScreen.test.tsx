import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { SubscriptionCheckoutScreen } from './SubscriptionCheckoutScreen';
import { baitlySubscriptionApi as api } from '@/api/endpoints/baitlySubscriptionApi';
import * as WebBrowser from 'expo-web-browser';
const renderer = require('react-test-renderer');
const { act } = renderer;

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }), useRoute: () => ({ params: { forfait: 'essentiel' } }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '7cb32af0-8991-45f0-98d5-cf5341ea12dd' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/store/authStore', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { id: '2', organizationId: 3 }, loadUser: jest.fn().mockResolvedValue(undefined) }) }));
jest.mock('@/theme', () => ({ useTheme: () => ({
  colors: require('@/theme/colors').colors, typography: require('@/theme/typography').typography,
  SPACING: require('@/theme/spacing').SPACING, BORDER_RADIUS: require('@/theme/spacing').BORDER_RADIUS,
  TOUCH_TARGET: require('@/theme/spacing').TOUCH_TARGET,
  shadows: require('@/theme/shadows').shadows,
}) }));
jest.mock('@/api/endpoints/baitlySubscriptionApi', () => ({
  ...jest.requireActual('@/api/endpoints/baitlySubscriptionApi'),
  baitlySubscriptionApi: { billingCountry: jest.fn(), updateBillingCountry: jest.fn(), proposal: jest.fn(), contracts: jest.fn(), checkout: jest.fn(), refresh: jest.fn(), abandon: jest.fn(), changes: jest.fn(), changeProposal: jest.fn(), scheduleChange: jest.fn(), paymentMethod: jest.fn() },
}));
const quote = { phases: [1,4,7,13].map((month,i) => ({ version:'test',plan:'essential' as const,market:'EU',currency:'EUR',properties:1,subscriptionMonth:month,loyaltyPercent:i*10,baseCents:2900,volumeCents:2900,totalCents:2900-i*290 })),subscriptionMonth:1,firstInvoiceExcludingTaxCents:2900,promoCode:null,propertyCount:1,previousPlan:null };
let tree: any;
let cache: QueryClient;
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); }); }
async function until(assertion: () => void) {
  const deadline = Date.now() + 1500;
  for (;;) {
    await settle();
    try { assertion(); return; } catch (failure) { if (Date.now() >= deadline) throw failure; }
  }
}
async function open() {
  cache=new QueryClient({ defaultOptions: { queries: { retry:false,gcTime:Infinity } } });
  await act(async () => { tree=renderer.create(<QueryClientProvider client={cache}><SubscriptionCheckoutScreen /></QueryClientProvider>); });
  await settle();
}
function button(title: string) { return tree.root.findAllByType(Button).find((node: any) => node.props.title === `monthlySubscription.${title}`); }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
  jest.mocked(api.billingCountry).mockResolvedValue({ billingCountry: 'FR', sellerCountry: 'FR' });
  jest.mocked(api.proposal).mockResolvedValue(quote);jest.mocked(api.contracts).mockResolvedValue([]);
  jest.mocked(api.changes).mockResolvedValue([]);
});
afterEach(async () => { if(tree)await act(async () => tree.unmount());tree=null;cache?.clear();jest.clearAllMocks(); });

it('keeps one attempt after an uncertain response and ignores double taps', async () => {
  let reject!: (reason: Error) => void;
  jest.mocked(api.checkout).mockReturnValueOnce(new Promise((_, fail) => { reject=fail; }));
  await open();await until(() => expect(button('continue').props.disabled).toBe(false));const pay=button('continue');
  await act(async () => { pay.props.onPress();pay.props.onPress(); });
  expect(api.checkout).toHaveBeenCalledTimes(1);const id=jest.mocked(api.checkout).mock.calls[0][1];
  await act(async () => reject(new Error('network')));
  jest.mocked(api.checkout).mockRejectedValueOnce(new Error('network'));
  await act(async () => button('continue').props.onPress());
  expect(jest.mocked(api.checkout).mock.calls[1][1]).toBe(id);
});
it('resumes the persisted contract instead of creating a second payment', async () => {
  jest.mocked(api.contracts).mockResolvedValue([{ id:7,requestId:'saved-attempt',plan:'pro',status:'CHECKOUT_OPEN',currency:'EUR',properties:1,firstInvoiceExcludingTaxCents:4900,monthOneCents:4900,monthFourCents:4410,monthSevenCents:3920,monthThirteenCents:3430,promoCode:null,paidUntil:null,cancelAtPeriodEnd:false }]);
  jest.mocked(api.checkout).mockRejectedValueOnce(new Error('network'));
  await open();expect(button('continue')).toBeUndefined();await act(async () => button('resume').props.onPress());
  expect(api.checkout).toHaveBeenCalledWith('pro','saved-attempt',null);
});
it('rejects an unexpected checkout destination before opening the browser', async () => {
  jest.mocked(api.checkout).mockResolvedValueOnce({checkoutUrl:'https://stripe.com.attacker.invalid/',sessionId:'cs_test'});
  await open();await act(async () => button('continue').props.onPress());await settle();
  expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();expect(api.refresh).not.toHaveBeenCalled();
});
it('requires saving a changed billing country before creating a checkout', async () => {
  await open();
  await act(async () => tree.root.findByType(Select).props.onChange('MA'));
  expect(button('continue').props.disabled).toBe(true);
  await act(async () => button('continue').props.onPress());
  expect(api.checkout).not.toHaveBeenCalled();
  jest.mocked(api.updateBillingCountry).mockResolvedValueOnce({ billingCountry: 'MA', sellerCountry: 'MA' });
  jest.mocked(api.billingCountry).mockResolvedValue({ billingCountry: 'MA', sellerCountry: 'MA' });
  await act(async () => button('saveCountry').props.onPress());await settle();
  expect(api.updateBillingCountry).toHaveBeenCalledWith('MA');
  expect(button('continue').props.disabled).toBe(false);
});
it('does not request a proposal without a saved billing country and keeps failed saves unpaid', async () => {
  jest.mocked(api.billingCountry).mockResolvedValue({ billingCountry: null, sellerCountry: null });
  await open();expect(api.proposal).not.toHaveBeenCalled();expect(button('continue').props.disabled).toBe(true);
  await act(async () => tree.root.findByType(Select).props.onChange('FR'));
  jest.mocked(api.updateBillingCountry).mockRejectedValueOnce(new Error('network'));
  await act(async () => button('saveCountry').props.onPress());
  expect(button('continue').props.disabled).toBe(true);expect(api.checkout).not.toHaveBeenCalled();
});
it('locks the billing country while an existing contract is pending', async () => {
  jest.mocked(api.contracts).mockResolvedValue([{ id:7,requestId:'saved-attempt',plan:'pro',status:'CHECKOUT_OPEN',currency:'EUR',properties:1,firstInvoiceExcludingTaxCents:4900,monthOneCents:4900,monthFourCents:4410,monthSevenCents:3920,monthThirteenCents:3430,promoCode:null,paidUntil:null,cancelAtPeriodEnd:false }]);
  await open();expect(tree.root.findAllByType(Select)).toHaveLength(0);expect(button('saveCountry')).toBeUndefined();
});

it('changes the existing contract after preview without starting a second checkout', async () => {
  jest.mocked(api.contracts).mockResolvedValue([{ id:7,requestId:'saved',plan:'essential',status:'ACTIVE',currency:'EUR',properties:1,firstInvoiceExcludingTaxCents:2900,monthOneCents:2900,monthFourCents:2610,monthSevenCents:2320,monthThirteenCents:2030,promoCode:null,paidUntil:'2027-01-01',cancelAtPeriodEnd:false }]);
  const terms = { plan: 'pro' as const, properties: 1, currency: 'EUR', subscriptionMonth: 1, effectiveAt: 1800000000, monthOne: 4900, monthFour: 4410, monthSeven: 3920, monthThirteen: 3430, version: 'test' };
  jest.mocked(api.changeProposal).mockResolvedValue({ terms, chargeNowCents: 0, reason: 'NEXT_RENEWAL_NO_PRORATION' });
  jest.mocked(api.scheduleChange).mockRejectedValue(new Error('network'));
  await open();expect(button('continue')).toBeUndefined();
  await act(async () => tree.root.findByType(Select).props.onChange('pro'));
  await act(async () => button('change.preview').props.onPress());
  await act(async () => button('change.confirm').props.onPress());
  await act(async () => button('change.confirm').props.onPress());
  expect(api.scheduleChange).toHaveBeenCalledTimes(2);
  expect(jest.mocked(api.scheduleChange).mock.calls[0]).toEqual(jest.mocked(api.scheduleChange).mock.calls[1]);
  expect(api.checkout).not.toHaveBeenCalled();
});
