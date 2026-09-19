import { z } from 'zod/v4';
import { vm } from './validationMessage';
import i18n from '../i18n/config';

export const teamMemberSchema = z.object({
  userId: z.number().min(1, vm('validation.userRequired', "L'utilisateur est requis")),
  firstName: z.string().optional().default(''),
  lastName: z.string().optional().default(''),
  email: z.string().optional().default(''),
  role: z.string().min(1, vm('validation.roleRequired', 'Le rôle est requis')),
});

export const coverageZoneSchema = z.object({
  country: z.string().min(2, vm('validation.countryRequired', 'Le pays est requis')).default('FR'),
  department: z.string().optional().nullable(),
  arrondissement: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
}).refine(
  (zone) => {
    if (zone.country === 'FR') {
      return !!zone.department && zone.department.length > 0;
    }
    return !!zone.city && zone.city.length > 0;
  },
  {
    error: () => i18n.t('validation.zoneScopeRequired', "Selectionnez un departement (France) ou une ville (autres pays)") as string,
    path: ['department'],
  },
);

export const teamSchema = z.object({
  name: z.string().min(1, vm('validation.teamNameRequired', "Le nom de l'équipe est requis")),
  description: z.string().optional().default(''),
  interventionType: z.string().min(1, vm('validation.interventionTypeRequired', "Le type d'intervention est requis")),
  serviceItemCodes: z.array(z.string()).default([]),
  members: z.array(teamMemberSchema).min(1, vm('validation.atLeastOneMember', 'Au moins un membre est requis')),
  coverageZones: z.array(coverageZoneSchema).optional().default([]),
});

export type TeamFormValues = z.infer<typeof teamSchema>;
export type TeamFormInput = z.input<typeof teamSchema>;
export type TeamMemberValues = z.infer<typeof teamMemberSchema>;
export type TeamMemberInput = z.input<typeof teamMemberSchema>;
