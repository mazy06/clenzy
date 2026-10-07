import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GeneratePayoutForm from './GeneratePayoutForm';
import { propertiesApi, type Property } from '../../../services/api/propertiesApi';
import { accountingApi, type OwnerPayout } from '../../../services/api/accountingApi';

vi.mock('../../../services/api/propertiesApi', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('../../../services/api/accountingApi', () => ({ accountingApi: { generatePayout: vi.fn() } }));
const clients: QueryClient[] = [];
const onGenerated = vi.fn();
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><GeneratePayoutForm onClose={vi.fn()} onGenerated={onGenerated} /></QueryClientProvider>);
}
async function fill(from = '2026-10-02', to = '2026-10-03') {
  await screen.findByRole('option', { name: 'Nadia Martin' });
  fireEvent.change(screen.getByLabelText('Propriétaire'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Début de période'), { target: { value: from } });
  fireEvent.change(screen.getByLabelText('Fin de période'), { target: { value: to } });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(propertiesApi.getAll).mockResolvedValue([
    { id: 1, ownerId: 10, ownerName: 'Nadia Martin' },
    { id: 2, ownerId: 10, ownerName: 'Nadia Martin' },
  ] as Property[]);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe('Préparation du premier reversement', () => {
  it('utilise les propriétaires de logements, sans exiger un ancien reversement, puis présente le calcul serveur', async () => {
    const payout = { id: 22, netAmount: 80, currency: 'EUR', status: 'PENDING' } as OwnerPayout;
    vi.mocked(accountingApi.generatePayout).mockResolvedValue(payout);
    mount();
    await fill();
    expect(screen.getAllByRole('option', { name: 'Nadia Martin' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Calculer le montant' }));
    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith(payout));
    expect(accountingApi.generatePayout).toHaveBeenCalledExactlyOnceWith(10, '2026-10-02', '2026-10-03');
  });

  it('refuse une période inversée sans requête financière', async () => {
    mount();
    await fill('2026-10-03', '2026-10-02');
    expect(screen.getByRole('button', { name: 'Calculer le montant' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('La fin de période');
    expect(accountingApi.generatePayout).not.toHaveBeenCalled();
  });

  it('conserve la saisie et affiche le refus serveur en absence de fonds', async () => {
    vi.mocked(accountingApi.generatePayout).mockRejectedValue(new Error('Aucun séjour encaissé éligible.'));
    mount();
    await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Calculer le montant' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Aucun séjour encaissé éligible.');
    expect(screen.getByLabelText('Fin de période')).toHaveValue('2026-10-03');
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it('bloque une deuxième soumission pendant le calcul', async () => {
    vi.mocked(accountingApi.generatePayout).mockReturnValue(new Promise(() => {}));
    mount();
    await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Calculer le montant' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Calculer le montant' })).toBeDisabled());
    expect(screen.getByLabelText('Propriétaire')).toBeDisabled();
    expect(accountingApi.generatePayout).toHaveBeenCalledTimes(1);
  });
});
