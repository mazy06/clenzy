export function getErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}
