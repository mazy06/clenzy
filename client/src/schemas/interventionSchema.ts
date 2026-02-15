import { z } from 'zod/v4';

export const interventionSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional().default(''),
  type: z.string().min(1, "Le type d'intervention est requis"),
  status: z.string().min(1, 'Le statut est requis'),
  priority: z.string().min(1, 'La priorité est requise'),
  propertyId: z.number().min(1, 'La propriété est requise'),
  requestorId: z.number().min(1, 'Le demandeur est requis'),
  assignedToId: z.number().optional(),
  assignedToType: z.enum(['user', 'team']).optional(),
  scheduledDate: z.string().min(1, 'La date planifiée est requise'),
  estimatedDurationHours: z.number().min(0.5, 'Minimum 30 minutes').max(24, 'Maximum 24 heures'),
  estimatedCost: z.number().min(0, 'Doit être positif').optional(),
  notes: z.string().optional().default(''),
  photos: z.string().optional().default(''),
  progressPercentage: z.number().int().min(0).max(100).default(0),
});

export type InterventionFormValues = z.infer<typeof interventionSchema>;
