/* ============================================================
   <ResolutionToasts> — bandeaux concurrence / expiration

   Pile de chips (« déjà traitée par X » / « expirée »). Présentation pure ;
   le parent positionne le conteneur. Alimenté par useResolutionToasts.
   ============================================================ */

import { Box } from '@mui/material';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ResolutionToast } from '../core/useResolutionToasts';

export function ResolutionToasts({ toasts }: { toasts: ResolutionToast[] }) {
  const { t } = useTranslation();
  if (toasts.length === 0) return null;

  return (
    <>
      {toasts.map((toast) => (
        <Box
          key={toast.key}
          role="status"
          sx={{
            px: 1.5,
            py: 0.75,
            borderRadius: 999,
            bgcolor: 'rgba(20,24,58,.85)',
            color: '#E7E9FB',
            border: '1px solid rgba(255,255,255,.12)',
            backdropFilter: 'blur(8px)',
            fontSize: 12.5,
            fontWeight: 700,
            boxShadow: '0 10px 28px -14px rgba(0,0,0,.6)',
          }}
        >
          {toast.kind === 'expired'
            ? t('supervision.hitl.expired')
            : toast.by
              ? t('supervision.hitl.alreadyHandledBy', { name: toast.by })
              : t('supervision.hitl.alreadyHandled')}
        </Box>
      ))}
    </>
  );
}
