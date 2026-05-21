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
import type { LucideIcon } from 'lucide-react';
import {
  StarRate,
  VerifiedUser,
  BusinessCenter,
  SupervisorAccount,
  CleaningServices,
  Build,
  LocalLaundryService,
  Deck,
  Home,
  Person,
  AdminPanelSettings,
} from '../icons';

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

// ─── Palette Clenzy par role (hex) ──────────────────────────────────────────

const ORG_ROLE_HEX: Record<string, string> = {
  OWNER: '#4A9B8E',
  ADMIN: '#C97A7A',
  MANAGER: '#D4A574',
  SUPERVISOR: '#7BA3C2',
  HOUSEKEEPER: '#4A9B8E',
  TECHNICIAN: '#6B8A9A',
  LAUNDRY: '#8A8378',
  EXTERIOR_TECH: '#6B8A9A',
  HOST: '#4A9B8E',
  MEMBER: '#8A8378',
  SUPER_ADMIN: '#C97A7A',
  SUPER_MANAGER: '#8A6E8A',
};

export function getOrgRoleHex(role: string): string {
  return ORG_ROLE_HEX[role] || '#8A8378';
}

// ─── Icones lucide par role ─────────────────────────────────────────────────

const ORG_ROLE_ICONS: Record<string, LucideIcon> = {
  OWNER: StarRate,
  ADMIN: VerifiedUser,
  MANAGER: BusinessCenter,
  SUPERVISOR: SupervisorAccount,
  HOUSEKEEPER: CleaningServices,
  TECHNICIAN: Build,
  LAUNDRY: LocalLaundryService,
  EXTERIOR_TECH: Deck,
  HOST: Home,
  MEMBER: Person,
  SUPER_ADMIN: AdminPanelSettings,
  SUPER_MANAGER: SupervisorAccount,
};

export function getOrgRoleIcon(role: string): LucideIcon {
  return ORG_ROLE_ICONS[role] || Person;
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
