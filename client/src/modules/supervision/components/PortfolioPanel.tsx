/* ============================================================
   <PortfolioPanel> — vue d'ensemble (portefeuille)

   Même grammaire visuelle que par-logement (cœur, orbites, statuts,
   faisceaux, focus), mais :
   - satellites agrégés + badge = nb de logements
   - panneau latéral : file de validation multi-logements + journal portefeuille
   - clic satellite → drawer ventilation par logement
   Pas de comète ici (le planning est masqué en pleine largeur).
   ============================================================ */

import { useCallback, useMemo, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';

import { Badge, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSupervision } from '../core/useSupervision';
import { useResolutionToasts } from '../core/useResolutionToasts';
import { ConstellationSkeleton } from './ConstellationSkeleton';
import { AgentConstellation } from './AgentConstellation';
import { OrbitConstellation } from '../renderers/OrbitConstellation';
import { PendingQueue } from './PendingQueue';
import { ActivityFeed } from './ActivityFeed';
import { SupervisionReportStrip } from './SupervisionReportStrip';
import { ResolutionToasts } from './ResolutionToasts';
import { AgentDrawer, type AgentDetail } from './AgentDrawer';
import { PriceAdjustmentModal } from './PriceAdjustmentModal';
import { SupervisionTethers } from './SupervisionTethers';
import type { SupervisionProvider } from '../provider/SupervisionProvider';
import type { AgentId, PendingAction, PortfolioPendingAction, PortfolioSnapshot } from '../types';

export interface PortfolioPanelProps {
  createProvider: () => SupervisionProvider;
  deps: unknown[];
  onEditAction?: (actionId: string) => void;
}

export function PortfolioPanel({ createProvider, deps, onEditAction }: PortfolioPanelProps) {
  const { t } = useTranslation();
  const { toasts, markInFlight, onResolved } = useResolutionToasts();
  const { status, snapshot, actions } = useSupervision(createProvider, deps, { onResolved });
  const [selected, setSelected] = useState<AgentId | null>(null);
  // Agent stabilisé en tête (OrbitConstellation) → attaches vers ses cartes.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [headAgent, setHeadAgent] = useState<AgentId | null>(null);

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
    <div className="relative" ref={rootRef}>
      {/* Attaches agent de tête → cartes de la file (grammaire projection). */}
      <SupervisionTethers rootRef={rootRef} headAgent={headAgent} revision={portfolio.pending} />
      <div className="flex gap-3 items-stretch flex-wrap min-[900px]:flex-nowrap">
        <div className="flex-1 min-w-0">
          <AgentConstellation
            snapshot={portfolio}
            renderer={OrbitConstellation}
            online={status === 'live'}
            onSelectAgent={setSelected}
            onHeadAgentSettled={setHeadAgent}
          />
        </div>

        <div className="w-full min-[900px]:w-[330px] shrink-0 flex flex-col gap-3">
          <SupervisionReportStrip />

          {(portfolio.orgAlerts?.length ?? 0) > 0 && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>{t('supervision.orgAlerts.title', 'Alertes portefeuille')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {portfolio.orgAlerts!.map((a, i) => (
                  <div className="flex gap-1.5 items-start" key={i}>
                    <div
                      className={cn(
                        'size-2 rounded-full mt-1 shrink-0',
                        a.severity === 'critical'
                          ? 'bg-destructive'
                          : a.severity === 'warning'
                            ? 'bg-warning'
                            : 'bg-info',
                      )}
                    />
                    <div className="min-w-0">
                      <p className="m-0 text-xs font-medium leading-snug text-foreground">
                        {a.title}
                      </p>
                      <p className="m-0 text-2xs leading-snug text-muted-foreground">
                        {a.description}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                {t('supervision.queue.title')}
                <Badge variant="warning" className="ms-auto tabular-nums">
                  {portfolio.pending.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            {/* data-tethers-viewport : une carte défilée hors de ce cadre perd
                son attache (son rect survit au rognage overflow). */}
            <CardContent className="max-h-[320px] overflow-y-auto" data-tethers-viewport>
              <PendingQueue actions={portfolio.pending} onValidate={handleValidate} onEdit={handleEdit} onAdjustPrice={handleAdjustPrice} variant="panel" />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>{t('supervision.feed.title')}</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[220px] overflow-y-auto">
              {portfolio.feed.length > 0 ? (
                <ActivityFeed entries={portfolio.feed} pending={portfolio.pending} />
              ) : (
                <p className="m-0 py-1 text-center text-xs leading-relaxed text-muted-foreground">
                  {t(
                    'supervision.feed.emptyOnboarding',
                    'Les agents observent vos logements. Leurs actions et suggestions à valider apparaîtront ici — rien n’est exécuté sans votre accord.',
                  )}
                </p>
              )}
            </CardContent>
          </Card>
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
