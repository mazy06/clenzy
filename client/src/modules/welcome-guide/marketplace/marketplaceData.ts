import { Sailboat, Sunrise, Wine, ChefHat, Landmark, Tent, Bike, type LucideIcon } from 'lucide-react';

/**
 * Données de la « Marketplace partenaire ». FIXTURES DE DÉMO — à remplacer par le flux réel de l'API marketplace
 * (aucun connecteur browse back pour l'instant). Reprises du prototype / SPEC §8.
 */
export type PartnerName = 'GetYourGuide' | 'Viator' | 'Klook' | 'Partenaire local';

export interface MarketplaceExperience {
  id: string;
  partner: PartnerName;
  title: string;
  desc: string;        // une ligne (tronquée en grille/liste)
  price: number;       // € par personne
  commission: number;  // taux en %
  rating: number;
  reviews: number;
  duration: string;
  category: string;
  language: string;
  group: string;
  cancel: string;
  long: string;        // description longue (détail)
  includes: string[];  // « ce qui est inclus »
  icon: LucideIcon;    // icône de catégorie pour le placeholder (en attendant imageUrl)
  imageUrl?: string;
}

/** Couleur FIXE par partenaire (point du badge + teinte de vignette à 12 %). Repères visuels, pas les logos. */
export const PARTNER_COLOR: Record<PartnerName, string> = {
  GetYourGuide: '#FF5A3C',
  Viator: '#2F9C6A',
  Klook: '#E1571F',
  'Partenaire local': '#6C5CE7',
};
export const PARTNERS: PartnerName[] = ['GetYourGuide', 'Viator', 'Klook', 'Partenaire local'];

export const MARKETPLACE_EXPERIENCES: MarketplaceExperience[] = [
  {
    id: 'gyg-sunset', partner: 'GetYourGuide', title: 'Croisière au coucher du soleil',
    desc: "Une vue imprenable depuis l'eau, en fin de journée.", price: 39, commission: 12,
    rating: 4.8, reviews: 312, duration: '2 h', category: 'Plein air', language: 'FR · EN',
    group: "Jusqu'à 8 pers.", cancel: "Gratuite jusqu'à 24 h avant",
    long: "Embarquez pour une croisière au coucher du soleil le long de la côte. Boissons à bord, skipper professionnel et lumière dorée garantie pour une fin de journée mémorable.",
    includes: ['Skipper professionnel', 'Boissons & en-cas', 'Gilets de sauvetage', 'Photos souvenir'],
    icon: Sailboat,
  },
  {
    id: 'gyg-balloon', partner: 'GetYourGuide', title: "Montgolfière à l'aube",
    desc: 'Survol panoramique au lever du soleil.', price: 120, commission: 14,
    rating: 4.9, reviews: 187, duration: '3 h', category: 'Aventure', language: 'FR · EN',
    group: "Jusqu'à 6 pers.", cancel: "Gratuite jusqu'à 48 h avant",
    long: "Décollez à l'aube pour un vol en montgolfière au-dessus des paysages, suivi d'un toast au champagne à l'atterrissage. Une expérience unique, hors du temps.",
    includes: ['Vol de 45 min', 'Toast au champagne', 'Transfert aller-retour', 'Certificat de vol'],
    icon: Sunrise,
  },
  {
    id: 'via-tasting', partner: 'Viator', title: 'Dégustation de spécialités locales',
    desc: 'Vins, fromages et produits du terroir, commentés.', price: 45, commission: 15,
    rating: 4.7, reviews: 241, duration: '2 h', category: 'Gastronomie', language: 'FR',
    group: "Jusqu'à 12 pers.", cancel: "Gratuite jusqu'à 24 h avant",
    long: "Un parcours gourmand commenté par un sommelier : vins de la région, fromages affinés et spécialités du terroir, dans une cave authentique du centre historique.",
    includes: ['5 vins dégustés', 'Plateau de fromages', 'Sommelier dédié', 'Livret de dégustation'],
    icon: Wine,
  },
  {
    id: 'via-cooking', partner: 'Viator', title: 'Atelier cuisine du marché',
    desc: 'Marché puis cuisine avec un chef local.', price: 65, commission: 15,
    rating: 4.9, reviews: 156, duration: '4 h', category: 'Gastronomie', language: 'FR · EN',
    group: "Jusqu'à 8 pers.", cancel: "Gratuite jusqu'à 48 h avant",
    long: "Visite du marché avec un chef pour choisir les produits, puis atelier de cuisine et dégustation du repas préparé ensemble. Recettes à emporter.",
    includes: ['Visite de marché guidée', 'Atelier avec un chef', 'Repas complet', 'Recettes à emporter'],
    icon: ChefHat,
  },
  {
    id: 'klk-medina', partner: 'Klook', title: 'Visite guidée de la médina',
    desc: 'Ruelles, artisans et histoire de la vieille ville.', price: 29, commission: 10,
    rating: 4.6, reviews: 423, duration: '3 h', category: 'Culture', language: 'FR · EN · ES',
    group: "Jusqu'à 15 pers.", cancel: "Gratuite jusqu'à 24 h avant",
    long: "Plongez dans la médina avec un guide local : souks, ateliers d'artisans, monuments et anecdotes historiques pour comprendre l'âme de la vieille ville.",
    includes: ['Guide local certifié', 'Entrées aux monuments', 'Thé à la menthe', 'Carte de la médina'],
    icon: Landmark,
  },
  {
    id: 'klk-desert', partner: 'Klook', title: 'Excursion désert & dunes',
    desc: 'Journée 4×4, dunes et coucher de soleil.', price: 95, commission: 11,
    rating: 4.8, reviews: 298, duration: '8 h', category: 'Aventure', language: 'FR · EN',
    group: "Jusqu'à 6 pers.", cancel: "Gratuite jusqu'à 72 h avant",
    long: "Une journée complète en 4×4 vers les dunes : balade à dos de dromadaire, déjeuner traditionnel et coucher de soleil sur le désert. Retour en soirée.",
    includes: ['Transport 4×4', 'Balade à dromadaire', 'Déjeuner traditionnel', 'Guide expérimenté'],
    icon: Tent,
  },
  {
    id: 'local-ebike', partner: 'Partenaire local', title: 'Balade en vélo électrique',
    desc: 'Itinéraire panoramique à vélo assisté.', price: 35, commission: 8,
    rating: 4.9, reviews: 64, duration: '2 h', category: 'Plein air', language: 'FR',
    group: "Jusqu'à 10 pers.", cancel: "Gratuite jusqu'à 12 h avant",
    long: "Un circuit panoramique en vélo électrique encadré par un accompagnateur local : points de vue, pauses photo et bonnes adresses, sans effort.",
    includes: ['Vélo électrique', 'Casque & antivol', 'Accompagnateur local', 'Pause rafraîchissement'],
    icon: Bike,
  },
];

/** Compte par partenaire (pour les compteurs des pastilles). */
export function countByPartner(items: MarketplaceExperience[]): Record<PartnerName, number> {
  const c: Record<PartnerName, number> = { GetYourGuide: 0, Viator: 0, Klook: 0, 'Partenaire local': 0 };
  for (const e of items) c[e.partner] += 1;
  return c;
}
