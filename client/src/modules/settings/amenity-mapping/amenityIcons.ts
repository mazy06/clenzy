/**
 * Catalogue d'icones pour les commodites Clenzy.
 *
 * Source : lucide-react (1400+ icones disponibles). On expose ici un sous-ensemble
 * curate pertinent pour les amenities, groupe par theme pour que le picker reste
 * navigable (50-80 icones, pas 1400).
 *
 * Le mapping par defaut (DEFAULT_AMENITY_ICONS) associe chaque commodite built-in
 * a une icone par defaut. L'utilisateur peut override via le picker — le choix
 * est persiste en localStorage cle par organisation (cf. useAmenityIconOverrides).
 *
 * Pour ajouter une icone : importer depuis 'lucide-react' et l'ajouter dans
 * la categorie appropriee de ICON_CATALOG ci-dessous.
 */

import {
  // Comfort / climate
  Wifi,
  WifiHigh,
  WifiOff,
  Tv,
  Tv2,
  Snowflake,
  Flame,
  Wind,
  Sun,
  Thermometer,
  Lightbulb,
  Lamp,
  Sofa,
  Armchair,
  Bed,
  BedDouble,
  BedSingle,
  // Kitchen
  ChefHat,
  UtensilsCrossed,
  Utensils,
  Refrigerator,
  Microwave,
  Coffee,
  Wine,
  Soup,
  Pizza,
  // Bath / laundry
  Bath,
  ShowerHead,
  Droplets,
  WashingMachine,
  Shirt,
  // Outdoor
  Trees,
  TreePine,
  Flower,
  Flower2,
  Waves,
  Mountain,
  Tent,
  Umbrella,
  // Mobility / parking
  Car,
  CarFront,
  Bike,
  ParkingCircle,
  // Safety / family
  Lock,
  KeyRound,
  Shield,
  ShieldCheck,
  Baby,
  Cigarette,
  CigaretteOff,
  PawPrint,
  AlertTriangle,
  Camera,
  // Tech / entertainment
  Speaker,
  Music,
  Gamepad2,
  Smartphone,
  Tablet,
  Laptop,
  Headphones,
  Printer,
  Router,
  // Wellness / fitness
  Dumbbell,
  Heart,
  HeartHandshake,
  // Misc / generic
  Home,
  Building,
  Building2,
  Sparkles,
  Star,
  Package,
  Briefcase,
  CalendarDays,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

/** Map nom → composant React, pour resoudre dynamiquement une icone par son nom. */
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  Wifi, WifiHigh, WifiOff, Tv, Tv2, Snowflake, Flame, Wind, Sun, Thermometer,
  Lightbulb, Lamp, Sofa, Armchair, Bed, BedDouble, BedSingle,
  ChefHat, UtensilsCrossed, Utensils, Refrigerator, Microwave, Coffee, Wine, Soup, Pizza,
  Bath, ShowerHead, Droplets, WashingMachine, Shirt,
  Trees, TreePine, Flower, Flower2, Waves, Mountain, Tent, Umbrella,
  Car, CarFront, Bike, ParkingCircle,
  Lock, KeyRound, Shield, ShieldCheck, Baby, Cigarette, CigaretteOff, PawPrint, AlertTriangle, Camera,
  Speaker, Music, Gamepad2, Smartphone, Tablet, Laptop, Headphones, Printer, Router,
  Dumbbell, Heart, HeartHandshake,
  Home, Building, Building2, Sparkles, Star, Package, Briefcase, CalendarDays, MapPin,
};

/**
 * Catalogue d'icones pour le picker, groupe par theme.
 * L'ordre des groupes et des icones dans chaque groupe = ordre d'affichage.
 */
export interface IconGroup {
  id: string;
  label: string;
  icons: string[];
}

export const ICON_CATALOG: IconGroup[] = [
  {
    id: 'comfort',
    label: 'Confort & climat',
    icons: ['Wifi', 'WifiHigh', 'Tv', 'Tv2', 'Snowflake', 'Flame', 'Wind', 'Sun', 'Thermometer', 'Lightbulb', 'Lamp'],
  },
  {
    id: 'furniture',
    label: 'Mobilier & literie',
    icons: ['Sofa', 'Armchair', 'Bed', 'BedDouble', 'BedSingle'],
  },
  {
    id: 'kitchen',
    label: 'Cuisine',
    icons: ['ChefHat', 'UtensilsCrossed', 'Utensils', 'Refrigerator', 'Microwave', 'Coffee', 'Wine', 'Soup', 'Pizza'],
  },
  {
    id: 'bath',
    label: 'Salle de bain & linge',
    icons: ['Bath', 'ShowerHead', 'Droplets', 'WashingMachine', 'Shirt'],
  },
  {
    id: 'outdoor',
    label: 'Extérieur',
    icons: ['Trees', 'TreePine', 'Flower', 'Flower2', 'Waves', 'Mountain', 'Tent', 'Umbrella'],
  },
  {
    id: 'mobility',
    label: 'Mobilité & parking',
    icons: ['Car', 'CarFront', 'Bike', 'ParkingCircle'],
  },
  {
    id: 'safety',
    label: 'Sécurité & famille',
    icons: ['Lock', 'KeyRound', 'Shield', 'ShieldCheck', 'Baby', 'Cigarette', 'CigaretteOff', 'PawPrint', 'AlertTriangle', 'Camera'],
  },
  {
    id: 'tech',
    label: 'Tech & divertissement',
    icons: ['Speaker', 'Music', 'Gamepad2', 'Smartphone', 'Tablet', 'Laptop', 'Headphones', 'Printer', 'Router'],
  },
  {
    id: 'wellness',
    label: 'Bien-être',
    icons: ['Dumbbell', 'Heart', 'HeartHandshake'],
  },
  {
    id: 'misc',
    label: 'Divers',
    icons: ['Home', 'Building', 'Building2', 'Sparkles', 'Star', 'Package', 'Briefcase', 'CalendarDays', 'MapPin'],
  },
];

/**
 * Icone par defaut pour chaque commodite built-in Clenzy.
 * Si une commodite custom n'a pas d'override, on retombe sur 'Sparkles'.
 */
export const DEFAULT_AMENITY_ICONS: Record<string, string> = {
  WIFI: 'Wifi',
  TV: 'Tv',
  AIR_CONDITIONING: 'Snowflake',
  HEATING: 'Flame',
  EQUIPPED_KITCHEN: 'ChefHat',
  DISHWASHER: 'Soup',
  MICROWAVE: 'Microwave',
  OVEN: 'Flame',
  WASHING_MACHINE: 'WashingMachine',
  DRYER: 'Wind',
  IRON: 'Shirt',
  HAIR_DRYER: 'Wind',
  PARKING: 'Car',
  POOL: 'Waves',
  JACUZZI: 'Droplets',
  GARDEN_TERRACE: 'Trees',
  BARBECUE: 'Flame',
  SAFE: 'Lock',
  BABY_BED: 'Baby',
  HIGH_CHAIR: 'Baby',
};

/**
 * Resout le composant icone pour une commodite (avec fallback Sparkles si nom
 * inconnu — robustesse en cas de renommage lucide ou override invalide).
 */
export function resolveAmenityIcon(code: string, overrides?: Record<string, string>): LucideIcon {
  const name = overrides?.[code] ?? DEFAULT_AMENITY_ICONS[code] ?? 'Sparkles';
  return ICON_REGISTRY[name] ?? Sparkles;
}

/**
 * Retourne le nom (string) de l'icone actuellement assignee a une commodite.
 * Utile pour pre-selectionner l'icone courante dans le picker.
 */
export function getCurrentIconName(code: string, overrides?: Record<string, string>): string {
  return overrides?.[code] ?? DEFAULT_AMENITY_ICONS[code] ?? 'Sparkles';
}
