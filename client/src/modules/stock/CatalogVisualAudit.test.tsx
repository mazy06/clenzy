// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { INVENTORY_CATALOG } from '../properties/inventory/inventoryCatalog';
import { InventoryThumbnail } from '../properties/inventory/InventoryThumbnail';
import { STOCK_CATALOG } from './stockCatalog';
import { resolveItemVisual } from './itemVisual';
import { StockThumbnail } from './StockThumbnail';

const entries = [...new Map([...INVENTORY_CATALOG, ...STOCK_CATALOG].map(entry => [entry.key, entry])).values()];
const imageOf = (name: string) => resolveItemVisual(null, name)?.image;

describe('Audit de toutes les correspondances des visuels', () => {
  it.each(entries.map(entry => [entry.key, entry.names] as const))('retrouve %s dans les trois langues', (key, names) => {
    for (const name of Object.values(names)) expect(resolveItemVisual(null, name)?.key, name).toBe(key);
  });

  it.each([
    ['Draps housse 140x190', 'fitted-sheet'],
    ['Draps housse 140 × 190 cm', 'fitted-sheet'],
    ['Draps house (140*190cm)', 'fitted-sheet'],
    ['Drap housse 140/190', 'fitted-sheet'],
    ['Drap housse 140 par 190 cm', 'fitted-sheet'],
    ['Housses de couettes 260x240', 'duvet-cover'],
    ['Taies d’oreillers 60x60', 'pillowcase'],
    ['Serviettes de bain 70x140 cm', 'bath-towel'],
    ['Gel douche 250ml', 'shower-gel'],
    ['Shampooing 500 ml', 'shampoo'],
    ['Savon mains 5L', 'hand-soap'],
    ['Liquide vaisselle 2 litres', 'dish-soap'],
    ['Lessive liquide 3 l', 'laundry-detergent'],
    ['Sacs poubelle 100L', 'bin-bags'],
    ['Sacs poubelles 100 L (lot de 20)', 'bin-bags'],
    ['Capsules café x40', 'coffee-capsules'],
    ['Capsules de lessive (boîte de 30)', 'laundry-pods'],
    ['Tablettes lave-vaisselle 60 unités', 'dishwasher-tablets'],
    ['Tablettes de machine à laver x50', 'laundry-tablets'],
    ['Bouteille d’eau 1,5L', 'water'],
    ['Pack d’eau plate 6 × 33 cl', 'water-pack'],
    ['Pack d’eau plate 6 × 50 cl (lot de 2)', 'water-pack-small'],
    ['Café en grains 1kg', 'coffee-beans'],
    ['Riz 500 g', 'rice'],
    ['Télévision 55 pouces', 'television'],
    ['Canapé 3 places 220x90cm', 'sofa-three'],
    ['Lit double 140x190', 'double-bed'],
    ['Lit queen size 160x190', 'queen-bed'],
    ['Lit king size 180x210', 'king-bed'],
  ])('utilise le type reconnu pour %s sans inventer de nouvelle référence', (name, key) => {
    expect(resolveItemVisual(null, name)?.key).toBe(key);
  });

  it.each(entries.map(entry => [entry.key, entry.names.fr] as const))('conserve le visuel de %s avec les indications de format et conditionnement', (key, name) => {
    for (const suffix of [' (lot de 12)', ' (140 × 190 cm)', ' (500 ml)', ' x40']) {
      expect(imageOf(`${name}${suffix}`), `${name}${suffix}`).toEqual(resolveItemVisual(key)?.image);
    }
  });

  it('conserve les distinctions de produit, les choix explicites et les mots inconnus', () => {
    expect(imageOf('Tablettes lave-vaisselle 60 unités')).not.toEqual(imageOf('Tablettes de machine à laver x50'));
    expect(resolveItemVisual(null, 'Canapé 2 places 140x80cm')?.key).toBe('sofa-two');
    expect(resolveItemVisual(null, 'Canapé 3 places 220x90cm')?.key).toBe('sofa-three');
    expect(resolveItemVisual('fitted-sheet-140', 'Mon linge 140x190')?.key).toBe('fitted-sheet-140');
    for (const name of ['Tablettes 60 unités', 'Canapé 4 places', 'Lit 5 personnes', 'Savon artisanal inconnu 100g', 'Sacs aspirateur 30L', 'Batteries AA 140x190', 'Drap housse anti-acariens inconnu 140x190', 'TélévisionX100']) {
      expect(resolveItemVisual(null, name), name).toBeUndefined();
    }
  });

  it('affiche le drap 140x190 dans les deux vues en conservant le nom et la photo personnelle', () => {
    const name = 'Draps housse 140x190';
    const photoUrl = 'data:image/png;base64,AA==';
    const { container } = render(<><span>{name}</span><InventoryThumbnail name={name} /><StockThumbnail name={name} catalogKey="custom" /><StockThumbnail name={name} photoUrl={photoUrl} /></>);
    expect(container).toHaveTextContent(name);
    expect(container.querySelectorAll('[data-catalog-key="fitted-sheet"]')).toHaveLength(3);
    expect(container.querySelector('img')).toHaveAttribute('src', photoUrl);
  });
});
