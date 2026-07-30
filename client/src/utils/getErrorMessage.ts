/**
 * Extract a human-readable error message from an unknown error value.
 * Replaces the `err instanceof Error ? err.message : 'fallback'` pattern.
 *
 * Les erreurs d'API ne sont PAS des `Error` : `apiClient` lève un objet
 * `ApiError` (`{status, message, details}`). Sans la branche « objet porteur
 * d'un message », tout échec serveur retombait sur le texte générique et la
 * raison renvoyée par l'API (« La demande doit être en statut AWAITING_PAYMENT »,
 * par exemple) n'atteignait jamais l'écran.
 */
export function getErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
