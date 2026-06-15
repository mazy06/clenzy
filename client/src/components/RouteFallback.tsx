import { Box, CircularProgress } from '@mui/material';

/**
 * Fallback affiché pendant le chargement d'un chunk de route (code-splitting via React.lazy).
 * Volontairement léger (chargé dans le bundle initial) : un spinner centré, teinté au thème.
 */
export default function RouteFallback() {
  return (
    <Box
      role="status"
      aria-label="Chargement"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', width: '100%' }}
    >
      <CircularProgress size={32} sx={{ color: 'var(--accent, #6B8A9A)' }} />
    </Box>
  );
}
