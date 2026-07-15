/* ============================================================
   Bascule mock ⇄ réel (Superviseur d'agents)

   Le mode RÉEL (branché sur le moteur multi-agent via AG-UI) est désormais le
   DÉFAUT. L'opt-out se fait par :
     1. flag build-time `VITE_SUPERVISION_LIVE=false` (ou `0`) → repasse en mock, OU
     2. override per-session (dev) : `sessionStorage.clenzy_supervision_live`.

   Note UX : sans activité (pas de chat opérateur, runtime ambiant pas encore
   livré — cf. Phase 3 du plan), la constellation réelle reste « en direct » mais
   au repos (agents en veille). C'est le comportement attendu, pas un bug.

   Pas de localStorage (le mode n'a pas à survivre à la fermeture de l'onglet),
   pas de toggle UI imposé : c'est un seam d'intégration, pas une préférence
   métier persistée. Un appelant peut toujours forcer le provider via
   `SupervisionView.createPropertyProvider` (override explicite > flag).
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
  // Live par défaut : seul un opt-out EXPLICITE (`false`/`0`) repasse en mock.
  return env !== 'false' && env !== '0';
}
