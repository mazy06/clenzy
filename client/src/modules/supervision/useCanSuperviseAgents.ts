/* ============================================================
   Superviseur d'agents IA — gate de rôle

   Gate la feature par rôle (RBAC Keycloak). Sépare explicitement
   « voir » (lecture seule) et « piloter » (valider / autonomie / pause),
   pour qu'un propriétaire puisse voir la constellation sans agir.
   ============================================================ */

import { useAuth } from '../../contexts/AuthContext';
import { SUPERVISION_OPERATOR_ROLES, SUPERVISION_VIEWER_ROLES } from './roles';

export interface SupervisionAccess {
  /** Peut afficher la constellation (opérateur ou lecteur). */
  canView: boolean;
  /** Peut valider/modifier, changer l'autonomie, mettre en pause. */
  canOperate: boolean;
}

export function useCanSuperviseAgents(): SupervisionAccess {
  const { hasAnyRole } = useAuth();
  const canOperate = hasAnyRole([...SUPERVISION_OPERATOR_ROLES]);
  const canView = canOperate || hasAnyRole([...SUPERVISION_VIEWER_ROLES]);
  return { canView, canOperate };
}
