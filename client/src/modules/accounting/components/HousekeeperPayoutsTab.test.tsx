import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HousekeeperPayoutsTab from './HousekeeperPayoutsTab';
import { housekeeperPayoutsApi, type HousekeeperPayoutRecord } from '../../../services/api/housekeeperPayoutsApi';

vi.mock('../../../services/api/housekeeperPayoutsApi', () => ({ housekeeperPayoutsApi: { listOrg: vi.fn(), previewRetry: vi.fn(), retry: vi.fn() } }));
vi.mock('../../../services/api/usersApi', () => ({ usersApi: { getAll: vi.fn().mockResolvedValue([{ id: 3, firstName: 'Jean', lastName: 'Martin' }]) } }));
vi.mock('../../../components/PageHeaderActionsContext', () => ({ usePageHeaderActions: () => null }));
vi.mock('../../billing/components/FinanceKpis', () => ({ FinanceAmountKpis: ({ records }: { records: {amount: number}[] }) => <output aria-label="Montant KPI">{records.reduce((sum, row) => sum + row.amount, 0)}</output> }));
vi.mock('../../billing/components/FinanceWorkspace', () => ({ default: ({ items }: { items: { id: number; actions: React.ReactNode; fields: {value: React.ReactNode}[] }[] }) => <>{items.map(i => <div key={i.id}>{i.actions}{i.fields?.map((f, index) => <div key={index}>{f.value}</div>)}</div>)}</> }));
vi.mock('../../payments/FinanceBatchPanel', () => ({ FinanceBatchPanel: ({ items, onExecute }: { items: { key: string; amount: number }[]; onExecute: (items: { key: string; amount: number }[]) => Promise<unknown> }) => <button onClick={() => void onExecute(items)} disabled={!items.length}>Lot de test</button> }));
const clients: QueryClient[] = [];
const record = { id: 7, userId: 3, interventionId: 352, amount: 0, commissionAmount: 0, status: 'BLOCKED', failureReason: 'PAYMENT_REQUIRED', stripeTransferId: null, createdAt: '2026-10-06T10:00:00' } as HousekeeperPayoutRecord;
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<MemoryRouter><QueryClientProvider client={client}><HousekeeperPayoutsTab /></QueryClientProvider></MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(housekeeperPayoutsApi.listOrg).mockResolvedValue([record]);
  vi.mocked(housekeeperPayoutsApi.previewRetry).mockResolvedValue({ amount: 70, commissionAmount: 0 });
  vi.mocked(housekeeperPayoutsApi.retry).mockResolvedValue({ ...record, amount: 70, status: 'SENT' });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });

it('confirme et transmet le montant recalculé de 70 €, jamais les anciens 0 €', async () => {
  mount();
  const button = await screen.findByRole('button', { name: 'Relancer le versement' });
  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.getByLabelText('Montant KPI')).toHaveTextContent('70');
  fireEvent.click(button);
  expect(screen.getByRole('dialog')).toHaveTextContent(/70,00\s*€/);
  expect(housekeeperPayoutsApi.retry).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Relancer', exact: true }));
  await waitFor(() => expect(housekeeperPayoutsApi.retry).toHaveBeenCalledExactlyOnceWith(7, { amount: 70, commissionAmount: 0 }));
});

it('ne peut pas lancer pendant le calcul du montant', async () => {
  vi.mocked(housekeeperPayoutsApi.previewRetry).mockReturnValue(new Promise(() => {}));
  mount();
  expect(await screen.findByRole('button', { name: 'Relancer le versement' })).toBeDisabled();
  expect(housekeeperPayoutsApi.retry).not.toHaveBeenCalled();
});

it('bloque la relance si la préparation serveur refuse les conditions', async () => {
  vi.mocked(housekeeperPayoutsApi.previewRetry).mockRejectedValue(new Error('Encaissement manquant'));
  mount();
  await waitFor(() => expect(housekeeperPayoutsApi.previewRetry).toHaveBeenCalled());
  expect(await screen.findByRole('button', { name: 'Relancer le versement' })).toBeDisabled();
  expect(housekeeperPayoutsApi.retry).not.toHaveBeenCalled();
});

it('affiche le refus métier renvoyé par apiClient sans le remplacer par une erreur générique', async () => {
  vi.mocked(housekeeperPayoutsApi.previewRetry).mockRejectedValue({ status: 409, message: 'Encaissement non confirmé' });
  mount();
  expect(await screen.findByText('Encaissement non confirmé')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Relancer le versement' })).toBeDisabled();
  expect(housekeeperPayoutsApi.retry).not.toHaveBeenCalled();
});

it('inclut le dossier initialement à zéro dans le lot avec son aperçu à 70 €', async () => {
  mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lot de test' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Lot de test' }));
  await waitFor(() => expect(housekeeperPayoutsApi.retry).toHaveBeenCalledExactlyOnceWith(7, { amount: 70, commissionAmount: 0 }));
});

it('ne lance pas un dossier de lot dont le montant a changé depuis la sélection', async () => {
  mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lot de test' })).toBeEnabled());
  vi.mocked(housekeeperPayoutsApi.previewRetry).mockResolvedValue({ amount: 65, commissionAmount: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Lot de test' }));
  await waitFor(() => expect(housekeeperPayoutsApi.previewRetry).toHaveBeenCalledTimes(2));
  expect(housekeeperPayoutsApi.retry).not.toHaveBeenCalled();
});
