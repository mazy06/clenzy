import { z } from 'zod/v4';

export const teamMemberSchema = z.object({
  userId: z.number().min(1, "L'utilisateur est requis"),
  firstName: z.string().optional().default(''),
  lastName: z.string().optional().default(''),
  email: z.string().optional().default(''),
  role: z.string().min(1, 'Le rôle est requis'),
});

export const coverageZoneSchema = z.object({
  department: z.string().min(1, 'Le departement est requis'),
  arrondissement: z.string().optional().nullable(),
});

export const teamSchema = z.object({
  name: z.string().min(1, "Le nom de l'équipe est requis"),
  description: z.string().optional().default(''),
  interventionType: z.string().min(1, "Le type d'intervention est requis"),
  members: z.array(teamMemberSchema).min(1, 'Au moins un membre est requis'),
  coverageZones: z.array(coverageZoneSchema).optional().default([]),
});

export type TeamFormValues = z.infer<typeof teamSchema>;
export type TeamFormInput = z.input<typeof teamSchema>;
export type TeamMemberValues = z.infer<typeof teamMemberSchema>;
export type TeamMemberInput = z.input<typeof teamMemberSchema>;
