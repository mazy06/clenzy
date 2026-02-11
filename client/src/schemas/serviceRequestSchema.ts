import { z } from 'zod/v4';

export const serviceRequestSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().min(1, 'La description est requise'),
  propertyId: z.number().min(1, 'La propriété est requise'),
  serviceType: z.string().min(1, 'Le type de service est requis'),
  priority: z.string().min(1, 'La priorité est requise'),
  estimatedDurationHours: z.number().min(0, 'Doit être positif'),
  desiredDate: z.string().min(1, 'La date souhaitée est requise'),
  userId: z.number().optional(),
  assignedToId: z.number().optional(),
  assignedToType: z.enum(['user', 'team']).optional(),
  status: z.string().optional(),
});

export type ServiceRequestFormValues = z.infer<typeof serviceRequestSchema>;
