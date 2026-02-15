import { z } from 'zod/v4';

export const propertySchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  address: z.string().min(1, "L'adresse est requise"),
  city: z.string().min(1, 'La ville est requise'),
  postalCode: z.string().min(1, 'Le code postal est requis'),
  country: z.string().min(1, 'Le pays est requis'),
  type: z.string().min(1, 'Le type est requis'),
  status: z.string().min(1, 'Le statut est requis'),
  bedroomCount: z.number().int().min(0, 'Doit être positif'),
  bathroomCount: z.number().int().min(0, 'Doit être positif'),
  squareMeters: z.number().min(0, 'Doit être positif'),
  nightlyPrice: z.number().min(0, 'Doit être positif'),
  description: z.string(),
  maxGuests: z.number().int().min(1, 'Au moins 1 invité'),
  cleaningFrequency: z.string(),
  ownerId: z.number().min(1, 'Le propriétaire est requis'),
  defaultCheckInTime: z.string().default('15:00'),
  defaultCheckOutTime: z.string().default('11:00'),
});

export type PropertyFormValues = z.infer<typeof propertySchema>;
