/* ============================================================
   <AgentDrawer> — détail d'un agent (ventilation par logement)

   Ouvert au clic d'un satellite. En vue d'ensemble : la « ventilation »
   = répartition de l'activité de l'agent par logement (openPortfolioAgent).
   ============================================================ */

import { Drawer, Box, Typography, IconButton } from '@mui/material';
import { Close, HomeWork } from '../../../icons';
import { AGENT_META, STATUS } from '../constants';
import { AgentIcon } from '../renderers/agentIcon';
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

export function AgentDrawer({ open, detail, onClose }: { open: boolean; detail: AgentDetail | null; onClose: () => void }) {
  const { t } = useTranslation();
  const meta = detail ? AGENT_META[detail.id] : null;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 360, maxWidth: '90vw', p: 2.5 } }}>
      {detail && meta && (
        <Box data-agent-drawer>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
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
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: 'var(--ink, #1b2240)' }}>{t(meta.nameKey)}</Typography>
              <Typography sx={{ fontSize: 12, color: 'var(--muted, #6b7196)' }}>{t(meta.roleKey)}</Typography>
            </Box>
            <IconButton onClick={onClose} size="small" aria-label={t('supervision.states.retry')}>
              <Close size={18} />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: STATUS[detail.status].color }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink, #1b2240)' }}>
              {t(STATUS[detail.status].labelKey)}
            </Typography>
          </Box>

          {detail.task && (
            <Typography sx={{ fontSize: 13, color: 'var(--body, #3a3f5a)', lineHeight: 1.5, mb: 2 }}>{detail.task}</Typography>
          )}

          {detail.items.length > 0 ? (
            <>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted, #6b7196)', mb: 1 }}>
                {t('supervision.drawer.ventilation')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {detail.items.map((item) => (
                  <Box
                    key={`${item.propertyId}-${item.task}`}
                    sx={{ display: 'flex', gap: 1, p: 1, borderRadius: '10px', bgcolor: 'var(--surface-2, #f6f7fb)' }}
                  >
                    <Box sx={{ color: 'var(--muted, #6b7196)', mt: '2px' }}>
                      <HomeWork size={15} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink, #1b2240)' }}>{item.propertyName}</Typography>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: STATUS[item.status].color }} />
                        <Typography sx={{ fontSize: 11, color: 'var(--muted, #6b7196)' }}>{t(STATUS[item.status].labelKey)}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 12, color: 'var(--body, #3a3f5a)', lineHeight: 1.4 }}>{item.task}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          ) : detail.metrics && detail.metrics.length > 0 ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {detail.metrics.map((metric) => (
                <Box key={metric.label} sx={{ p: 1.25, borderRadius: '10px', bgcolor: 'var(--surface-2, #f6f7fb)' }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'var(--ink, #1b2240)', fontVariantNumeric: 'tabular-nums' }}>
                    {metric.value}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'var(--muted, #6b7196)' }}>{metric.label}</Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography sx={{ fontSize: 12.5, color: 'var(--muted, #6b7196)' }}>{t('supervision.drawer.noActivity')}</Typography>
          )}
        </Box>
      )}
    </Drawer>
  );
}
