import { apiClient } from '../apiClient';

/* ─── Types ─── */

/**
 * Identifiants du compte app Tuya de l'hote (modele C). Renvoyes par le PMS pour la connexion
 * SDK Tuya cote mobile, avant l'appairage. {@link secret} = mot de passe du compte app.
 */
export interface TuyaAppAccountDto {
  tuyaUid: string | null;
  username: string | null;
  secret: string | null;
  countryCode: string | null;
  /** Schema de l'App SDK Tuya (init du SDK). */
  schema: string | null;
}

/* ─── API ─── */

export const tuyaApi = {
  /**
   * Provisionne (si besoin) et retourne le compte app Tuya de l'hote courant.
   * POST /api/tuya/app-account. Renvoie une erreur "configuration_missing" si le schema App SDK
   * n'est pas configure cote plateforme.
   */
  getAppAccount() {
    return apiClient.post<TuyaAppAccountDto>('/tuya/app-account');
  },
};
