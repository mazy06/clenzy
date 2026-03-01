import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

/**
 * Permission hook - ported from web client/src/hooks/usePermissions.ts
 * Uses Zustand store instead of React Context
 */
export function usePermissions() {
  const user = useAuthStore((state) => state.user);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user]
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      if (!user) return false;
      return user.roles.includes(role);
    },
    [user]
  );

  const hasAnyRole = useCallback(
    (roles: string[]): boolean => {
      if (!user) return false;
      return roles.some((r) => user.roles.includes(r));
    },
    [user]
  );

  return {
    hasPermission,
    hasRole,
    hasAnyRole,
    isSuperAdmin: () => hasRole('SUPER_ADMIN'),
    isSuperManager: () => hasRole('SUPER_MANAGER'),
    isPlatformStaff: () => hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']),
    isHost: () => hasRole('HOST'),
    isTechnician: () => hasRole('TECHNICIAN'),
    isHousekeeper: () => hasRole('HOUSEKEEPER'),
    isSupervisor: () => hasRole('SUPERVISOR'),
  };
}
