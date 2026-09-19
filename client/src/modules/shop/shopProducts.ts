export type ProductCategory = 'noise' | 'lock' | 'environment' | 'kit';
export type Protocol = 'wifi' | 'zigbee' | 'both';

export interface ShopProduct {
  id: string;
  sku: string;
  nameKey: string;
  shortDescriptionKey: string;
  descriptionKey: string;
  price: number; // in cents
  originalPrice?: number; // for kits showing savings
  category: ProductCategory;
  featureKeys: string[];
  protocol?: Protocol;
  badge?: 'new' | 'bestseller' | 'promo';
  kitProductIds?: string[]; // for kit products
  icon: string; // lucide-react icon name (used in SVG hero composition)
  /**
   * Optional self-hosted product image (e.g. `/images/shop/clenzy-nm-01.jpg`).
   * When empty, the ProductHero component renders a bespoke SVG composition.
   * Drop JPG/PNG files into `client/public/images/shop/` and set the path here.
   */
  imageUrl?: string;
  imageAltKey: string;
}

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    id: 'clenzy-nm-01',
    sku: 'CLENZY-NM-01',
    nameKey: 'shop.products.nm_01.name',
    shortDescriptionKey: 'shop.products.nm_01.short',
    descriptionKey: 'shop.products.nm_01.description',
    price: 4900,
    category: 'noise',
    protocol: 'wifi',
    badge: 'bestseller',
    featureKeys: [
      'shop.products.nm_01.f1',
      'shop.products.nm_01.f2',
      'shop.products.nm_01.f3',
      'shop.products.nm_01.f4',
      'shop.products.nm_01.f5',
      'shop.products.nm_01.f6',
    ],
    icon: 'VolumeUp',
    imageAltKey: 'shop.products.nm_01.alt',
  },
  {
    id: 'clenzy-sl-01',
    sku: 'CLENZY-SL-01',
    nameKey: 'shop.products.sl_01.name',
    shortDescriptionKey: 'shop.products.sl_01.short',
    descriptionKey: 'shop.products.sl_01.description',
    price: 14900,
    category: 'lock',
    protocol: 'both',
    badge: 'new',
    featureKeys: [
      'shop.products.sl_01.f1',
      'shop.products.sl_01.f2',
      'shop.products.sl_01.f3',
      'shop.products.sl_01.f4',
      'shop.products.sl_01.f5',
      'shop.products.sl_01.f6',
    ],
    icon: 'Lock',
    imageAltKey: 'shop.products.sl_01.alt',
  },
  {
    id: 'clenzy-th-01',
    sku: 'CLENZY-TH-01',
    nameKey: 'shop.products.th_01.name',
    shortDescriptionKey: 'shop.products.th_01.short',
    descriptionKey: 'shop.products.th_01.description',
    price: 1900,
    category: 'environment',
    protocol: 'zigbee',
    featureKeys: ['shop.products.th_01.f1', 'shop.products.th_01.f2', 'shop.products.th_01.f3', 'shop.products.th_01.f4', 'shop.products.th_01.f5'],
    icon: 'Thermostat',
    imageAltKey: 'shop.products.th_01.alt',
  },
  {
    id: 'clenzy-dw-01',
    sku: 'CLENZY-DW-01',
    nameKey: 'shop.products.dw_01.name',
    shortDescriptionKey: 'shop.products.dw_01.short',
    descriptionKey: 'shop.products.dw_01.description',
    price: 1200,
    category: 'environment',
    protocol: 'zigbee',
    featureKeys: [
      'shop.products.dw_01.f1',
      'shop.products.dw_01.f2',
      'shop.products.dw_01.f3',
      'shop.products.dw_01.f4',
    ],
    icon: 'SensorDoor',
    imageAltKey: 'shop.products.dw_01.alt',
  },
  {
    id: 'clenzy-mo-01',
    sku: 'CLENZY-MO-01',
    nameKey: 'shop.products.mo_01.name',
    shortDescriptionKey: 'shop.products.mo_01.short',
    descriptionKey: 'shop.products.mo_01.description',
    price: 1500,
    category: 'environment',
    protocol: 'zigbee',
    featureKeys: ['shop.products.mo_01.f1', 'shop.products.mo_01.f2', 'shop.products.mo_01.f3', 'shop.products.mo_01.f4'],
    icon: 'DirectionsWalk',
    imageAltKey: 'shop.products.mo_01.alt',
  },
  {
    id: 'clenzy-sm-01',
    sku: 'CLENZY-SM-01',
    nameKey: 'shop.products.sm_01.name',
    shortDescriptionKey: 'shop.products.sm_01.short',
    descriptionKey: 'shop.products.sm_01.description',
    price: 2900,
    category: 'environment',
    protocol: 'wifi',
    featureKeys: ['shop.products.sm_01.f1', 'shop.products.sm_01.f2', 'shop.products.sm_01.f3', 'shop.products.sm_01.f4'],
    icon: 'SmokeFree',
    imageAltKey: 'shop.products.sm_01.alt',
  },
  {
    id: 'kit-essential',
    sku: 'KIT-ESSENTIAL',
    nameKey: 'shop.products.kit_essential.name',
    shortDescriptionKey: 'shop.products.kit_essential.short',
    descriptionKey: 'shop.products.kit_essential.description',
    price: 7900,
    originalPrice: 9300,
    category: 'kit',
    badge: 'bestseller',
    kitProductIds: ['clenzy-nm-01', 'clenzy-th-01', 'clenzy-dw-01', 'clenzy-dw-01'],
    featureKeys: [
      'shop.products.kit_essential.f1',
      'shop.products.kit_essential.f2',
      'shop.products.kit_essential.f3',
      'shop.products.kit_essential.f4',
    ],
    icon: 'Inventory2',
    imageAltKey: 'shop.products.kit_essential.alt',
  },
  {
    id: 'kit-security',
    sku: 'KIT-SECURITY',
    nameKey: 'shop.products.kit_security.name',
    shortDescriptionKey: 'shop.products.kit_security.short',
    descriptionKey: 'shop.products.kit_security.description',
    price: 16900,
    originalPrice: 18800,
    category: 'kit',
    badge: 'new',
    kitProductIds: ['clenzy-sl-01', 'clenzy-dw-01', 'clenzy-dw-01', 'clenzy-mo-01'],
    featureKeys: [
      'shop.products.kit_security.f1',
      'shop.products.kit_security.f2',
      'shop.products.kit_security.f3',
      'shop.products.kit_security.f4',
    ],
    icon: 'Security',
    imageAltKey: 'shop.products.kit_security.alt',
  },
  {
    id: 'kit-complete',
    sku: 'KIT-COMPLETE',
    nameKey: 'shop.products.kit_complete.name',
    shortDescriptionKey: 'shop.products.kit_complete.short',
    descriptionKey: 'shop.products.kit_complete.description',
    price: 25900,
    originalPrice: 31300,
    category: 'kit',
    badge: 'promo',
    kitProductIds: [
      'clenzy-nm-01',
      'clenzy-sl-01',
      'clenzy-th-01',
      'clenzy-dw-01',
      'clenzy-dw-01',
      'clenzy-mo-01',
      'clenzy-sm-01',
    ],
    featureKeys: [
      'shop.products.kit_complete.f1',
      'shop.products.kit_complete.f2',
      'shop.products.kit_complete.f3',
      'shop.products.kit_complete.f4',
      'shop.products.kit_complete.f5',
      'shop.products.kit_complete.f6',
      'shop.products.kit_complete.f7',
    ],
    icon: 'AllInclusive',
    imageAltKey: 'shop.products.kit_complete.alt',
  },
];

export const CATEGORIES = [
  { id: 'all', label: 'Tous les produits' },
  { id: 'kit', label: 'Kits' },
  { id: 'noise', label: 'Monitoring sonore' },
  { id: 'lock', label: 'Serrures' },
  { id: 'environment', label: 'Environnement' },
] as const;
