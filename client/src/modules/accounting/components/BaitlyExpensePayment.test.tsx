import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BaitlyExpensePayment from './BaitlyExpensePayment';
import { providerExpensesApi, type ProviderExpense } from '../../../services/api/providerExpensesApi';

const auth = vi.hoisted(() => ({ staff: true }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 1, organizationId: 7 }, hasRole: () => auth.staff }) }));
vi.mock('../../../services/api/providerExpensesApi', () => ({ providerExpensesApi: { previewTransfer: vi.fn(), transfer: vi.fn(), selectCompany: vi.fn() } }));
const beneficiary = { userId: 42, organizationId: null, name: "Jean Martin", companyId: null, companyName: null, locked: false };
const expense = { id: 31, providerName: 'Jean Martin', amountTtc: 10, currency: 'EUR', status: 'INCLUDED' } as ProviderExpense;
function mount(row = expense) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><BaitlyExpensePayment expense={row} /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.resetAllMocks(); auth.staff = true;
  vi.mocked(providerExpensesApi.previewTransfer).mockResolvedValue({ eligible: true, reason: null, beneficiary });
});
afterEach(cleanup);

it('prépare puis confirme explicitement le montant et le bénéficiaire, sans double clic', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(providerExpensesApi.transfer).mockReturnValue(new Promise(done => { resolve = done; }) as ReturnType<typeof providerExpensesApi.transfer>);
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Préparer le versement de la dépense' }));
  expect(screen.getByText(/compte personnel de Jean Martin/)).toHaveTextContent('10,00');
  expect(providerExpensesApi.transfer).not.toHaveBeenCalled();
  const button = screen.getByRole('button', { name: /Verser 10/ });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(providerExpensesApi.transfer).toHaveBeenCalledExactlyOnceWith(31, { userId: 42, organizationId: null }));
  resolve({ state: 'TRANSFERRED', externalReference: 'tr_expense' });
  expect(await screen.findByRole('status')).toHaveTextContent('tr_expense');
  expect(screen.getByRole('status')).toHaveTextContent('réception bancaire se consulte');
});
it('explique une retenue non financée sans proposer de paiement', async () => {
  vi.mocked(providerExpensesApi.previewTransfer).mockResolvedValue({ beneficiary, eligible: false, reason: 'Reversement propriétaire non confirmé.' });
  mount(); expect(await screen.findByText('Reversement propriétaire non confirmé.')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Préparer/ })).not.toBeInTheDocument();
});
it('une dépense approuvée ne vaut ni transfert ni paiement', () => {
  mount({ ...expense, status: 'APPROVED' });
  expect(screen.getByText(/sera déduite/)).toBeVisible();
  expect(providerExpensesApi.previewTransfer).not.toHaveBeenCalled();
});
it('un résultat incertain est affiché et relu sans réémission automatique', async () => {
  vi.mocked(providerExpensesApi.transfer).mockRejectedValue(new Error('Transfert à rapprocher.'));
  mount(); fireEvent.click(await screen.findByRole('button', { name: /Préparer/ }));
  vi.mocked(providerExpensesApi.previewTransfer).mockResolvedValue({ beneficiary, eligible: false, reason: 'Transfert à rapprocher.' });
  fireEvent.click(screen.getByRole('button', { name: /Verser 10/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Transfert à rapprocher.');
  await waitFor(() => expect(screen.getByRole('button', { name: /Verser 10/ })).toBeDisabled());
  expect(providerExpensesApi.transfer).toHaveBeenCalledOnce();
});
it('un compte prestataire ne peut pas lancer un versement depuis ce composant', () => {
  auth.staff = false; mount();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(providerExpensesApi.previewTransfer).not.toHaveBeenCalled();
});
it('un paiement confirmé ne propose aucune nouvelle émission', () => {
  mount({ ...expense, status: 'PAID', paymentReference: 'tr_original' });
  expect(screen.getByRole('status')).toHaveTextContent('tr_original');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
