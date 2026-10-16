/** Repères fixes du démarrage, sans URL, compte, jeton ou donnée personnelle. */
type BootStage = 'auth-start' | 'session-received' | 'me-received' | 'entry-evaluated'
  | 'translations-ready' | 'root-render' | 'user-ready';

export function markBaitlyBoot(stage: BootStage): void {
  try {
    const name = `baitly:boot:${stage}`;
    if (!performance.getEntriesByName(name, 'mark').length) performance.mark(name);
  } catch { /* La mesure ne doit jamais bloquer l'application. */ }
}
