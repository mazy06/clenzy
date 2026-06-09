import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { PropertyDetails } from './PropertyCard';

/**
 * Convertit un élément de liste (PropertyListItem) au format attendu par PropertyCard
 * et les estimateurs de ménage (PropertyDetails). Mapping pur, sans effet de bord.
 */
export function toPropertyDetails(property: PropertyListItem): PropertyDetails {
  return {
    id: property.id,
    name: property.name,
    address: property.address,
    city: property.city,
    postalCode: property.postalCode || '',
    country: property.country || '',
    propertyType: property.type,
    status: property.status,
    nightlyPrice: property.nightlyPrice,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    surfaceArea: property.squareMeters || 0,
    description: property.description || '',
    amenities: property.amenities || [],
    cleaningFrequency: property.cleaningFrequency || 'ON_DEMAND',
    maxGuests: property.guests,
    contactPhone: property.contactPhone || '',
    contactEmail: property.contactEmail || '',
    lastCleaning: property.lastCleaning,
    nextCleaning: property.nextCleaning,
    ownerId: property.ownerId,
    createdAt: property.createdAt,
    cleaningBasePrice: property.cleaningBasePrice,
    numberOfFloors: property.numberOfFloors,
    hasExterior: property.hasExterior,
    hasLaundry: property.hasLaundry,
    defaultCheckInTime: property.defaultCheckInTime,
    defaultCheckOutTime: property.defaultCheckOutTime,
  };
}
