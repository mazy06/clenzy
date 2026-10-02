import { z } from 'zod/v4';
import { vm } from './validationMessage';
import i18n from '../i18n/config';

/** Message traduit à l'instant de la validation (superRefine attend une chaîne). */
const msg = (key: string, fallback: string): string => i18n.t(key, fallback) as string;

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
  // Taxe de séjour déclarée à la CRÉATION (France, Maroc) : le référentiel suggère,
  // l'utilisateur saisit et confirme le montant appliqué. `touristTaxRequired` n'est
  // posé qu'en création (formulaire uniquement, jamais envoyé tel quel).
  touristTaxRequired: z.boolean().optional(),
  touristTaxNoTax: z.boolean().default(false),
  touristTaxMode: z.enum(['PER_PERSON_PER_NIGHT', 'PERCENTAGE_OF_RATE', 'FLAT_PER_NIGHT']).default('PER_PERSON_PER_NIGHT'),
  touristTaxRate: z.number().min(0).optional().nullable(),
  /** Saisi en % (0–100), envoyé en fraction. */
  touristTaxPercent: z.number().min(0).max(100).optional().nullable(),
  touristTaxCap: z.number().min(0).optional().nullable(),
  touristTaxDepartmentalPct: z.number().min(0).optional().nullable(),
  touristTaxRegionalPct: z.number().min(0).optional().nullable(),
  touristTaxChildrenExemptUnder: z.number().int().min(0).max(25).optional().nullable(),
  touristTaxConfirmed: z.boolean().default(false),
}).superRefine((v, ctx) => {
  const country = (v.countryCode || '').toUpperCase();
  if (!v.touristTaxRequired || (country !== 'FR' && country !== 'MA')) return;
  if (!v.touristTaxNoTax) {
    if (v.touristTaxMode === 'PERCENTAGE_OF_RATE') {
      if (!(v.touristTaxPercent && v.touristTaxPercent > 0)) {
        ctx.addIssue({ code: 'custom', path: ['touristTaxPercent'],
          message: msg('validation.touristTaxPercentRequired', 'Pourcentage requis') });
      }
      if (!(v.touristTaxCap && v.touristTaxCap > 0)) {
        ctx.addIssue({ code: 'custom', path: ['touristTaxCap'],
          message: msg('validation.touristTaxCapRequired', 'Plafond par personne et par nuit requis') });
      }
    } else if (!(v.touristTaxRate && v.touristTaxRate > 0)) {
      ctx.addIssue({ code: 'custom', path: ['touristTaxRate'],
        message: msg('validation.touristTaxRateRequired', 'Montant de la taxe de séjour requis') });
    }
  }
  if (!v.touristTaxConfirmed) {
    ctx.addIssue({ code: 'custom', path: ['touristTaxConfirmed'],
      message: msg('validation.touristTaxConfirmRequired', 'Confirmez le montant de la taxe de séjour') });
  }
});

export type PropertyFormValues = z.infer<typeof propertySchema>;
