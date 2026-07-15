import { apiClient } from '../apiClient';

/**
 * API client pour les preferences UI generiques par utilisateur.
 *
 * <p>Backend : table {@code user_ui_preferences} (migration 0135) +
 * controller {@code UserUiPreferencesController} (path {@code /api/me/ui-preferences}).</p>
 *
 * <p>Remplace les usages directs de localStorage pour les preferences UI
 * (filtres planning, zoom, density, largeur de colonnes, etc.) afin que
 * les preferences traversent les devices et les navigateurs.</p>
 *
 * <p>La valeur est typee `unknown` car chaque caller connait son shape
 * et le cast cote frontend (TypeScript). Le backend stocke en JSONB.</p>
 */

const BASE = '/me/ui-preferences';

export const userUiPreferencesApi = {
  /** GET — retourne toutes les preferences UI de l'utilisateur courant. */
  list: () => apiClient.get<Record<string, unknown>>(BASE),

  /** PUT — upsert la preference pour la cle donnee. Valeur = JSON arbitraire. */
  upsert: <T>(key: string, value: T) =>
    apiClient.put<{ key: string; value: T }>(`${BASE}/${encodeURIComponent(key)}`, value),

  /** DELETE — supprime la preference (retour au defaut frontend). Idempotent. */
  delete: (key: string) =>
    apiClient.delete<void>(`${BASE}/${encodeURIComponent(key)}`),
};
