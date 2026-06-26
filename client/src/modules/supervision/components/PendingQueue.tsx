/* ============================================================
   <PendingQueue> — file « Attend ta validation »

   Pile de PendingActionCard. Deux dispositions :
   - 'floating' : superposée en haut-droite de la constellation (par logement)
   - 'panel'    : colonne pleine hauteur avec état vide (vue d'ensemble, Phase 6)
   ============================================================ */

import { Box } from '@mui/material';
import { CheckCircle } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { PendingActionCard } from './PendingActionCard';
import type { PendingAction, PortfolioPendingAction } from '../types';

export interface PendingQueueProps {
  actions: (PendingAction | PortfolioPendingAction)[];
  onValidate: (id: string) => void;
  onEdit: (id: string) => void;
  variant?: 'floating' | 'panel';
}

export function PendingQueue({ actions, onValidate, onEdit, variant = 'floating' }: PendingQueueProps) {
  const { t } = useTranslation();

  // Disposition flottante : rien à afficher quand la file est vide.
  if (variant === 'floating' && actions.length === 0) return null;

  if (actions.length === 0) {
    return (
      <Box
        data-pending-empty
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '14px 8px', color: '#6B7196' }}
      >
        <CheckCircle size={28} style={{ color: '#4A9B8E', flexShrink: 0 }} />
        <Box>
          <Box sx={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink, #1b2240)' }}>{t('supervision.hitl.empty')}</Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      data-pending-queue
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        width: variant === 'floating' ? 300 : '100%',
        maxHeight: variant === 'floating' ? 'calc(100% - 32px)' : 'none',
        overflowY: variant === 'floating' ? 'auto' : 'visible',
      }}
    >
      {actions.map((action) => (
        <PendingActionCard key={action.id} action={action} onValidate={onValidate} onEdit={onEdit} />
      ))}
    </Box>
  );
}
