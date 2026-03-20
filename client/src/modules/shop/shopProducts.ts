export type ProductCategory = 'noise' | 'lock' | 'environment' | 'kit';
export type Protocol = 'wifi' | 'zigbee' | 'both';

export interface ShopProduct {
  id: string;
  sku: string;
  name: string;
  shortDescription: string;
  description: string;
  price: number; // in cents
  originalPrice?: number; // for kits showing savings
  category: ProductCategory;
  features: string[];
  protocol?: Protocol;
  badge?: 'new' | 'bestseller' | 'promo';
  kitProductIds?: string[]; // for kit products
  icon: string; // MUI icon name
}

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    id: 'clenzy-nm-01',
    sku: 'CLENZY-NM-01',
    name: 'Capteur Bruit 5-in-1',
    shortDescription: 'Bruit + Température + Humidité + Horloge',
    description:
      "Capteur mural WiFi mesurant le niveau sonore (30-130 dBA), la température, l'humidité avec écran LED et horloge intégrée.",
    price: 4900,
    category: 'noise',
    protocol: 'wifi',
    badge: 'bestseller',
    features: [
      'Mesure sonore 30-130 dBA',
      'Température + Humidité',
      'Écran LED',
      'WiFi 2.4GHz',
      'Alertes temps réel',
      'Intégration Clenzy native',
    ],
    icon: 'VolumeUp',
  },
  {
    id: 'clenzy-sl-01',
    sku: 'CLENZY-SL-01',
    name: 'Serrure Connectée',
    shortDescription: 'Code + Empreinte + RFID + App',
    description:
      'Serrure intelligente avec code temporaire par guest, empreinte digitale, carte RFID et contrôle via application.',
    price: 14900,
    category: 'lock',
    protocol: 'both',
    badge: 'new',
    features: [
      'Code temporaire par guest',
      'Empreinte digitale',
      'Carte RFID',
      'Contrôle via App',
      'WiFi + Zigbee 3.0',
      "Historique d'accès",
    ],
    icon: 'Lock',
  },
  {
    id: 'clenzy-th-01',
    sku: 'CLENZY-TH-01',
    name: 'Capteur Temp/Humidité',
    shortDescription: 'Température + Humidité avec écran LCD',
    description:
      'Capteur compact avec écran LCD affichant température et humidité en temps réel.',
    price: 1900,
    category: 'environment',
    protocol: 'zigbee',
    features: ['Précision ±0.3°C', 'Écran LCD', 'Zigbee 3.0', 'Batterie 1 an+', 'Compact'],
    icon: 'Thermostat',
  },
  {
    id: 'clenzy-dw-01',
    sku: 'CLENZY-DW-01',
    name: 'Capteur Porte/Fenêtre',
    shortDescription: 'Détection ouverture/fermeture',
    description:
      'Capteur magnétique pour portes et fenêtres avec alertes en temps réel.',
    price: 1200,
    category: 'environment',
    protocol: 'zigbee',
    features: [
      'Détection ouverture/fermeture',
      'Zigbee 3.0',
      'Batterie longue durée',
      'Installation facile',
    ],
    icon: 'SensorDoor',
  },
  {
    id: 'clenzy-mo-01',
    sku: 'CLENZY-MO-01',
    name: 'Capteur Mouvement',
    shortDescription: 'Détection mouvement/occupation PIR',
    description:
      "Capteur de mouvement PIR pour détecter la présence et l'occupation des pièces.",
    price: 1500,
    category: 'environment',
    protocol: 'zigbee',
    features: ['Détection PIR', 'Occupation intelligente', 'Zigbee 3.0', 'Batterie longue durée'],
    icon: 'DirectionsWalk',
  },
  {
    id: 'clenzy-sm-01',
    sku: 'CLENZY-SM-01',
    name: 'Détecteur Fumée/Vape',
    shortDescription: 'Détection fumée cigarette et vape',
    description:
      'Détecteur de fumée et de vapeur pour alerter en cas de tabagisme dans le logement.',
    price: 2900,
    category: 'environment',
    protocol: 'wifi',
    features: ['Détection fumée', 'Détection vape', 'WiFi 2.4GHz', 'Alertes instantanées'],
    icon: 'SmokeFree',
  },
  {
    id: 'kit-essential',
    sku: 'KIT-ESSENTIAL',
    name: 'Kit Essentiel',
    shortDescription: 'Monitoring sonore + environnement de base',
    description:
      'Le kit parfait pour démarrer : capteur bruit, température/humidité et 2 capteurs porte/fenêtre.',
    price: 7900,
    originalPrice: 9300,
    category: 'kit',
    badge: 'bestseller',
    kitProductIds: ['clenzy-nm-01', 'clenzy-th-01', 'clenzy-dw-01', 'clenzy-dw-01'],
    features: [
      'Capteur Bruit 5-in-1',
      'Capteur Temp/Humidité',
      '2× Capteur Porte/Fenêtre',
      'Économie de 15%',
    ],
    icon: 'Inventory2',
  },
  {
    id: 'kit-security',
    sku: 'KIT-SECURITY',
    name: 'Kit Sécurité',
    shortDescription: 'Serrure + capteurs accès',
    description:
      'Kit sécurité complet avec serrure connectée, capteurs porte/fenêtre et détection de mouvement.',
    price: 16900,
    originalPrice: 18800,
    category: 'kit',
    badge: 'new',
    kitProductIds: ['clenzy-sl-01', 'clenzy-dw-01', 'clenzy-dw-01', 'clenzy-mo-01'],
    features: [
      'Serrure Connectée',
      '2× Capteur Porte/Fenêtre',
      'Capteur Mouvement',
      'Économie de 10%',
    ],
    icon: 'Security',
  },
  {
    id: 'kit-complete',
    sku: 'KIT-COMPLETE',
    name: 'Kit Complet',
    shortDescription: 'Tous les capteurs pour une propriété',
    description:
      "L'équipement complet pour une propriété : monitoring sonore, serrure connectée, tous les capteurs environnementaux et détection fumée.",
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
    features: [
      'Capteur Bruit 5-in-1',
      'Serrure Connectée',
      'Capteur Temp/Humidité',
      '2× Capteur Porte/Fenêtre',
      'Capteur Mouvement',
      'Détecteur Fumée',
      'Économie de 17%',
    ],
    icon: 'AllInclusive',
  },
];

export const CATEGORIES = [
  { id: 'all', label: 'Tous les produits' },
  { id: 'kit', label: 'Kits' },
  { id: 'noise', label: 'Monitoring sonore' },
  { id: 'lock', label: 'Serrures' },
  { id: 'environment', label: 'Environnement' },
] as const;
