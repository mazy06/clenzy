/* ============================================================
   <AgentDrawer> — détail d'un agent (ventilation par logement)

   Ouvert au clic d'un satellite. En vue d'ensemble : la « ventilation »
   = répartition de l'activité de l'agent par logement (openPortfolioAgent).
   ============================================================ */

import { Drawer, Box, Typography, IconButton } from '@mui/material';
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
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                background: meta.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AgentIcon token={meta.icon} size={20} />
            </Box>
            <div className="flex-1 min-w-0">
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: 'var(--ink, #1b2240)' }}>{t(meta.nameKey)}</Typography>
              <Typography sx={{ fontSize: 12, color: 'var(--muted, #6b7196)' }}>{t(meta.roleKey)}</Typography>
            </div>
            <IconButton onClick={onClose} size="small" aria-label={t('supervision.states.retry')}>
              <Close size={18} />
            </IconButton>
          </div>

          <div className="flex items-center gap-1 mb-2">
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: STATUS[detail.status].color }} />
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
                  <Box
                    key={`${item.propertyId}-${item.task}`}
                    sx={{ display: 'flex', gap: 1, p: 1, borderRadius: '10px', bgcolor: 'var(--surface-2, #f6f7fb)' }}
                  >
                    <Box sx={{ color: 'var(--muted, #6b7196)', mt: '2px' }}>
                      <HomeWork size={15} />
                    </Box>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink, #1b2240)' }}>{item.propertyName}</Typography>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: STATUS[item.status].color }} />
                        <Typography sx={{ fontSize: 11, color: 'var(--muted, #6b7196)' }}>{t(STATUS[item.status].labelKey)}</Typography>
                      </div>
                      <Typography sx={{ fontSize: 12, color: 'var(--body, #3a3f5a)', lineHeight: 1.4 }}>{item.task}</Typography>
                    </div>
                  </Box>
                ))}
              </div>
            </>
          ) : detail.metrics && detail.metrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5">
              {detail.metrics.map((metric) => (
                <Box key={metric.label} sx={{ p: 1.25, borderRadius: '10px', bgcolor: 'var(--surface-2, #f6f7fb)' }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'var(--ink, #1b2240)', fontVariantNumeric: 'tabular-nums' }}>
                    {metric.value}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'var(--muted, #6b7196)' }}>{metric.label}</Typography>
                </Box>
              ))}
            </div>
          ) : (
            <Typography sx={{ fontSize: 12.5, color: 'var(--muted, #6b7196)' }}>{t('supervision.drawer.noActivity')}</Typography>
          )}

          {/* Agent Réputation (vue par logement) : brouillons de réponse d'avis à valider (REP). */}
          {detail.id === 'rep' && propertyId != null && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid var(--line, #e6e8ef)' }}>
              <SupervisionReviewDrafts propertyId={Number(propertyId)} />
            </Box>
          )}
        </div>
      )}
    </Drawer>
  );
}
