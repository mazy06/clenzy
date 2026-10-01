// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StockThumbnail } from './StockThumbnail';
import { resolveStockCatalog, searchStockCatalog } from './stockCatalog';
import { InventoryThumbnail } from '../properties/inventory/InventoryThumbnail';
import { resolveInventoryCatalog } from '../properties/inventory/inventoryCatalog';
import { resolveItemVisual } from './itemVisual';

describe('Association des visuels aux articles existants', () => {
  it.each([
    ["Bouteille d'eau 50cl", 'water-500'],
    ['Drap house', 'fitted-sheet'],
    ['housse de couettes', 'duvet-cover'],
    ['sac poubelle', 'bin-bags'],
    ['Taies d’oreiller', 'pillowcase'],
    ['Serviettes de bain', 'bath-towel'],
    ['Draps housses 160x200', 'fitted-sheet-160'],
    ['Gel douche 300ML', 'shower-gel-300'],
    ['Shampooing 300 ml', 'shampoo-300'],
    ['Tablette de lave vaisselle', 'dishwasher-tablets'],
    ['Tablettes de machine à laver', 'laundry-tablets'],
    ['Sucre en dosettes', 'sugar'],
    ['Dosettes de sucre', 'sugar'],
    ['Sucre en sticks', 'sugar'],
    ['Sucre roux en dosettes', 'brown-sugar'],
    ['Torchons de cuisine', 'kitchen-towel'],
    ['Torchons à vaisselle', 'kitchen-towel'],
    ['Essuie-vaisselle', 'kitchen-towel'],
  ])('retrouve le consommable %s', (name, key) => {
    expect(resolveStockCatalog(null, name)?.key).toBe(key);
  });

  it.each([
    ['Bouilloire', 'electric-kettle'], ['Micro-ondes', 'microwave'],
    ['Chaises de salle à manger', 'dining-chair'], ['Lits simples', 'single-bed'],
    ['Taies d’oreillers 65x65', 'pillowcase-65'],
    ['Torchons de cuisine', 'kitchen-towel'],
  ])('retrouve l’équipement %s', (name, key) => {
    expect(resolveInventoryCatalog(null, name)?.key).toBe(key);
  });

  it('retrouve une image après une saisie libre ou une ancienne référence inconnue', () => {
    expect(resolveStockCatalog('custom', 'Liquide vaisselle')?.key).toBe('dish-soap');
    expect(resolveStockCatalog('ancienne-reference', 'Capsules café')?.key).toBe('coffee-capsules');
    expect(resolveInventoryCatalog('custom', 'Télévision')?.key).toBe('television');
    expect(resolveInventoryCatalog('ancienne-reference', 'Micro-ondes')?.key).toBe('microwave');
  });

  it('respecte un choix explicite et ne déduit pas un produit ambigu ou inconnu', () => {
    expect(resolveStockCatalog('laundry-tablets', 'Mon article')?.key).toBe('laundry-tablets');
    expect(resolveStockCatalog(null, 'fruits frais')).toBeUndefined();
    expect(resolveStockCatalog(null, 'tablettes')).toBeUndefined();
    expect(resolveStockCatalog('custom', 'Savon artisanal inconnu')).toBeUndefined();
    expect(resolveInventoryCatalog(null, 'Meuble familial inconnu')).toBeUndefined();
  });

  it('partage les images entre inventaire et réassort, y compris pour un article ancien', () => {
    const { container } = render(<>
      <InventoryThumbnail name="Liquide vaisselle" />
      <StockThumbnail name="Micro-ondes" />
      <StockThumbnail name="Mon équipement" catalogKey="electric-kettle" />
    </>);
    expect([...container.querySelectorAll('[data-catalog-key]')].map(e => e.getAttribute('data-catalog-key')))
      .toEqual(['dish-soap', 'microwave', 'electric-kettle']);
    expect(container.querySelector('[data-catalog-key="dish-soap"]')).toHaveStyle({ backgroundImage: 'url(/images/stock/cleaning.webp)' });
    expect(container.querySelector('[data-catalog-key="microwave"]')).toHaveStyle({ backgroundImage: 'url(/images/inventory/large-appliances.webp)' });
  });

  it('garde la photo personnelle prioritaire sur le nom reconnu', () => {
    const photoUrl = 'data:image/png;base64,AA==';
    const { container } = render(<StockThumbnail name="Taies d’oreiller" catalogKey="custom" photoUrl={photoUrl} />);
    expect(container.querySelector('img')).toHaveAttribute('src', photoUrl);
  });

  it.each([
    ["Bouteille d'eau 50cl", 'water-500'], ['Drap house', 'fitted-sheet'],
    ['housse de couettes', 'duvet-cover'], ['sac poubelle', 'bin-bags'],
    ['Sucre en dosettes', 'sugar'], ['Torchons de cuisine', 'kitchen-towel'],
  ])('affiche %s avec le même visuel sur les deux écrans et le retrouve dans la recherche', (name, key) => {
    const { container } = render(<><InventoryThumbnail name={name} /><StockThumbnail name={name} catalogKey="custom" /></>);
    expect([...container.querySelectorAll('[data-catalog-key]')].map(e => e.getAttribute('data-catalog-key'))).toEqual([key, key]);
    expect(searchStockCatalog(name).some(entry => entry.key === key)).toBe(true);
  });

  it('distingue l’appareil de ses produits et préserve les dimensions et conditionnements', () => {
    for (const [name, key] of [
      ['Sèche-linge', 'dryer'], ['Balles sèche-linge', 'dryer-balls'],
      ['Bouteille d’eau 50cl', 'water-500'], ['Pack eau', 'water-pack'],
      ['Draps housses 90x200', 'fitted-sheet-90'], ['Draps housses 160x200', 'fitted-sheet-160'],
      ['Tablettes pour lave-vaisselle', 'dishwasher-tablets'], ['Tablettes pour machine à laver', 'laundry-tablets'],
    ]) expect(resolveItemVisual(null, name)?.key).toBe(key);
    expect(resolveItemVisual(null, 'Tablettes sans précision')).toBeUndefined();
    expect(resolveItemVisual(null, 'Pack eau gazeuse')?.key).toBe('sparkling-water-pack');
  });

  it('distingue les dosettes des morceaux de sucre et le torchon des autres textiles', () => {
    expect(resolveItemVisual(null, 'Sucre en dosettes 5g')?.key).toBe('sugar');
    expect(resolveItemVisual(null, 'Sucre roux en dosettes 5g')?.key).toBe('brown-sugar');
    expect(resolveItemVisual(null, 'Sucre en morceaux 1kg')?.key).toBe('sugar-cubes');
    expect(resolveItemVisual(null, 'Sucre en dosettes')?.image).not.toEqual(resolveItemVisual(null, 'Sucre en morceaux')?.image);
    const textiles = ['Torchons de cuisine 50x70', 'Chiffons microfibre', 'Serviettes de bain', 'Serviettes de table', 'Essuie-tout'];
    const images = textiles.map(name => resolveItemVisual(null, name)?.image);
    expect(images.every(Boolean)).toBe(true);
    expect(new Set(images.map(image => JSON.stringify(image))).size).toBe(textiles.length);
  });

  it('affiche la photo entière du torchon dans chaque vue', () => {
    const { container } = render(<><InventoryThumbnail name="Torchons de cuisine" /><StockThumbnail name="Torchons de cuisine" /></>);
    for (const thumbnail of container.querySelectorAll('[data-catalog-key]')) {
      expect(thumbnail).toHaveAttribute('data-catalog-key', 'kitchen-towel');
      expect(thumbnail).toHaveStyle({ backgroundImage: 'url(/images/stock/kitchen-linen.webp)', backgroundSize: '100% 100%', backgroundPosition: '0% 0%' });
    }
  });
});
