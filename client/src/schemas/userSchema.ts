import { z } from 'zod/v4';

export const userSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.string().min(1, "L'email est requis").email('Format email invalide'),
  phoneNumber: z.string().optional().default(''),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  confirmPassword: z.string().min(1, 'Confirmation requise'),
  role: z.string().min(1, 'Le rôle est requis'),
  status: z.string().min(1, 'Le statut est requis'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

// Schema for edit mode (password optional)
export const userEditSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.string().min(1, "L'email est requis").email('Format email invalide'),
  phoneNumber: z.string().optional().default(''),
  password: z.string().optional().default(''),
  confirmPassword: z.string().optional().default(''),
  role: z.string().min(1, 'Le rôle est requis'),
  status: z.string().min(1, 'Le statut est requis'),
}).refine((data) => {
  if (data.password && data.password !== data.confirmPassword) return false;
  return true;
}, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

export type UserFormValues = z.infer<typeof userSchema>;
