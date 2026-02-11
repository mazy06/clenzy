import { z } from 'zod/v4';

export const contactSchema = z.object({
  recipientId: z.string().min(1, 'Le destinataire est requis'),
  subject: z.string().min(1, 'Le sujet est requis'),
  message: z.string().min(1, 'Le message est requis'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  category: z.enum(['GENERAL', 'TECHNICAL', 'MAINTENANCE', 'CLEANING', 'EMERGENCY']).default('GENERAL'),
});

export type ContactFormValues = z.infer<typeof contactSchema>;
