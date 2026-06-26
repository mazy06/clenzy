/* ============================================================
   Superviseur d'agents IA — matrice de rôles (RBAC Keycloak)

   ⚠️ PLACEHOLDER À CONFIRMER côté produit. Le panneau opérateur
   ≠ un mode ops/avancé.
   - Opérateur : voit la constellation ET peut agir (valider/modifier,
     changer l'autonomie, mettre en pause).
   - Lecteur (lecture seule, ex. propriétaire) : voit la constellation
     sans pouvoir valider.

   Source de vérité des rôles : contexts/AuthContext (useAuth().hasAnyRole).
   ============================================================ */

/** Rôles autorisés à PILOTER les agents (valider / autonomie / pause). */
export const SUPERVISION_OPERATOR_ROLES = [
  'SUPER_ADMIN',
  'SUPER_MANAGER',
  'HOST',
  'SUPERVISOR',
] as const;

/**
 * Rôles autorisés à VOIR la constellation (lecture seule incluse).
 * Pour l'instant identiques aux opérateurs ; un futur rôle « propriétaire
 * lecture seule » viendra élargir cette liste sans toucher au reste.
 */
export const SUPERVISION_VIEWER_ROLES = [...SUPERVISION_OPERATOR_ROLES] as const;
