import { z } from 'zod/v4';

/** Ligne de devis (maintenance) : total ligne = quantity × unitPrice. */
export const quoteLineSchema = z.object({
  label: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  /** Type de prestation catalogue (matching technicien + application des tarifs). */
  interventionType: z.string().optional(),
});

export const serviceRequestSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string(),
  propertyId: z.number().min(1, 'La propriété est requise'),
  serviceType: z.string().min(1, 'Le type de service est requis'),
  priority: z.string().min(1, 'La priorité est requise'),
  estimatedDurationHours: z.number().min(0, 'Doit être positif'),
  desiredDate: z.string().min(1, 'La date souhaitée est requise'),
  userId: z.number().optional(),
  assignedToId: z.number().optional(),
  assignedToType: z.enum(['user', 'team']).optional(),
  status: z.string().optional(),
  /** Montant estimé (maintenance : total du devis ou diagnostic ; recalculé serveur). */
  estimatedCost: z.number().optional(),
  /** Devis structuré (maintenance, mode devis direct). */
  quoteLines: z.array(quoteLineSchema).optional(),
  /** Mode de chiffrage maintenance : devis direct ou diagnostic préalable. */
  pricingMode: z.enum(['DIRECT', 'DIAGNOSTIC']).optional(),
  /** Montant du diagnostic (mode diagnostic : facturé d'abord). */
  diagnosticFee: z.number().optional(),
});

export type QuoteLine = z.infer<typeof quoteLineSchema>;

export type ServiceRequestFormValues = z.infer<typeof serviceRequestSchema>;
