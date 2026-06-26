/* ============================================================
   Bascule mock ⇄ réel (Superviseur d'agents)

   Le MOCK reste le défaut tant que le provider réel n'est pas validé en
   navigateur. La bascule se fait par :
     1. flag build-time `VITE_SUPERVISION_LIVE=true` (CI/preview), OU
     2. override per-session (dev) : `sessionStorage.clenzy_supervision_live`.

   Pas de localStorage (le mode n'a pas à survivre à la fermeture de l'onglet),
   pas de toggle UI imposé : c'est un seam de dev/intégration, pas une
   préférence métier persistée. Un appelant peut toujours forcer le provider
   via `SupervisionView.createPropertyProvider` (override explicite > flag).
   ============================================================ */

const SESSION_KEY = 'clenzy_supervision_live';

/** True si la constellation doit se brancher sur le moteur réel (AG-UI). */
export function isSupervisionLiveEnabled(): boolean {
  // Override per-session (dev) prioritaire sur le flag build-time.
  try {
    const override = sessionStorage.getItem(SESSION_KEY);
    if (override === 'true') return true;
    if (override === 'false') return false;
  } catch {
    /* sessionStorage indisponible (SSR / privacy) → on retombe sur l'env. */
  }
  const env = (import.meta.env as Record<string, string | undefined>).VITE_SUPERVISION_LIVE;
  return env === 'true' || env === '1';
}

/** Dev : force le mode pour la session courante (sans rebuild). */
export function setSupervisionLive(enabled: boolean): void {
  try {
    sessionStorage.setItem(SESSION_KEY, enabled ? 'true' : 'false');
  } catch {
    /* no-op */
  }
}
