import { INVENTORY_CATALOG } from '../properties/inventory/inventoryCatalog';
import { STOCK_CATALOG } from './stockCatalog';
import { createCatalogVisualResolver } from './catalogMatching';

// Une image d'article ne dépend pas de l'écran : inventaire, stock, réassort et commande.
const entries = new Map(INVENTORY_CATALOG.map(entry => [entry.key, entry]));
for (const item of STOCK_CATALOG) {
  entries.set(item.key, { ...item, room: '', image: { src: `/images/stock/${item.image.sheet}.webp`, slot: item.image.slot, grid: item.image.grid } });
}
export const resolveItemVisual = createCatalogVisualResolver([...entries.values()]);
