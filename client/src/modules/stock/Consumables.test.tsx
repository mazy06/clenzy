// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders as render, screen, fireEvent, waitFor, within } from '../../test/renderWithProviders';
import { ConsumablesList, propertyStockPath } from './ConsumablesList';
import ConsumablesPage from './ConsumablesPage';
import { consumablesApi, type ConsumableRow } from '../../services/api/consumablesApi';
import { screenTabsFor } from '../../config/screenTabs';
import { SidebarProvider } from '../../components/ui/sidebar';
import { BaitlyConsumableInventory } from './BaitlyConsumableInventory';
import { propertyStockApi } from '../../services/api/propertyStockApi';

const auth = vi.hoisted(() => ({ user: { id: 4, organizationId: 7, roles: ['HOST'], permissions: ['properties:view', 'reservations:view'] }, loading: false }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/api/consumablesApi', () => ({ consumablesApi: { list: vi.fn(), properties: vi.fn() } }));
vi.mock('../../services/api/propertyStockApi', () => ({ propertyStockApi: { restock: vi.fn() } }));

const row: ConsumableRow = { id: 'stock-1', stockItemId: 1, propertyId: 12, propertyName: 'Villa Azur', name: 'Capsules de café', catalogKey: 'coffee-capsules', photoUrl: null, unit: 'boîtes', quantity: 4, threshold: 2, supplierName: 'Cafés Belleville', createdAt: '2026-09-20T10:00:00', orderedAt: '2026-09-24T10:00:00Z', lastRestockedAt: '2026-09-28T10:00:00Z', description: null, actionable: true };
const reset = vi.fn();
function Page() { return <SidebarProvider><div className="w-full"><ConsumablesPage /></div></SidebarProvider>; }

beforeEach(() => {
  vi.clearAllMocks();
  auth.user.organizationId = 7;
  vi.mocked(consumablesApi.properties).mockResolvedValue([{ id: 12, name: 'Villa Azur' }]);
  vi.mocked(consumablesApi.list).mockImplementation(async (view, _property, _search, page, size = 20) => ({ rows: [{ ...row, name: view === 'ordered' ? 'Commande café' : row.name }], totalElements: 1, page, size, counts: { pending: 1, ordered: 1, stock: 1 } }));
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
  it('charge les trois suivis ensemble puis isole le cache lors du changement d’organisation', async () => {
    const { rerender } = render(<Page />);
    expect(await screen.findByText('Commande café')).toBeInTheDocument();
    expect(consumablesApi.list).toHaveBeenCalledWith('pending', 'all', '', 0, 4);
    expect(consumablesApi.list).toHaveBeenCalledWith('ordered', 'all', '', 0, 4);
    expect(consumablesApi.list).toHaveBeenCalledWith('stock', 'all', '', 0, 12);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(3);
    auth.user.organizationId = 8;
    rerender(<Page />);
    await waitFor(() => expect(consumablesApi.properties).toHaveBeenCalledTimes(2));
    expect(consumablesApi.list).toHaveBeenCalledTimes(6);
  });
  it('présente une destination unique dans le registre du menu', () => {
    expect(screenTabsFor('/consumables')).toEqual([]);
  });
  it('affiche l’erreur avec une reprise possible sans inventer un état vide', async () => {
    vi.mocked(consumablesApi.list).mockRejectedValue(new Error('offline'));
    render(<Page />);
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('Le suivi des consommables');
    expect(screen.queryByText('Aucune commande en attente')).not.toBeInTheDocument();
    vi.mocked(consumablesApi.list).mockResolvedValue({ rows: [], totalElements: 0, page: 0, size: 20, counts: { pending: 0, ordered: 0, stock: 0 } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Réessayer' })[1]);
    expect(await screen.findByText('Aucune commande en attente')).toBeInTheDocument();
  });
  it('pagine chaque file indépendamment sans faire disparaître les autres', async () => {
    vi.mocked(consumablesApi.list).mockImplementation(async (view, _property, _search, page, size = 20) => ({
      rows: [{ ...row, name: `${view}-${page}` }], totalElements: 30, page, size, counts: { pending: 30, ordered: 30, stock: 30 },
    }));
    render(<Page />);
    expect(await screen.findByText('pending-0')).toBeInTheDocument();
    const pending = within(screen.getByRole('region', { name: /À commander/ }));
    fireEvent.click(pending.getByRole('link', { name: 'Go to next page' }));
    expect(await screen.findByText('pending-1')).toBeInTheDocument();
    expect(screen.getByText('ordered-0')).toBeInTheDocument();
    expect(screen.getByText('stock-0')).toBeInTheDocument();
    expect(consumablesApi.list).toHaveBeenCalledWith('pending', 'all', '', 1, 4);
  });
  it('confirme la quantité réellement reçue, bloque le double clic et attend le serveur', async () => {
    let resolveReceipt!: (value: never) => void;
    vi.mocked(propertyStockApi.restock).mockImplementation(() => new Promise(resolve => { resolveReceipt = resolve; }));
    render(<BaitlyConsumableInventory rows={[row]} filtered={false} onReset={reset} canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Capsules de café' }));
    const confirm = screen.getByRole('button', { name: 'Confirmer la réception' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantité reçue' }), { target: { value: '7' } });
    fireEvent.click(confirm);
    expect(propertyStockApi.restock).toHaveBeenCalledWith(12, 1, 7);
    expect(confirm).toBeDisabled();
    expect(screen.queryByText(/Réception enregistrée/)).not.toBeInTheDocument();
    resolveReceipt({} as never);
    expect(await screen.findByText(/7 unités ajoutées/)).toBeInTheDocument();
    expect(propertyStockApi.restock).toHaveBeenCalledOnce();
  });
  it('préserve le stock en cas d’échec de réception et respecte la lecture seule', async () => {
    vi.mocked(propertyStockApi.restock).mockRejectedValue(new Error('offline'));
    const { rerender } = render(<BaitlyConsumableInventory rows={[row]} filtered={false} onReset={reset} canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Capsules de café' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantité reçue' }), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la réception' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La réception n’a pas été enregistrée');
    expect(screen.queryByText(/unités ajoutées/)).not.toBeInTheDocument();
    rerender(<BaitlyConsumableInventory rows={[row]} filtered={false} onReset={reset} canEdit={false} />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});
