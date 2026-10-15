import type { AuthUser } from '@/store/authStore';
import type { MobileCapabilities } from '@/features/missions/api';

/** Who the signed-in person is for the mobile app: decides navigation, never permissions. */
export type BaitlyPersona = 'owner' | 'concierge' | 'provider' | 'supervisor' | 'admin';
export type BaitlyWorkspace = 'owner' | 'provider';

const ADMIN_ROLES = ['SUPER_ADMIN', 'SUPER_MANAGER', 'ADMIN'];

export function isPlatformAdmin(user: Pick<AuthUser, 'roles'> | null | undefined) {
  return !!user?.roles.some(role => ADMIN_ROLES.includes(role));
}

/**
 * Resolved once per session. A person who both owns homes and executes missions keeps the
 * workspace switch: the provider workspace then shows the field persona.
 */
export function baitlyPersona(user: Pick<AuthUser, 'roles' | 'organizationType'> | null | undefined,
  capabilities: Pick<MobileCapabilities, 'canViewOwnerSpace'> | undefined, workspace: BaitlyWorkspace = 'owner'): BaitlyPersona {
  if (isPlatformAdmin(user)) return 'admin';
  if (user?.roles.includes('SUPERVISOR')) return 'supervisor';
  if (workspace === 'provider' || !capabilities?.canViewOwnerSpace) return 'provider';
  return user?.organizationType === 'CONCIERGE' ? 'concierge' : 'owner';
}
