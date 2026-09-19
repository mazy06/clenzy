import { z } from 'zod/v4';
import { vm } from './validationMessage';
import i18n from '../i18n/config';

export const userSchema = z.object({
  firstName: z.string().min(1, vm('validation.firstNameRequired', 'Le prénom est requis')),
  lastName: z.string().min(1, vm('validation.nameRequired', 'Le nom est requis')),
  email: z.string().min(1, vm('validation.emailRequired', "L'email est requis")).email(vm('validation.emailInvalid', 'Format email invalide')),
  phoneNumber: z.string().optional().default(''),
  password: z.string().min(8, vm('validation.passwordMinLength', 'Le mot de passe doit contenir au moins 8 caractères')),
  confirmPassword: z.string().min(1, vm('validation.confirmationRequired', 'Confirmation requise')),
  role: z.string().min(1, vm('validation.roleRequired', 'Le rôle est requis')),
  status: z.string().min(1, vm('validation.statusRequired', 'Le statut est requis')),
  organizationId: z.string().optional().default(''),
  orgRole: z.string().optional().default(''),
}).refine((data) => data.password === data.confirmPassword, {
  error: () => i18n.t('validation.passwordsMismatch', 'Les mots de passe ne correspondent pas') as string,
  path: ['confirmPassword'],
}).refine((data) => {
  if (data.organizationId && data.organizationId !== '' && !data.orgRole) return false;
  return true;
}, {
  error: () => i18n.t('validation.orgRoleRequiredWithOrg', "Le rôle dans l'organisation est requis quand une organisation est sélectionnée") as string,
  path: ['orgRole'],
});

export type UserFormValues = z.infer<typeof userSchema>;
