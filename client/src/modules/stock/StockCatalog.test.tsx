// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import { renderWithProviders as render, screen, fireEvent, waitFor } from '../../test/renderWithProviders';
import { STOCK_CATALOG, STOCK_FAMILIES, STOCK_FAMILY_CATEGORIES, STOCK_IMAGE_SHEETS, resolveStockCatalog, searchStockCatalog } from './stockCatalog';
import { StockItemEditor } from './StockItemEditor';
import { StockThumbnail } from './StockThumbnail';
import { StockActionThumbnail } from './StockActionThumbnail';
import { prepareStockPhoto } from './stockPhoto';
import type { PropertyStockItemRequest } from '../../services/api/propertyStockApi';
import { propertyStockApi } from '../../services/api/propertyStockApi';
import PropertyStockSection from '../properties/inventory/PropertyStockSection';
import { ActionParamsModal } from '../supervision/components/ActionParamsModal';

const auth = vi.hoisted(() => ({ user: { id: 4, organizationId: 7 }, loading: false }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/api/propertyStockApi', () => ({ propertyStockApi: {
  visual: vi.fn(), list: vi.fn(), save: vi.fn(), restock: vi.fn(), remove: vi.fn(),
} }));

const empty: PropertyStockItemRequest = { id: null, name: '', category: 'LINEN', unit: null, quantity: 0, reorderThreshold: 0, reorderQuantity: 0, consumptionPerStay: 0, supplierName: null, supplierEmail: null };

function Editor({ initial = empty, save = vi.fn() }: { initial?: PropertyStockItemRequest; save?: (value: PropertyStockItemRequest) => void }) {
  const [value, setValue] = useState(initial);
  return <StockItemEditor value={value} onChange={setValue} saving={false} error={null} onSave={() => save(value)} onClose={vi.fn()} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 4, organizationId: 7 };
  vi.mocked(propertyStockApi.visual).mockResolvedValue({ name: 'Capsules maison', catalogKey: 'coffee-capsules', photoUrl: null });
});

describe('Bibliothèque de stock', () => {
  it('propose des références uniques et des visuels complets dans les trois langues', () => {
    expect(STOCK_CATALOG.length).toBe(224);
    expect(new Set(STOCK_CATALOG.map(entry => entry.key)).size).toBe(STOCK_CATALOG.length);
    for (const entry of STOCK_CATALOG) {
      expect(entry.key).toMatch(/^[a-z0-9-]+$/);
      expect(Object.values(entry.names).every(Boolean)).toBe(true);
      expect(entry.image.slot).toBeGreaterThanOrEqual(0);
      expect(entry.image.slot).toBeLessThan((entry.image.grid ?? 4) ** 2);
      expect(STOCK_FAMILIES).toContain(entry.family);
      expect(entry.category).toBe(STOCK_FAMILY_CATEGORIES[entry.family]);
      expect(STOCK_IMAGE_SHEETS).toContain(entry.image.sheet);
    }
    for (const sheet of STOCK_IMAGE_SHEETS) expect(existsSync(`public/images/stock/${sheet}.webp`)).toBe(true);
    expect(new Set(STOCK_CATALOG.map(entry => `${entry.image.sheet}/${entry.image.slot}`)).size).toBe(191);
  });
  it('recherche sans accents et filtre par catégorie en français, anglais et arabe', () => {
    expect(searchStockCatalog('cafe')).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'coffee-capsules' })]));
    expect(searchStockCatalog('soap', 'CLEANING')).toHaveLength(0);
    expect(searchStockCatalog('قهوة').length).toBeGreaterThan(0);
    expect(searchStockCatalog('fitted 160')[0].key).toBe('fitted-sheet-160');
  });
  it('reconnaît les anciens noms et les articles libres identifiables', () => {
    expect(resolveStockCatalog(null, 'Capsules cafe')?.key).toBe('coffee-capsules');
    expect(resolveStockCatalog(null, 'Gel douche 300ml')?.key).toBe('shower-gel-300');
    expect(resolveStockCatalog('custom', 'Capsules cafe')?.key).toBe('coffee-capsules');
    expect(resolveStockCatalog(null, 'Savon artisanal inconnu')).toBeUndefined();
  });
  it('distingue les pastilles et capsules de vaisselle des tablettes et capsules de lessive', () => {
    const keys = ['dishwasher-tablets', 'dishwasher-capsules', 'laundry-tablets', 'laundry-pods'];
    const products = keys.map(key => resolveStockCatalog(key)!);
    expect(new Set(products.map(item => `${item.image.sheet}/${item.image.slot}`)).size).toBe(4);
    expect(searchStockCatalog('tablette machine a laver').map(item => item.key)).toEqual(['laundry-tablets']);
    expect(searchStockCatalog('capsule', undefined, { family: 'dishwashing' }).map(item => item.key)).toEqual(['dishwasher-capsules']);
    expect(resolveStockCatalog(null, 'Tablettes lave-vaisselle')?.key).toBe('dishwasher-tablets');
    expect(resolveStockCatalog(null, 'Pastilles machine à laver')?.key).toBe('laundry-tablets');
  });
  it('couvre les boissons, aliments et coffrets et combine famille, usage et recherche', () => {
    expect(searchStockCatalog('pack eau').map(item => item.key)).toEqual(expect.arrayContaining(['water-pack', 'water-pack-small', 'sparkling-water-pack']));
    expect(searchStockCatalog('soda').length).toBeGreaterThanOrEqual(6);
    expect(searchStockCatalog('oeufs').map(item => item.key)).toEqual(['eggs']);
    expect(searchStockCatalog('حليب').length).toBeGreaterThan(0);
    for (const family of ['drinks', 'breakfast', 'pantry', 'fresh', 'snacks', 'kits'] as const) {
      expect(searchStockCatalog('', undefined, { family, use: 'upsell' }).length).toBeGreaterThanOrEqual(16);
    }
    expect(searchStockCatalog('petit dejeuner', undefined, { family: 'kits', use: 'welcome' }).map(item => item.key))
      .toEqual(expect.arrayContaining(['breakfast-basket', 'breakfast-cereal-kit']));
    expect(searchStockCatalog('', undefined, { family: 'laundry', use: 'upsell' })).toEqual([]);
  });
  it('filtre la bibliothèque, réinitialise un filtre vide et conserve la référence choisie', () => {
    const save = vi.fn();
    render(<Editor save={save} />);
    fireEvent.change(screen.getByLabelText('Famille d’articles'), { target: { value: 'laundry' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vente en supplément' }));
    expect(screen.queryByRole('button', { name: 'Capsules de lessive' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(screen.getByLabelText('Famille d’articles')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Tous les articles' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Famille d’articles'), { target: { value: 'drinks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vente en supplément' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pack d’eau plate 6 × 1,5 L' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ catalogKey: 'water-pack', category: 'CONSUMABLES', photoUrl: null }));
  });
  it('sélectionne une référence et enregistre son lien sans ajouter le reste de la bibliothèque', () => {
    const save = vi.fn();
    render(<Editor save={save} />);
    fireEvent.change(screen.getByLabelText('Rechercher un article'), { target: { value: 'Capsules de café' } });
    fireEvent.click(screen.getByRole('button', { name: 'Capsules de café', exact: true }));
    expect(screen.getByLabelText('Article')).toHaveValue('Capsules de café');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ catalogKey: 'coffee-capsules', category: 'CONSUMABLES', photoUrl: null }));
  });
  it('offre Autre article même sans résultat et exige un nom', () => {
    const save = vi.fn();
    render(<Editor save={save} />);
    fireEvent.change(screen.getByLabelText('Rechercher un article'), { target: { value: 'inconnu-12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Autre article' }));
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Article'), { target: { value: 'Panier local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ catalogKey: 'custom', name: 'Panier local', photoUrl: null }));
  });
  it('conserve la photo et les quantités lors d’une modification, et permet le retour au visuel par défaut', () => {
    const save = vi.fn();
    const photoUrl = 'data:image/png;base64,AA==';
    render(<Editor initial={{ ...empty, id: 5, name: 'Mon café', quantity: 14, catalogKey: 'coffee-capsules', photoUrl }} save={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ photoUrl, quantity: 14 }));
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir l’image par défaut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ photoUrl: null, catalogKey: 'coffee-capsules', quantity: 14 }));
  });
  it('garde la saisie après un échec de sauvegarde et affiche une erreur', async () => {
    vi.mocked(propertyStockApi.list).mockResolvedValue([]);
    vi.mocked(propertyStockApi.save).mockRejectedValue(new Error('offline'));
    render(<PropertyStockSection propertyId={10} canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Autre article' }));
    fireEvent.change(screen.getByLabelText('Article'), { target: { value: 'Panier local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La modification n’a pas pu être enregistrée');
    expect(screen.getByLabelText('Article')).toHaveValue('Panier local');
  });
  it('refuse les SVG et les fichiers trop lourds avant décodage', async () => {
    await expect(prepareStockPhoto(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }))).rejects.toMatchObject({ reason: 'format' });
    await expect(prepareStockPhoto(new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'x.jpg', { type: 'image/jpeg' }))).rejects.toMatchObject({ reason: 'size' });
  });
  it('revient à la photo générique si la photo personnelle est illisible', () => {
    const { container } = render(<StockThumbnail name="Café" catalogKey="coffee-capsules" photoUrl="data:image/png;base64,AA==" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-catalog-key="coffee-capsules"]')).toBeInTheDocument();
  });
  it('charge le visuel associé à la carte et isole le cache entre organisations', async () => {
    const { container, rerender } = render(<StockActionThumbnail name="Ancien nom" stockItemId={18} />);
    await waitFor(() => expect(container.querySelector('[data-catalog-key="coffee-capsules"]')).toBeInTheDocument());
    expect(propertyStockApi.visual).toHaveBeenCalledWith(18);
    auth.user = { id: 4, organizationId: 8 };
    vi.mocked(propertyStockApi.visual).mockResolvedValue({ name: 'Savon', catalogKey: 'hand-soap', photoUrl: null });
    rerender(<StockActionThumbnail name="Savon" stockItemId={18} />);
    await waitFor(() => expect(container.querySelector('[data-catalog-key="hand-soap"]')).toBeInTheDocument());
    expect(propertyStockApi.visual).toHaveBeenCalledTimes(2);
  });
  it.each([
    ["Bouteille d'eau 50cl", 'water-500'], ['Drap house', 'fitted-sheet'],
    ['housse de couettes', 'duvet-cover'], ['sac poubelle', 'bin-bags'],
    ['Draps housse 140x190', 'fitted-sheet'], ['Housses de couette 260x240', 'duvet-cover'],
    ['Sucre en dosettes', 'sugar'], ['Torchons de cuisine', 'kitchen-towel'],
  ])('retrouve le visuel de réassort pour %s après chargement de l’article', async (name, key) => {
    vi.mocked(propertyStockApi.visual).mockResolvedValue({ name, catalogKey: 'custom', photoUrl: null });
    const { container } = render(<StockActionThumbnail name="Ancien nom" stockItemId={18} />);
    await waitFor(() => expect(container.querySelector(`[data-catalog-key="${key}"]`)).toBeInTheDocument());
    expect(propertyStockApi.visual).toHaveBeenCalledWith(18);
  });
  it('partage la photo dans la modale de commande et préremplit la quantité sans la répéter', async () => {
    const photoUrl = 'data:image/png;base64,AA==';
    vi.mocked(propertyStockApi.visual).mockResolvedValue({ name: 'Mon café', catalogKey: 'custom', photoUrl });
    const confirm = vi.fn();
    render(<ActionParamsModal onClose={vi.fn()} onConfirm={confirm} action={{
      id: 'suggestion:15', agentId: 'ops', title: 'Stock bas : Mon café (2 restant)',
      motif: 'Seuil de 2 atteint. « Commander » envoie le bon de commande (4 boîte) à Cafés Belleville — le réassort se confirme ensuite dans la fiche du logement.',
      actionParams: '{"stockItemId":18}', applyActionType: 'LINEN_STOCK_ORDER', reasoning: '', createdAt: '2026-10-01', expiresAt: '2099-10-01',
    }} />);
    expect(screen.getByRole('spinbutton', { name: /Quantité/ })).toHaveValue(4);
    expect(screen.queryByText('À commander')).toBeNull();
    await waitFor(() => expect(document.querySelector('.baitly-stock-thumbnail img')).toHaveAttribute('src', photoUrl));
    fireEvent.click(screen.getByRole('button', { name: 'Commander', exact: true }));
    expect(confirm).toHaveBeenCalledWith({ quantity: 4 });
  });
});
