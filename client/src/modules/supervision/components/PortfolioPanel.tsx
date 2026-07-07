/* ============================================================
   <PortfolioPanel> — vue d'ensemble (portefeuille)

   Même grammaire visuelle que par-logement (cœur, orbites, statuts,
   faisceaux, focus), mais :
   - satellites agrégés + badge = nb de logements
   - panneau latéral : file de validation multi-logements + journal portefeuille
   - clic satellite → drawer ventilation par logement
   Pas de comète ici (le planning est masqué en pleine largeur).
   ============================================================ */

import { useCallback, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSupervision } from '../core/useSupervision';
import { useResolutionToasts } from '../core/useResolutionToasts';
import { ConstellationSkeleton } from './ConstellationSkeleton';
import { AgentConstellation } from './AgentConstellation';
import { PendingQueue } from './PendingQueue';
import { ActivityFeed } from './ActivityFeed';
import { SupervisionReportStrip } from './SupervisionReportStrip';
import { ResolutionToasts } from './ResolutionToasts';
import { AgentDrawer, type AgentDetail } from './AgentDrawer';
import type { SupervisionProvider } from '../provider/SupervisionProvider';
import type { AgentId, PortfolioSnapshot } from '../types';

export interface PortfolioPanelProps {
  createProvider: () => SupervisionProvider;
  deps: unknown[];
  onEditAction?: (actionId: string) => void;
}

const cardSx = {
  border: '1px solid var(--line, #e6e8ef)',
  borderRadius: '14px',
  bgcolor: 'var(--card, #fff)',
  overflow: 'hidden',
};

export function PortfolioPanel({ createProvider, deps, onEditAction }: PortfolioPanelProps) {
  const { t } = useTranslation();
  const { toasts, markInFlight, onResolved } = useResolutionToasts();
  const { status, snapshot, actions } = useSupervision(createProvider, deps, { onResolved });
  const [selected, setSelected] = useState<AgentId | null>(null);

  const handleValidate = useCallback(
    (id: string) => {
      markInFlight(id);
      void actions.validatePending(id);
    },
    [actions, markInFlight],
  );
  const handleEdit = useCallback(
    (id: string) => {
      markInFlight(id);
      void actions.editPending(id);
      onEditAction?.(id);
    },
    [actions, markInFlight, onEditAction],
  );

  const detail: AgentDetail | null = useMemo(() => {
    if (!selected || !snapshot || snapshot.scope !== 'portfolio') return null;
    const rollup = snapshot.agents.find((a) => a.id === selected);
    return rollup ? { id: rollup.id, status: rollup.status, task: rollup.task, items: rollup.items } : null;
  }, [selected, snapshot]);

  if (status === 'loading' || !snapshot || snapshot.scope !== 'portfolio') {
    return <ConstellationSkeleton />;
  }
  const portfolio: PortfolioSnapshot = snapshot;

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <AgentConstellation snapshot={portfolio} online={status === 'live'} onSelectAgent={setSelected} />
        </Box>

        <Box sx={{ width: { xs: '100%', md: 330 }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SupervisionReportStrip />
          <Box sx={cardSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '14px 16px 12px', fontWeight: 800, fontSize: 13.5, color: 'var(--ink, #1b2240)' }}>
              {t('supervision.queue.title')}
              <Box
                component="span"
                sx={{
                  ml: 'auto',
                  minWidth: 24,
                  height: 24,
                  px: 0.75,
                  borderRadius: '8px',
                  bgcolor: 'var(--warn-soft)',
                  color: 'var(--warn)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {portfolio.pending.length}
              </Box>
            </Box>
            <Box sx={{ p: 1.5, maxHeight: 320, overflowY: 'auto' }}>
              <PendingQueue actions={portfolio.pending} onValidate={handleValidate} onEdit={handleEdit} variant="panel" />
            </Box>
          </Box>

          <Box sx={cardSx}>
            <Typography sx={{ p: '14px 16px 8px', fontWeight: 800, fontSize: 13.5, color: 'var(--ink, #1b2240)' }}>
              {t('supervision.feed.title')}
            </Typography>
            <Box sx={{ px: 1, pb: 1, maxHeight: 220, overflowY: 'auto' }}>
              {portfolio.feed.length > 0 ? (
                <ActivityFeed entries={portfolio.feed} />
              ) : (
                <Box sx={{ px: 1.5, py: 2, textAlign: 'center', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {t(
                    'supervision.feed.emptyOnboarding',
                    'Les agents observent vos logements. Leurs actions et suggestions à valider apparaîtront ici — rien n’est exécuté sans votre accord.',
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {toasts.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <ResolutionToasts toasts={toasts} />
        </Box>
      )}

      <AgentDrawer open={Boolean(selected)} detail={detail} onClose={() => setSelected(null)} />
    </Box>
  );
}
