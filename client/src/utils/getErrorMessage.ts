/**
 * Extract a human-readable error message from an unknown error value.
 * Replaces the `err instanceof Error ? err.message : 'fallback'` pattern.
 */
export function getErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}
