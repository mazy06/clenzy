import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeHttp, json } from '../../../tests/fixtures/baitlyFinanceHttp';
import VoucherEditorDialog from './VoucherEditorDialog';

const context = vi.hoisted(() => ({ origin: '' }));
vi.mock('../../config/api', () => ({ API_CONFIG: { get BASE_URL() { return context.origin; }, BASE_PATH: '/api' } }));
vi.mock('../../keycloak', () => ({ default: { authenticated: false }, getAccessToken: () => undefined }));
vi.mock('../../hooks/usePropertiesList', () => ({ usePropertiesList: () => ({ properties: [] }) }));
const http = financeHttp();
beforeAll(async () => { context.origin = await http.start(); });
afterAll(() => http.close());
afterEach(() => { cleanup(); expect(http.unexpected).toEqual([]); });
const mount = () => {
  const saved = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <VoucherEditorDialog voucher={null} open onClose={() => {}} onSaved={saved} />
  </QueryClientProvider>);
  const change = (id: string, value: string) => fireEvent.change(document.getElementById(id)!, { target: { value } });
  change('voucher-name', 'Séjour test'); change('voucher-code', 'SAVE');
  return { saved, change };
};

it('exige une devise pour la remise fixe puis transmet sa valeur sans conversion', async () => {
  let body: Record<string, unknown> | undefined;
  http.route((req, res) => { body = JSON.parse(req.body); return json(res, { ...body, id: 12 }); });
  const { saved, change } = mount();
  change('voucher-discount-type', 'FIXED_AMOUNT');change('voucher-discount-value', '50');
  fireEvent.click(screen.getByRole('button', { name: 'Créer' }));
  expect(await screen.findByText(/devise.*remise|devise.*montant/i)).toBeVisible();expect(body).toBeUndefined();
  change('voucher-currency', 'MAD');fireEvent.click(screen.getByRole('button', { name: 'Créer' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(body).toMatchObject({ currency: 'MAD', discountValue: 50, discountType: 'FIXED_AMOUNT' });
});

it('autorise les nuits offertes entières et affiche un refus serveur sans fermer le formulaire', async () => {
  let count = 0;
  http.route((req, res) => { count++;return json(res, { message: 'Quota promotionnel épuisé' }, 409); });
  const { saved, change } = mount();change('voucher-discount-type', 'FREE_NIGHTS');change('voucher-discount-value', '1.5');
  fireEvent.click(screen.getByRole('button', { name: 'Créer' }));expect(count).toBe(0);
  change('voucher-discount-value', '2');fireEvent.click(screen.getByRole('button', { name: 'Créer' }));
  expect(await screen.findByText('Quota promotionnel épuisé')).toBeVisible();expect(saved).not.toHaveBeenCalled();
  expect(document.getElementById('voucher-discount-value')).toHaveValue(2);
});
