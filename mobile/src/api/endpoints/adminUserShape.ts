/**
 * Platform user as sent by /api/users: a single `role`, `phoneNumber` and a `status`.
 * The admin screens read `roles`, `phone` and `enabled`.
 */
type ServerUser = { role?: string; roles?: string[]; phoneNumber?: string; phone?: string; status?: string; enabled?: boolean };
export function toAdminUser<T extends { roles: string[]; phone?: string; enabled: boolean }>(item: unknown): T {
  const user = item as ServerUser & Record<string, unknown>;
  return { ...user, roles: user.roles ?? (user.role ? [user.role] : []), phone: user.phone ?? user.phoneNumber,
    enabled: user.enabled ?? user.status === 'ACTIVE' } as unknown as T;
}
/** Inverse for updates: the server stores `phoneNumber`, a single `role` and `status`. */
export function fromAdminUser(data: { phone?: string | null; enabled?: boolean } & Record<string, unknown>) {
  const { phone, enabled, roles, ...rest } = data;
  return { ...rest, role: Array.isArray(roles) ? roles[0] : undefined, phoneNumber: phone ?? undefined,
    status: enabled === undefined ? undefined : enabled ? 'ACTIVE' : 'SUSPENDED' };
}
