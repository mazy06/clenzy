import type { ComponentType, SVGProps } from 'react';
import {
  PropertyApartment,
  PropertyHouse,
  PropertyVilla,
  PropertyStudio,
  PropertyLoft,
  PropertyDuplex,
  PropertyTownhouse,
  PropertyBungalow,
  PropertyRiad,
  PropertyChalet,
  PropertyCottage,
  PropertyGuestRoom,
  PropertyBoat,
  PropertyOther,
} from '../icons';

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>;

/**
 * Icone par type de logement — pour les surfaces trop etroites pour un libelle
 * (colonne logements repliee du planning). Une forme distincte par type : c'est
 * elle qui porte l'information, pas la couleur.
 *
 * Miroir de `PROPERTY_TYPES` (`utils/statusUtils.ts`) : ajouter un type la-bas,
 * c'est ajouter une entree ici — sinon il retombe sur l'icone generique.
 */
const PROPERTY_TYPE_ICONS: Record<string, IconComponent> = {
  APARTMENT: PropertyApartment,
  HOUSE: PropertyHouse,
  VILLA: PropertyVilla,
  STUDIO: PropertyStudio,
  LOFT: PropertyLoft,
  DUPLEX: PropertyDuplex,
  TOWNHOUSE: PropertyTownhouse,
  BUNGALOW: PropertyBungalow,
  RIAD: PropertyRiad,
  CHALET: PropertyChalet,
  COTTAGE: PropertyCottage,
  GUEST_ROOM: PropertyGuestRoom,
  BOAT: PropertyBoat,
  OTHER: PropertyOther,
  // Alias FR : donnees historiques en base, comme dans `PROPERTY_TYPE_HEX`.
  APPARTEMENT: PropertyApartment,
  MAISON: PropertyHouse,
};

export function getPropertyTypeIcon(type?: string): IconComponent {
  return PROPERTY_TYPE_ICONS[type?.toUpperCase() ?? ''] ?? PropertyOther;
}
