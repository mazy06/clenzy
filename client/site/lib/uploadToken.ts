import { ApiError, marketplaceApi } from './marketplaceApi';

/** Migration des anciens dossiers vers le cookie HttpOnly, sans nouveau secret persistant. */
const LEGACY_KEY = 'baitly_provider_application_token';
let migration: Promise<string | null> | undefined;

export function readUploadToken(): Promise<string | null> {
  migration ??= (async () => {
    let legacy: string | null = null;
    try { legacy = window.localStorage.getItem(LEGACY_KEY); } catch { /* Stockage indisponible. */ }
    if (legacy) {
      try {
        await marketplaceApi.migrateApplicationSession(legacy);
      } catch (error) {
        // Un ancien dossier clos ne doit pas bloquer une nouvelle candidature.
        // En revanche, conserver le jeton si le serveur est temporairement indisponible.
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
      }
      clearUploadToken();
    }
    return 'session';
  })().catch((error) => { migration = undefined; throw error; });
  return migration;
}

/** La référence « session » ne contient aucun secret et ne nécessite aucun stockage. */
export function writeUploadToken(_reference: string): void { clearUploadToken(); }

export function clearUploadToken(): void {
  try { window.localStorage.removeItem(LEGACY_KEY); } catch { /* Stockage indisponible. */ }
}
