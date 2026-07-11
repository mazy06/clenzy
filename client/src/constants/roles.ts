// ─── Rôles plateforme — listes partagées ─────────────────────────────────────
// Source unique pour les gates de rôle côté client (à utiliser avec le helper
// réactif `hasAnyRole` de useAuth, jamais avec user?.roles?.some(...) brut).

/** Rôles « gestionnaires » : administration org + qualification des anomalies. */
export const MANAGER_ROLES = ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'] as const;

/** Rôles opérationnels terrain (missions assignées). */
export const OPERATIONAL_ROLES = ['TECHNICIAN', 'HOUSEKEEPER', 'LAUNDRY', 'EXTERIOR_TECH', 'SUPERVISOR'] as const;
