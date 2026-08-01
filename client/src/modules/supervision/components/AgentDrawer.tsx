/* ============================================================
   <AgentDrawer> — détail d'un agent (ventilation par logement)

   Ouvert au clic d'un satellite. En vue d'ensemble : la « ventilation »
   = répartition de l'activité de l'agent par logement (openPortfolioAgent).
   ============================================================ */

import { Drawer, Typography, IconButton } from '@mui/material';
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
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 360, maxWidth: '90vw', p: 2.5 } }}>
      {detail && meta && (
        <div data-agent-drawer>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-[40px] h-[40px] rounded-[12px] text-[#fff] flex items-center justify-center shrink-0" style={{ background: meta.color }}>
              <AgentIcon token={meta.icon} size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: 'var(--ink, #1b2240)' }}>{t(meta.nameKey)}</Typography>
              <Typography sx={{ fontSize: 12, color: 'var(--muted, #6b7196)' }}>{t(meta.roleKey)}</Typography>
            </div>
            <IconButton onClick={onClose} size="small" aria-label={t('supervision.states.retry')}>
              <Close size={18} />
            </IconButton>
          </div>

          <div className="flex items-center gap-1 mb-2">
            <div className="w-[8px] h-[8px] rounded-[50%]" style={{ background: STATUS[detail.status].color }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink, #1b2240)' }}>
              {t(STATUS[detail.status].labelKey)}
            </Typography>
          </div>

          {detail.task && (
            <Typography sx={{ fontSize: 13, color: 'var(--body, #3a3f5a)', lineHeight: 1.5, mb: 2 }}>{detail.task}</Typography>
          )}

          {detail.items.length > 0 ? (
            <>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted, #6b7196)', mb: 1 }}>
                {t('supervision.drawer.ventilation')}
              </Typography>
              <div className="flex flex-col gap-1.5">
                {detail.items.map((item) => (
                  <div className="flex gap-1.5 p-1.5 rounded-[10px] bg-[var(--surface-2,_#f6f7fb)]" key={`${item.propertyId}-${item.task}`}>
                    <div className="text-[var(--muted,_#6b7196)] mt-0.5">
                      <HomeWork size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink, #1b2240)' }}>{item.propertyName}</Typography>
                        <div className="w-[6px] h-[6px] rounded-[50%]" style={{ background: STATUS[item.status].color }} />
                        <Typography sx={{ fontSize: 11, color: 'var(--muted, #6b7196)' }}>{t(STATUS[item.status].labelKey)}</Typography>
                      </div>
                      <Typography sx={{ fontSize: 12, color: 'var(--body, #3a3f5a)', lineHeight: 1.4 }}>{item.task}</Typography>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : detail.metrics && detail.metrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5">
              {detail.metrics.map((metric) => (
                <div className="p-[7.5px] rounded-[10px] bg-[var(--surface-2,_#f6f7fb)]" key={metric.label}>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'var(--ink, #1b2240)', fontVariantNumeric: 'tabular-nums' }}>
                    {metric.value}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'var(--muted, #6b7196)' }}>{metric.label}</Typography>
                </div>
              ))}
            </div>
          ) : (
            <Typography sx={{ fontSize: 12.5, color: 'var(--muted, #6b7196)' }}>{t('supervision.drawer.noActivity')}</Typography>
          )}

          {/* Agent Réputation (vue par logement) : brouillons de réponse d'avis à valider (REP). */}
          {detail.id === 'rep' && propertyId != null && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line, #e6e8ef)' }}>
              <SupervisionReviewDrafts propertyId={Number(propertyId)} />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
