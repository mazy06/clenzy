/* ============================================================
   <AgentDrawer> — détail d'un agent (ventilation par logement)

   Ouvert au clic d'un satellite. En vue d'ensemble : la « ventilation »
   = répartition de l'activité de l'agent par logement (openPortfolioAgent).
   ============================================================ */

import { Button, Sheet, SheetContent, SheetDescription, SheetTitle } from '../../../components/ui';
import { Close, HomeWork } from '../../../icons';
import { AGENT_META, STATUS } from '../constants';
import { AgentIcon } from '../renderers/agentIcon';
import { SupervisionReviewDrafts } from './SupervisionReviewDrafts';
import { useTranslation } from '../../../hooks/useTranslation';
import type { AgentId, AgentMetric, AgentStatus, PortfolioAgentItem } from '../types';

export interface AgentDetail {
  id: AgentId;
  status: AgentStatus;
  task: string;
  /** Ventilation par logement (vue d'ensemble). */
  items: PortfolioAgentItem[];
  /** Métriques (vue par logement). */
  metrics?: AgentMetric[];
}

export function AgentDrawer({
  open,
  detail,
  onClose,
  propertyId,
}: {
  open: boolean;
  detail: AgentDetail | null;
  onClose: () => void;
  /** Logement courant (vue par logement) : active les brouillons de réponse d'avis pour l'agent Réputation. */
  propertyId?: number | string;
}) {
  const { t } = useTranslation();
  const meta = detail ? AGENT_META[detail.id] : null;

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* Le panneau porte deja son propre bouton Fermer dans l'en-tete. */}
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[360px] max-w-[90vw] p-[15px] gap-0 overflow-y-auto"
      >
      {detail && meta && (
        <div data-agent-drawer>
          <div className="flex items-center gap-2 mb-3">
            {/* Pastille d'identité de l'agent : teinte de marque en aplat doux +
                icône dans la teinte vive (§2.4 — aplat/icône, jamais du texte). */}
            <div
              className="size-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${meta.color}1F`, color: meta.color }}
            >
              <AgentIcon token={meta.icon} size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-sm font-semibold tracking-tight text-foreground">{t(meta.nameKey)}</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">{t(meta.roleKey)}</SheetDescription>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('supervision.states.retry')}>
              <Close size={18} />
            </Button>
          </div>

          <div className="flex items-center gap-1 mb-2">
            <div className="size-2 rounded-full shrink-0" style={{ background: STATUS[detail.status].color }} />
            <p className="m-0 text-xs font-medium text-foreground">
              {t(STATUS[detail.status].labelKey)}
            </p>
          </div>

          {detail.task && (
            <p className="m-0 mb-3 text-sm leading-relaxed text-foreground">{detail.task}</p>
          )}

          {detail.items.length > 0 ? (
            <>
              <p className="m-0 mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('supervision.drawer.ventilation')}
              </p>
              <div className="flex flex-col gap-1.5">
                {detail.items.map((item) => (
                  <div className="flex gap-1.5 p-1.5 rounded-md bg-muted" key={`${item.propertyId}-${item.task}`}>
                    <div className="mt-0.5 text-muted-foreground">
                      <HomeWork size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="m-0 text-xs font-semibold text-foreground">{item.propertyName}</p>
                        <div className="size-1.5 rounded-full shrink-0" style={{ background: STATUS[item.status].color }} />
                        <p className="m-0 text-2xs text-muted-foreground">{t(STATUS[item.status].labelKey)}</p>
                      </div>
                      <p className="m-0 text-xs leading-snug text-foreground">{item.task}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : detail.metrics && detail.metrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5">
              {detail.metrics.map((metric) => (
                <div className="p-2 rounded-md bg-muted" key={metric.label}>
                  <p className="m-0 text-base font-semibold text-foreground tabular-nums">
                    {metric.value}
                  </p>
                  <p className="m-0 text-2xs text-muted-foreground">{metric.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 text-xs text-muted-foreground">{t('supervision.drawer.noActivity')}</p>
          )}

          {/* Agent Réputation (vue par logement) : brouillons de réponse d'avis à valider (REP). */}
          {detail.id === 'rep' && propertyId != null && (
            <div className="mt-3 pt-3 border-t border-border">
              <SupervisionReviewDrafts propertyId={Number(propertyId)} />
            </div>
          )}
        </div>
      )}
      </SheetContent>
    </Sheet>
  );
}
