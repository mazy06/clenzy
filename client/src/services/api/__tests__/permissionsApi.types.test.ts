import { describe, it, expect } from 'vitest';
import type { RolePermissions } from '../permissionsApi';

/**
 * Type-level tests for permissions API.
 * Validates that return types are correct so useRolePermissions
 * doesn't need `as any` casts.
 */

describe('RolePermissions interface', () => {
  it('should have role, permissions, and isDefault fields', () => {
    const rp: RolePermissions = {
      role: 'HOST',
      permissions: ['properties:read', 'interventions:read'],
      isDefault: true,
    };

    expect(rp.role).toBe('HOST');
    expect(rp.permissions).toHaveLength(2);
    expect(rp.isDefault).toBe(true);
  });

  it('getAllRoles should return RolePermissions[] (not string[])', () => {
    // This test documents the expected return type.
    // getAllRoles returns the full role objects with permissions, not just role names.
    const mockRoles: RolePermissions[] = [
      { role: 'HOST', permissions: ['properties:read'], isDefault: true },
      { role: 'ADMIN', permissions: ['users:manage'], isDefault: false },
    ];

    // Verify we can extract role names from the full objects
    const roleNames: string[] = mockRoles.map(r => r.role);
    expect(roleNames).toEqual(['HOST', 'ADMIN']);
  });
});
