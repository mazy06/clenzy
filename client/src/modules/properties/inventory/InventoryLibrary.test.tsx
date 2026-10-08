// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { renderWithProviders as render, screen, fireEvent, waitFor } from '../../../test/renderWithProviders';
import { INVENTORY_CATALOG, INVENTORY_FAMILIES, inventoryName, resolveInventoryCatalog, searchInventoryCatalog } from './inventoryCatalog';
import { INVENTORY_SHEETS } from './inventoryCatalogData';
import { InventoryLibrary } from './InventoryLibrary';
import { InventoryItemEditor } from './InventoryItemEditor';
import { InventoryThumbnail } from './InventoryThumbnail';
import InventoryItemsSection from './InventoryItemsSection';
import propertyInventoryApi from '../../../services/api/propertyInventoryApi';
import apiClient from '../../../services/apiClient';
import fr from '../../../../public/locales/fr.json';
import en from '../../../../public/locales/en.json';
import ar from '../../../../public/locales/ar.json';

const item = { id: 1, propertyId: 10, name: 'Ma cafetière', category: 'Cuisine', quantity: 2, notes: 'Modèle bleu', catalogKey: 'capsule-machine', photoUrl: null };

describe('Bibliothèque des équipements du logement', () => {
  it('couvre 432 équipements distincts et le linge avec des images locales et trois langues', () => {
    expect(INVENTORY_SHEETS).toHaveLength(27);
    expect(INVENTORY_CATALOG).toHaveLength(457);
    expect(new Set(INVENTORY_CATALOG.map(entry => entry.key)).size).toBe(INVENTORY_CATALOG.length);
    expect(new Set(INVENTORY_CATALOG.map(entry => `${entry.image.src}:${entry.image.slot}`)).size).toBe(449);
    INVENTORY_SHEETS.forEach(sheet => expect(sheet.items).toHaveLength(16));
    for (const entry of INVENTORY_CATALOG) {
      expect(entry.key).toMatch(/^[a-z0-9][a-z0-9-]{0,79}$/);
      expect(existsSync(`public${entry.image.src}`)).toBe(true);
      expect(entry.image.slot).toBeGreaterThanOrEqual(0);
      expect(entry.image.slot).toBeLessThan((entry.image.grid ?? 4) ** 2);
      for (const language of ['fr', 'en', 'ar']) expect(inventoryName(entry, language).length).toBeGreaterThan(1);
      for (const locale of [fr, en, ar]) {
        expect(locale.inventoryLibrary.families).toHaveProperty(entry.family);
        expect(locale.inventoryLibrary.rooms).toHaveProperty(entry.room);
      }
    }
    expect(INVENTORY_FAMILIES).toHaveLength(28);
  });

  it('distingue les variantes de lavage, de café et de literie', () => {
    for (const keys of [
      ['front-washer', 'top-washer', 'dryer', 'washer-dryer', 'dishwasher', 'mini-dishwasher'],
      ['capsule-machine', 'pod-machine', 'filter-coffee', 'bean-coffee', 'french-press', 'moka-pot'],
      ['single-bed', 'double-bed', 'queen-bed', 'king-bed', 'bunk-bed', 'trundle-bed'],
      ['tablespoon', 'teaspoon', 'serving-spoon'],
      ['toilet', 'wall-toilet', 'washbasin', 'vessel-basin'],
    ]) {
      const entries = keys.map(key => resolveInventoryCatalog(key)!);
      expect(entries.every(Boolean)).toBe(true);
      expect(new Set(entries.map(entry => `${entry.image.src}:${entry.image.slot}`)).size).toBe(keys.length);
    }
  });

  it('recherche sans accents, avec synonymes et familles sans attribuer un visuel arbitraire', () => {
    expect(searchInventoryCatalog('nespresso').map(entry => entry.key)).toEqual(['capsule-machine']);
    expect(searchInventoryCatalog('machine a laver').map(entry => entry.key)).toEqual(['front-washer']);
    expect(searchInventoryCatalog('غسالة').length).toBeGreaterThan(3);
    expect(searchInventoryCatalog('frigo').length).toBe(4);
    expect(searchInventoryCatalog('chaises').length).toBeGreaterThan(1);
    expect(searchInventoryCatalog('160', 'beds').map(entry => entry.key)).toEqual(['queen-bed']);
    expect(resolveInventoryCatalog(null, 'Télévision')?.key).toBe('television');
    expect(resolveInventoryCatalog(null, 'Serviette de mains')?.key).toBe('hand-towel');
    expect(resolveInventoryCatalog('custom', 'Télévision')?.key).toBe('television');
    expect(resolveInventoryCatalog(null, 'Meuble familial inconnu')).toBeUndefined();
  });

  it('conserve la sélection entre filtres et ajoute seulement les objets choisis avec quantité et pièce', async () => {
    const add = vi.fn().mockResolvedValue([]), close = vi.fn();
    render(<InventoryLibrary items={[item]} onAdd={add} onClose={close} />);
    fireEvent.change(screen.getByLabelText('Rechercher un équipement'), { target: { value: 'nespresso' } });
    expect(screen.getByText('Déjà présent : 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cafetière à capsules/ }));
    fireEvent.change(screen.getByLabelText('Quantité : Cafetière à capsules'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Pièce : Cafetière à capsules'), { target: { value: 'Bureau' } });
    fireEvent.change(screen.getByLabelText('Rechercher un équipement'), { target: { value: 'lave-vaisselle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lave-vaisselle', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Voir ma sélection (2)' }));
    expect(screen.getByLabelText('Quantité : Cafetière à capsules')).toHaveValue(3);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au logement (2)' }));
    await waitFor(() => expect(add).toHaveBeenCalledWith([
      expect.objectContaining({ catalogKey: 'dishwasher', quantity: 1, category: 'Cuisine' }),
      expect.objectContaining({ catalogKey: 'capsule-machine', quantity: 3, category: 'Bureau' }),
    ]));
    expect(close).toHaveBeenCalledOnce();
  });

  it('bloque les quantités invalides et conserve la sélection après une erreur réseau', async () => {
    const add = vi.fn().mockRejectedValue(new Error('offline')), close = vi.fn();
    render(<InventoryLibrary items={[]} onAdd={add} onClose={close} />);
    fireEvent.change(screen.getByLabelText('Rechercher un équipement'), { target: { value: 'nespresso' } });
    fireEvent.click(screen.getByRole('button', { name: /Cafetière à capsules/ }));
    fireEvent.change(screen.getByLabelText('Quantité : Cafetière à capsules'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au logement (1)' }));
    expect(add).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('quantité entière');
    fireEvent.change(screen.getByLabelText('Quantité : Cafetière à capsules'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au logement (1)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('saisie est conservée');
    expect(screen.getByLabelText('Quantité : Cafetière à capsules')).toHaveValue(2);
    expect(close).not.toHaveBeenCalled();
  });

  it('personnalise un objet et conserve le nom lors du choix d’un visuel', async () => {
    const save = vi.fn().mockResolvedValue(item);
    render(<InventoryItemEditor initial={{ name: '', quantity: 1, category: 'Autre', catalogKey: 'custom' }} onSave={save} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nom de l’objet'), { target: { value: 'Fauteuil de famille' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choisir une image par défaut' }));
    fireEvent.change(screen.getByLabelText('Rechercher un équipement'), { target: { value: 'Fauteuil à bascule' } });
    fireEvent.click(screen.getByRole('button', { name: /Fauteuil à bascule/ }));
    expect(screen.getByLabelText('Nom de l’objet')).toHaveValue('Fauteuil de famille');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fauteuil de famille', catalogKey: 'rocking-chair', quantity: 1 })));
  });

  it('supprime explicitement une photo sans perdre la référence et garde la saisie si la sauvegarde échoue', async () => {
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    render(<InventoryItemEditor initial={{ ...item, photoUrl: 'data:image/png;base64,AA==' }} onSave={save} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retirer ma photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ catalogKey: 'capsule-machine', photoUrl: null, clearPhoto: true, quantity: 2 })));
    expect(await screen.findByRole('alert')).toHaveTextContent('saisie est conservée');
    expect(screen.getByLabelText('Nom de l’objet')).toHaveValue('Ma cafetière');
  });

  it('revient à la bibliothèque si la photo personnelle est illisible', () => {
    const { container } = render(<InventoryThumbnail {...item} photoUrl="data:image/png;base64,AA==" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-catalog-key=capsule-machine]')).toHaveStyle({ backgroundImage: 'url(/images/inventory/coffee-drinks.webp)' });
  });

  it('masque les actions en lecture seule', () => {
    render(<InventoryItemsSection items={[item]} canEdit={false} onAdd={vi.fn()} onAddMany={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Ma cafetière')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bibliothèque|Modifier|Supprimer|Autre objet/ })).toBeNull();
  });

  it('envoie le lot à la route du logement et le retrait explicite de photo à la route de l’objet', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue([]);
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue(item);
    try {
      await propertyInventoryApi.addItems(10, [item]);
      expect(post).toHaveBeenCalledWith('/properties/10/inventory/items/batch', [item]);
      await propertyInventoryApi.updateItem(10, 1, { clearPhoto: true });
      expect(put).toHaveBeenCalledWith('/properties/10/inventory/items/1', { clearPhoto: true });
    } finally { post.mockRestore(); put.mockRestore(); }
  });
});
