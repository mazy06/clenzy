import apiClient from '../apiClient';

/**
 * Inventaire des chemins échappant à la Row-Level Security — audit sécurité 2026-07-26,
 * plan REM-T-01.
 *
 * Une requête qui s'exécute sans contexte tenant ne lève pas d'erreur une fois la RLS
 * active : elle renvoie **zéro ligne**. Chaque chemin listé ici est donc un endroit à
 * traiter avant l'activation.
 */

export interface RlsAuditFinding {
  id: number;
  /** Première frame applicative — le code à corriger (classe.méthode:ligne). */
  origin: string;
  tableName: string;
  sqlExcerpt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Sert à prioriser : un chemin très emprunté est plus urgent qu'un chemin marginal. */
  occurrences: number;
  resolvedAt: string | null;
}

export interface RlsAuditSummary {
  auditActif: boolean;
  /**
   * L'aspect pose-t-il bien les GUC. Si `false`, l'inventaire recense TOUTES les requêtes
   * et non les seuls chemins à risque : il est alors **sans valeur**, et son abondance ne
   * doit pas être interprétée.
   */
  mesureExploitable: boolean;
  rlsDejaActive: boolean;
  /** Chemins non traités. Zéro est la condition d'activation de la RLS. */
  cheminsOuverts: number;
  /** Constats en mémoire pas encore persistés (vidage toutes les 5 min). */
  enAttente: number;
  /** Plafond atteint : des constats sont perdus, l'inventaire est incomplet. */
  sature: boolean;
  chemins: RlsAuditFinding[];
}

/** Résultat d'une fermeture en masse. */
export interface RlsAuditBulkResolve {
  /** Chemins effectivement passés de ouvert à traité. */
  traites: number;
  /**
   * Constats encore en mémoire au moment de l'action — **non couverts** par la fermeture.
   * Ceux qui portent sur un chemin qu'on vient de fermer le rouvriront au prochain vidage,
   * et l'écran les montrera « réapparus après correction » alors qu'ils sont seulement
   * arrivés en retard.
   */
  enAttente: number;
}

const BASE = '/admin/rls-audit';

export const rlsAuditApi = {
  etat: (): Promise<RlsAuditSummary> => apiClient.get<RlsAuditSummary>(BASE),

  marquerTraite: (id: number): Promise<RlsAuditFinding> =>
    apiClient.post<RlsAuditFinding>(`${BASE}/${id}/resolve`, {}),

  /**
   * Ferme tous les chemins ouverts d'un coup. Pour un correctif structurel, qui rend
   * l'inventaire entier caduc — pas pour faire disparaître une liste qu'on n'a pas lue.
   */
  marquerTousTraites: (): Promise<RlsAuditBulkResolve> =>
    apiClient.post<RlsAuditBulkResolve>(`${BASE}/resolve-all`, {}),
};
