import { z } from 'zod/v4';
import { vm } from './validationMessage';

export const propertySchema = z.object({
  name: z.string().min(1, vm('validation.nameRequired', 'Le nom est requis')).max(100, vm('validation.nameTooLong', 'Le nom ne peut pas dépasser 100 caractères')),
  address: z.string().min(1, vm('validation.addressRequired', "L'adresse est requise")),
  city: z.string().min(1, vm('validation.cityRequired', 'La ville est requise')),
  postalCode: z.string().min(1, vm('validation.postalCodeRequired', 'Le code postal est requis')),
  country: z.string().min(1, vm('validation.countryRequired', 'Le pays est requis')),
  countryCode: z.string().length(2, vm('validation.countryCodeIso2', 'Code pays ISO sur 2 lettres requis')).default('FR'),
  timezone: z.string().default('Europe/Paris'),
  defaultCleaningType: z.enum(['CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING']).default('CLEANING'),
  type: z.string().min(1, vm('validation.typeRequired', 'Le type est requis')),
  status: z.string().min(1, vm('validation.statusRequired', 'Le statut est requis')),
  bedroomCount: z.number().int().min(0, vm('validation.mustBePositive', 'Doit être positif')),
  bathroomCount: z.number().int().min(0, vm('validation.mustBePositive', 'Doit être positif')),
  squareMeters: z.number().min(0, vm('validation.mustBePositive', 'Doit être positif')),
  nightlyPrice: z.number().min(0, vm('validation.mustBePositive', 'Doit être positif')),
  minimumNights: z.number().int().min(1, vm('validation.atLeastOneNight', 'Au moins 1 nuit')),
  description: z.string(),
  maxGuests: z.number().int().min(1, vm('validation.atLeastOneGuest', 'Au moins 1 invité')),
  cleaningFrequency: z.string(),
  ownerId: z.number().min(1, vm('validation.ownerRequired', 'Le propriétaire est requis')),
  defaultCheckInTime: z.string().default('15:00'),
  defaultCheckOutTime: z.string().default('11:00'),
  // Tarification ménage
  cleaningBasePrice: z.number().min(0, vm('validation.mustBePositive', 'Doit être positif')).optional(),
  numberOfFloors: z.number().int().min(0, vm('validation.mustBePositive', 'Doit être positif')).optional(),
  hasExterior: z.boolean().default(false),
  hasLaundry: z.boolean().default(true),
  // Prestations à la carte
  windowCount: z.number().int().min(0).default(0),
  frenchDoorCount: z.number().int().min(0).default(0),
  slidingDoorCount: z.number().int().min(0).default(0),
  hasIroning: z.boolean().default(false),
  hasDeepKitchen: z.boolean().default(false),
  hasDisinfection: z.boolean().default(false),
  // Équipements
  amenities: z.array(z.string()).default([]),
  cleaningNotes: z.string().optional(),
  // Booking Engine
  bookingEngineVisible: z.boolean().default(false),
  // Voucher consent : autorise l'org gestionnaire (conciergerie) a creer des
  // BookingVoucher sur ce logement. Combine cote backend avec
  // organization.has_voucher_contract. Default false (host garde le controle).
  orgCanCreateVouchers: z.boolean().default(false),
  // Geolocalisation
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  department: z.string().optional().nullable(),
  arrondissement: z.string().optional().nullable(),
});

export type PropertyFormValues = z.infer<typeof propertySchema>;
