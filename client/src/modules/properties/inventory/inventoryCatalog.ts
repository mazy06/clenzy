import { INVENTORY_SHEETS } from './inventoryCatalogData';
import { STOCK_CATALOG, normalizeStockSearch } from '../../stock/stockCatalog';
import { createCatalogResolver, normalizeCatalogName } from '../../stock/catalogMatching';

export const INVENTORY_ROOMS = ['Cuisine', 'Salon', 'Chambre', 'Salle de bain', 'Exterieur', 'Bureau', 'Buanderie', 'Entree', 'Rangement', 'Autre'] as const;
export const INVENTORY_FAMILIES = [...INVENTORY_SHEETS.map(sheet => sheet.key), 'linen'];
export interface InventoryCatalogEntry {
  key: string;
  family: string;
  room: string;
  names: { fr: string; en: string; ar: string };
  image: { src: string; slot: number; grid?: 1 | 4 };
  aliases?: readonly string[];
}

const aliases: Record<string, string[]> = {
  'sofa-bed': ['Canapé-lit', 'Sofa convertible'], 'sofa-two': ['Canapé deux places'],
  'single-bed': ['Lit simple', 'Lit 1 personne'], 'double-bed': ['Lit double', 'Lit 2 personnes'],
  'queen-bed': ['Lit 160', 'Lit queen size'], 'king-bed': ['Lit 180', 'Lit king size'], 'television': ['Télévision', 'TV', 'Tele'],
  'front-washer': ['Lave-linge', 'Machine à laver', 'Lave linge hublot'],
  'capsule-machine': ['Machine Nespresso', 'Cafetière Nespresso'],
  'pod-machine': ['Machine Senseo', 'Cafetière Senseo'],
  'fridge': ['Frigo', 'Réfrigérateur une porte'], 'fridge-freezer': ['Frigo combiné'],
  'american-fridge': ['Frigo américain'], 'mini-fridge': ['Minibar', 'Petit frigo'],
  'air-fryer': ['Airfryer', 'Air fryer', 'Friteuse sans huile'],
  'pressure-cooker': ['Autocuiseur'], 'hand-blender': ['Mixeur à soupe'],
  'wall-toilet': ['Toilettes suspendues'], 'toilet': ['Toilettes', 'WC'],
  'hot-tub': ['Spa'], 'wooden-hanger': ['Cintre'], 'oven': ['Four'],
  'electric-kettle': ['Bouilloire', 'Electric kettle'], 'microwave': ['Micro-ondes', 'Four micro-ondes', 'Microwave'],
  'toaster': ['Toaster'], 'hairdryer': ['Hairdryer'],
};

export const INVENTORY_CATALOG: InventoryCatalogEntry[] = [
  ...INVENTORY_SHEETS.flatMap(sheet => sheet.items.map(([key, fr, en, ar], slot) => ({
    key, family: sheet.key, room: ['kitchen-sink', 'kitchen-tap'].includes(key) ? 'Cuisine' : sheet.room, names: { fr, en, ar }, aliases: aliases[key],
    image: { src: `/images/inventory/${sheet.key}.webp`, slot },
  }))),
  ...STOCK_CATALOG.filter(item => item.category === 'LINEN').map(item => ({
    key: item.key, family: 'linen', room: ['bath-towel', 'hand-towel', 'bath-mat', 'bathrobe', 'washcloth'].includes(item.key) ? 'Salle de bain' : ['tablecloth', 'napkins', 'kitchen-towel'].includes(item.key) ? 'Cuisine' : 'Chambre',
    names: item.names, aliases: item.aliases, image: { src: `/images/stock/${item.image.sheet}.webp`, slot: item.image.slot, grid: item.image.grid },
  })),
];
export function inventoryName(item: InventoryCatalogEntry, language: string): string {
  return item.names[language.startsWith('ar') ? 'ar' : language.startsWith('en') ? 'en' : 'fr'];
}
export const normalizeInventorySearch = normalizeStockSearch;
const index = new Map(INVENTORY_CATALOG.map(item => [item.key, normalizeCatalogName([
  ...Object.values(item.names), ...(item.aliases ?? []), item.room,
].join(' '))]));
export function searchInventoryCatalog(query: string, family = ''): InventoryCatalogEntry[] {
  const words = normalizeCatalogName(query).split(' ').filter(Boolean);
  return INVENTORY_CATALOG.filter(item => (!family || item.family === family) && words.every(word => index.get(item.key)!.includes(word)));
}
/** Les anciens objets restent inchangés. Une référence explicite est prioritaire sur le nom. */
export const resolveInventoryCatalog = createCatalogResolver(INVENTORY_CATALOG);
