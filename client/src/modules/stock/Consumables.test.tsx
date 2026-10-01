// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders as render, screen, fireEvent, waitFor } from '../../test/renderWithProviders';
import { ConsumablesList, propertyStockPath } from './ConsumablesList';
import ConsumablesPage from './ConsumablesPage';
import { consumablesApi, type ConsumableRow, type ConsumablesView } from '../../services/api/consumablesApi';
import { screenTabsFor } from '../../config/screenTabs';
import { SidebarProvider } from '../../components/ui/sidebar';

const auth = vi.hoisted(() => ({ user: { id: 4, organizationId: 7, roles: ['HOST'], permissions: ['properties:view', 'reservations:view'] }, loading: false }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/api/consumablesApi', () => ({ consumablesApi: { list: vi.fn(), properties: vi.fn() } }));

const row: ConsumableRow = { id: 'stock-1', stockItemId: 1, propertyId: 12, propertyName: 'Villa Azur', name: 'Capsules de café', catalogKey: 'coffee-capsules', photoUrl: null, unit: 'boîtes', quantity: 4, threshold: 2, supplierName: 'Cafés Belleville', createdAt: '2026-09-20T10:00:00', orderedAt: '2026-09-24T10:00:00Z', lastRestockedAt: '2026-09-28T10:00:00Z', description: null, actionable: true };
const reset = vi.fn();
function Page() { return <SidebarProvider><div className="w-full"><ConsumablesPage /></div></SidebarProvider>; }

beforeEach(() => {
  vi.clearAllMocks();
  auth.user.organizationId = 7;
  vi.mocked(consumablesApi.properties).mockResolvedValue([{ id: 12, name: 'Villa Azur' }]);
  vi.mocked(consumablesApi.list).mockImplementation(async (view) => ({ rows: [{ ...row, name: view === 'ordered' ? 'Commande café' : row.name }], totalElements: 1, page: 0, size: 20, counts: { pending: 1, ordered: 1, stock: 1 } }));
});

describe('Suivi des consommables', () => {
  it('montre la photo, le logement, le stock actuel et la réception confirmée', () => {
    const { container } = render(<ConsumablesList rows={[row]} view="stock" filtered={false} onReset={reset} />);
    expect(container.querySelector('[data-catalog-key="coffee-capsules"]')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Villa Azur' })).toHaveAttribute('href', propertyStockPath(12));
    expect(screen.getByText(/Dernier réassort/)).toHaveTextContent('28 sept. 2026');
    expect(screen.queryByText('Commande envoyée')).not.toBeInTheDocument();
  });
  it('ne transforme pas une ancienne commande en réception et n’invente pas sa quantité', () => {
    render(<ConsumablesList rows={[{ ...row, quantity: null, supplierName: null, description: 'Proposition initiale' }]} view="ordered" filtered={false} onReset={reset} />);
    expect(screen.getAllByText('Non archivée')).toHaveLength(2);
    expect(screen.getByText('Commande envoyée')).toBeInTheDocument();
    expect(screen.queryByText(/Dernier réassort/)).not.toBeInTheDocument();
    expect(screen.getByText('Détails de la proposition d’origine').closest('details')).not.toHaveAttribute('open');
  });
  it('ouvre le bon agent et le bon logement uniquement si le planning est accessible', () => {
    const { rerender } = render(<ConsumablesList rows={[row]} view="pending" filtered={false} onReset={reset} canOpenPlanning />);
    expect(screen.getByRole('link', { name: 'Voir la proposition' })).toHaveAttribute('href', '/planning?property=12&agent=ops');
    rerender(<ConsumablesList rows={[row]} view="pending" filtered={false} onReset={reset} />);
    expect(screen.queryByRole('link', { name: 'Voir la proposition' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir le stock' })).toHaveAttribute('href', propertyStockPath(12));
  });
  it('propose de réinitialiser une recherche vide', () => {
    render(<ConsumablesList rows={[]} view="stock" filtered onReset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(reset).toHaveBeenCalledOnce();
  });
  it('charge une page pour le bon onglet puis renouvelle le cache lors du changement d’organisation', async () => {
    const { rerender } = render(<Page />);
    expect(await screen.findByText('Capsules de café')).toBeInTheDocument();
    expect(consumablesApi.list).toHaveBeenCalledWith('pending', 'all', '', 0);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Commandés/ }), { button: 0, ctrlKey: false });
    expect(await screen.findByText('Commande café')).toBeInTheDocument();
    expect(consumablesApi.list).toHaveBeenCalledWith('ordered', 'all', '', 0);
    auth.user.organizationId = 8;
    rerender(<Page />);
    await waitFor(() => expect(consumablesApi.properties).toHaveBeenCalledTimes(2));
    expect(consumablesApi.list).toHaveBeenCalledTimes(3);
  });
  it('conserve les trois destinations dans le registre partagé par le menu', () => {
    expect(screenTabsFor('/consumables').map(tab => tab.key)).toEqual(['pending', 'ordered', 'stock'] satisfies ConsumablesView[]);
  });
  it('affiche l’erreur avec une reprise possible sans inventer un état vide', async () => {
    vi.mocked(consumablesApi.list).mockRejectedValue(new Error('offline'));
    render(<Page />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Le suivi des consommables');
    expect(screen.queryByText('Aucune commande en attente')).not.toBeInTheDocument();
    vi.mocked(consumablesApi.list).mockResolvedValue({ rows: [], totalElements: 0, page: 0, size: 20, counts: { pending: 0, ordered: 0, stock: 0 } });
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Aucune commande en attente')).toBeInTheDocument();
  });
});
