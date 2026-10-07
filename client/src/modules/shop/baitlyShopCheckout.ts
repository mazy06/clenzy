import apiClient from '../../services/apiClient';
export async function baitlyShopCheckout(items: { sku: string; quantity: number }[], requestId: string): Promise<string> {
  const result = await apiClient.post<{ url: string }>('/shop/checkout', { items, requestId });
  const url = new URL(result.url);
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) throw new Error('Adresse de paiement non reconnue');
  return url.href;
}
