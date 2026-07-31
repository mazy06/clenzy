import { CircularProgress } from '@mui/material';

/**
 * Fallback affiché pendant le chargement d'un chunk de route (code-splitting via React.lazy).
 * Volontairement léger (chargé dans le bundle initial) : un spinner centré, teinté au thème.
 */
export default function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full" role="status" aria-label="Chargement">
      <CircularProgress size={32} sx={{ color: 'var(--accent, #6B8A9A)' }} />
    </div>
  );
}
