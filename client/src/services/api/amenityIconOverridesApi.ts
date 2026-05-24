import { apiClient } from '../apiClient';

/**
 * API client pour la personnalisation des icones de commodites par organisation.
 * Cf. table {@code organization_amenity_icon_overrides} (migration 0134) +
 * controller {@code AmenityIconOverrideController} cote backend.
 *
 * <p>Tous les endpoints sont scopes a l'organisation extraite du JWT — pas
 * besoin de passer orgId explicitement, le backend le resout via TenantContext.</p>
 */

export interface AmenityIconOverrideDto {
  amenityCode: string;
  iconName: string;
}

const BASE = '/amenities/icon-overrides';

export const amenityIconOverridesApi = {
  /** GET — retourne tous les overrides de l'organisation courante. */
  list: () => apiClient.get<AmenityIconOverrideDto[]>(BASE),

  /** PUT — cree ou met a jour l'override pour {@code amenityCode}. Idempotent. */
  upsert: (amenityCode: string, iconName: string) =>
    apiClient.put<AmenityIconOverrideDto>(`${BASE}/${encodeURIComponent(amenityCode)}`, { iconName }),

  /** DELETE — retourne a l'icone par defaut. Idempotent (204 si rien a supprimer). */
  delete: (amenityCode: string) =>
    apiClient.delete<void>(`${BASE}/${encodeURIComponent(amenityCode)}`),
};
