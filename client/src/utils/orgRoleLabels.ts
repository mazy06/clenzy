/**
 * Labels, couleurs et listes de roles d'organisation.
 * Source unique partagee par MembersList, InvitationsList, SendInvitationDialog, ChangeRoleDialog.
 */

// ─── Labels FR ──────────────────────────────────────────────────────────────

const ORG_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietaire',
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  SUPERVISOR: 'Superviseur',
  HOUSEKEEPER: 'Agent de menage',
  TECHNICIAN: 'Technicien',
  LAUNDRY: 'Blanchisserie',
  EXTERIOR_TECH: 'Tech. Exterieur',
  HOST: 'Hote',
  MEMBER: 'Membre',
  // Roles plateforme (affiches dans les invitations)
  SUPER_ADMIN: 'Super Administrateur',
  SUPER_MANAGER: 'Super Manager',
};

export function getOrgRoleLabel(role: string): string {
  return ORG_ROLE_LABELS[role] || role;
}

import type { ChipColor } from '../types';

// ─── Couleurs Chip ──────────────────────────────────────────────────────────

const ORG_ROLE_COLORS: Record<string, ChipColor> = {
  OWNER: 'secondary',
  ADMIN: 'error',
  MANAGER: 'warning',
  SUPERVISOR: 'info',
  HOUSEKEEPER: 'success',
  TECHNICIAN: 'primary',
  LAUNDRY: 'default',
  EXTERIOR_TECH: 'primary',
  HOST: 'info',
  MEMBER: 'default',
};

export function getOrgRoleColor(role: string): ChipColor {
  return ORG_ROLE_COLORS[role] || 'default';
}

// ─── Roles assignables (pour les selects) ───────────────────────────────────

/** Roles que l'on peut attribuer a un membre (tout sauf OWNER). */
export const ASSIGNABLE_ORG_ROLES = [
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'SUPERVISOR', label: 'Superviseur' },
  { value: 'HOUSEKEEPER', label: 'Agent de menage' },
  { value: 'TECHNICIAN', label: 'Technicien' },
  { value: 'LAUNDRY', label: 'Blanchisserie' },
  { value: 'EXTERIOR_TECH', label: 'Tech. Exterieur' },
  { value: 'HOST', label: 'Hote' },
  { value: 'MEMBER', label: 'Membre' },
] as const;
