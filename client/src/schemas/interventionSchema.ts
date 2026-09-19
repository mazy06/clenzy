import { z } from 'zod/v4';
import { vm } from './validationMessage';

export const interventionSchemaFor = (propertyRequired = true) => z.object({
  title: z.string().min(1, vm('validation.titleRequired', 'Le titre est requis')),
  description: z.string().optional().default(''),
  serviceItemCode: z.string().optional(),
  type: z.string().min(1, vm('validation.interventionTypeRequired', "Le type d'intervention est requis")),
  status: z.string().min(1, vm('validation.statusRequired', 'Le statut est requis')),
  priority: z.string().min(1, vm('validation.priorityRequired', 'La priorité est requise')),
  propertyId: z.number().min(propertyRequired ? 1 : 0, vm('validation.propertyRequired', 'La propriété est requise')),
  requestorId: z.number().min(1, vm('validation.requestorRequired', 'Le demandeur est requis')),
  assignedToId: z.number().optional(),
  assignedToType: z.enum(['user', 'team']).optional(),
  scheduledDate: z.string().min(1, vm('validation.scheduledDateRequired', 'La date planifiée est requise')),
  estimatedDurationHours: z.number().min(0.5, vm('validation.minThirtyMinutes', 'Minimum 30 minutes')).max(24, vm('validation.maxTwentyFourHours', 'Maximum 24 heures')),
  estimatedCost: z.number().min(0, vm('validation.mustBePositive', 'Doit être positif')).optional(),
  notes: z.string().optional().default(''),
  photos: z.string().optional().default(''),
  progressPercentage: z.number().int().min(0).max(100).default(0),
});

export const interventionSchema = interventionSchemaFor();

export type InterventionFormValues = z.infer<typeof interventionSchema>;
