import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import { baitlyShopCheckout } from './baitlyShopCheckout';
const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
const http = financeHttp();beforeAll(async () => { context.origin = await http.start(); });afterAll(() => http.close());afterEach(() => expect(http.unexpected).toEqual([]));
it('envoie le SKU, la quantité et la demande au bon endpoint puis retourne le Checkout vérifié', async () => {
  let body: unknown;http.route((req, res) => { expect(req.path).toBe('/api/shop/checkout');body = JSON.parse(req.body);return json(res, { url: 'https://checkout.stripe.com/c/pay/cs_test' }); });
  expect(await baitlyShopCheckout([{ sku: 'KIT-ESSENTIAL', quantity: 1 }], 'uuid-test')).toBe('https://checkout.stripe.com/c/pay/cs_test');
  expect(body).toEqual({ items: [{ sku: 'KIT-ESSENTIAL', quantity: 1 }], requestId: 'uuid-test' });
});
it('ne transforme pas une rupture de stock en succès', async () => {
  http.route((req, res) => json(res, { message: 'Stock insuffisant' }, 409));
  await expect(baitlyShopCheckout([{ sku: 'KIT-ESSENTIAL', quantity: 1 }], 'uuid-test')).rejects.toThrow();
});
it('refuse une adresse de paiement qui imite le domaine Stripe', async () => {
  http.route((req, res) => json(res, { url: 'https://checkout.stripe.com.attacker.invalid/pay' }));
  await expect(baitlyShopCheckout([{ sku: 'KIT-ESSENTIAL', quantity: 1 }], 'uuid-test')).rejects.toThrow('non reconnue');
});
