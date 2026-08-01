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
import { cn } from '../../../utils/cn';
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
import { PriceAdjustmentModal } from './PriceAdjustmentModal';
import type { SupervisionProvider } from '../provider/SupervisionProvider';
import type { AgentId, PendingAction, PortfolioPendingAction, PortfolioSnapshot } from '../types';

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
  const [priceAction, setPriceAction] = useState<PortfolioPendingAction | null>(null);
  const handleAdjustPrice = useCallback(
    (a: PendingAction | PortfolioPendingAction) => setPriceAction(a as PortfolioPendingAction),
    [],
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
    <div className="relative">
      <div className="flex gap-3 items-stretch flex-wrap min-[900px]:flex-nowrap">
        <div className="flex-1 min-w-0">
          <AgentConstellation snapshot={portfolio} online={status === 'live'} onSelectAgent={setSelected} />
        </div>

        <div className="w-full min-[900px]:w-[330px] shrink-0 flex flex-col gap-3">
          <SupervisionReportStrip />

          {(portfolio.orgAlerts?.length ?? 0) > 0 && (
            <Box sx={cardSx}>
              <Typography sx={{ p: '14px 16px 8px', fontWeight: 800, fontSize: 13.5, color: 'var(--ink, #1b2240)' }}>
                {t('supervision.orgAlerts.title', 'Alertes portefeuille')}
              </Typography>
              <div className="px-2 pb-2 flex flex-col gap-2">
                {portfolio.orgAlerts!.map((a, i) => (
                  <div className="flex gap-1.5 items-start" key={i}>
                    <div className={cn('w-[8px] h-[8px] rounded-[50%] mt-[5px] shrink-0', a.severity === 'critical' ? 'bg-[var(--err,_#c0392b)]' : '[object Object]')} />
                    <div className="min-w-0">
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink, #1b2240)', lineHeight: 1.3 }}>
                        {a.title}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: 'var(--muted, #6b7280)', lineHeight: 1.35 }}>
                        {a.description}
                      </Typography>
                    </div>
                  </div>
                ))}
              </div>
            </Box>
          )}

          <Box sx={cardSx}>
            <div className="flex items-center gap-1.5 p-[14px 16px 12px] font-extrabold text-[13.5px] text-[var(--ink,_#1b2240)]">
              {t('supervision.queue.title')}
              <span className="ms-auto min-w-[24px] h-[24px] px-[4.5px] rounded-[8px] bg-[var(--warn-soft)] text-[var(--warn)] flex items-center justify-center text-[12px] font-extrabold">
                {portfolio.pending.length}
              </span>
            </div>
            <div className="p-2 max-h-[320px] overflow-y-auto">
              <PendingQueue actions={portfolio.pending} onValidate={handleValidate} onEdit={handleEdit} onAdjustPrice={handleAdjustPrice} variant="panel" />
            </div>
          </Box>

          <Box sx={cardSx}>
            <Typography sx={{ p: '14px 16px 8px', fontWeight: 800, fontSize: 13.5, color: 'var(--ink, #1b2240)' }}>
              {t('supervision.feed.title')}
            </Typography>
            <div className="px-1.5 pb-1.5 max-h-[220px] overflow-y-auto">
              {portfolio.feed.length > 0 ? (
                <ActivityFeed entries={portfolio.feed} />
              ) : (
                <div className="px-2 py-3 text-center text-[12px] text-[var(--muted)] leading-[1.5]">
                  {t(
                    'supervision.feed.emptyOnboarding',
                    'Les agents observent vos logements. Leurs actions et suggestions à valider apparaîtront ici — rien n’est exécuté sans votre accord.',
                  )}
                </div>
              )}
            </div>
          </Box>
        </div>
      </div>

      {toasts.length > 0 && (
        <div className="absolute top-[16px] start-[50%] z-[8] flex flex-col items-center gap-1.5" style={{ transform: 'translateX(-50%)' }}>
          <ResolutionToasts toasts={toasts} />
        </div>
      )}

      <AgentDrawer open={Boolean(selected)} detail={detail} onClose={() => setSelected(null)} />

      {priceAction && (
        <PriceAdjustmentModal
          suggestionId={priceAction.id}
          propertyId={Number(priceAction.propertyId ?? 0)}
          actionParams={priceAction.actionParams}
          onClose={() => setPriceAction(null)}
          onApplied={() => {
            markInFlight(priceAction.id);
            setPriceAction(null);
          }}
        />
      )}
    </div>
  );
}
