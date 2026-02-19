import React from 'react';
import { Box, Typography, Card, CardContent, Chip, Grid } from '@mui/material';
import {
  ErrorOutline, WarningAmber, InfoOutlined,
} from '@mui/icons-material';
import GridSection from './GridSection';
import { useTranslation } from '../../../hooks/useTranslation';
import type { BusinessAlert, AlertSeverity } from '../../../hooks/useAnalyticsEngine';

// ─── Constants ──────────────────────────────────────────────────────────────

const SEVERITY_ICONS: Record<AlertSeverity, React.ReactNode> = {
  critical: <ErrorOutline />,
  warning: <WarningAmber />,
  info: <InfoOutlined />,
};

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: '#C97A7A',
  warning: '#D4A574',
  info: '#6B8A9A',
};

const SEVERITY_BG: Record<AlertSeverity, string> = {
  critical: 'rgba(201, 122, 122, 0.08)',
  warning: 'rgba(212, 165, 116, 0.08)',
  info: 'rgba(107, 138, 154, 0.08)',
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: 'Critique',
  warning: 'Attention',
  info: 'Info',
};

const CARD_SX = {
  width: '100%',
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'text.secondary' },
} as const;

interface Props {
  data: BusinessAlert[] | null;
  loading: boolean;
}

const AnalyticsAlerts: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  const alerts = data || [];
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  return (
    <GridSection
      title={t('dashboard.analytics.alerts')}
      subtitle={t('dashboard.analytics.alertsDesc')}
      badge={criticalCount}
    >
      <Grid container spacing={1.5}>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{ ...CARD_SX, opacity: 0.5 }}>
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <Box sx={{ height: 60 }} />
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : alerts.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={CARD_SX}>
              <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 28,
                      height: 28,
                      borderRadius: 0.75,
                      bgcolor: 'rgba(74, 155, 142, 0.08)',
                      color: '#4A9B8E',
                      '& .MuiSvgIcon-root': { fontSize: 16 },
                    }}
                  >
                    <InfoOutlined />
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {t('dashboard.analytics.noAlerts')}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          alerts.map((alert) => (
            <Grid item xs={12} sm={6} md={4} key={alert.id}>
              <Card
                sx={{
                  ...CARD_SX,
                  borderLeft: `3px solid ${SEVERITY_COLORS[alert.severity]}`,
                }}
              >
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 28,
                        height: 28,
                        borderRadius: 0.75,
                        bgcolor: SEVERITY_BG[alert.severity],
                        color: SEVERITY_COLORS[alert.severity],
                        '& .MuiSvgIcon-root': { fontSize: 16 },
                      }}
                    >
                      {SEVERITY_ICONS[alert.severity]}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'text.primary',
                            lineHeight: 1.3,
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {alert.title}
                        </Typography>
                        <Chip
                          label={SEVERITY_LABELS[alert.severity]}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.5rem',
                            fontWeight: 700,
                            bgcolor: SEVERITY_BG[alert.severity],
                            color: SEVERITY_COLORS[alert.severity],
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      </Box>
                      <Typography
                        sx={{
                          fontSize: '0.625rem',
                          color: 'text.secondary',
                          lineHeight: 1.4,
                        }}
                      >
                        {alert.description}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Action */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <Typography
                      sx={{
                        fontSize: '0.5625rem',
                        fontWeight: 600,
                        color: SEVERITY_COLORS[alert.severity],
                        cursor: alert.route ? 'pointer' : 'default',
                        '&:hover': alert.route ? { textDecoration: 'underline' } : {},
                      }}
                    >
                      {alert.action}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>
    </GridSection>
  );
});

AnalyticsAlerts.displayName = 'AnalyticsAlerts';

export default AnalyticsAlerts;
