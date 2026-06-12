import React, { useEffect, useState } from 'react';
import {
  Box,
  Skeleton,
  Alert,
  Typography,
  Grid,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  Hub,
  CheckCircle,
  HealthAndSafety,
  HourglassEmpty,
  ErrorOutline,
  Schedule,
} from '../../../icons';
import StatTile from '../../../components/StatTile';
import { syncAdminApi, DiagnosticsSummary, MetricsSnapshot } from '../../../services/api/syncAdminApi';

/** Label overline (pattern entête de tuile/section) */
const OVERLINE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
} as const;

const DiagnosticsTab: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSummary | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [diag, met] = await Promise.all([
          syncAdminApi.getDiagnostics(),
          syncAdminApi.getMetrics(),
        ]);
        setDiagnostics(diag);
        setMetrics(met);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des diagnostics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Grid item xs={6} sm={4} md={2} key={i}>
            <Skeleton variant="rounded" height={96} sx={{ borderRadius: '14px' }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>;
  }

  return (
    <Box>
      {/* Diagnostics Summary — StatTile (carte plate hairline, valeur display) */}
      {diagnostics && (
        <>
          <Typography variant="h6" gutterBottom sx={{ color: 'var(--ink)' }}>
            Vue d'ensemble
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4} md={2}>
              <StatTile icon={<Hub />} label="Total Connexions" value={diagnostics.totalConnections} color="#6B8A9A" />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <StatTile icon={<CheckCircle />} label="Actives" value={diagnostics.activeConnections} color="#4A9B8E" />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <StatTile icon={<HealthAndSafety />} label="Healthy" value={diagnostics.healthyConnections} color="#4A9B8E" />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <StatTile icon={<HourglassEmpty />} label="Outbox Pending" value={diagnostics.pendingOutbox} color="#7BA3C2" />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <StatTile icon={<ErrorOutline />} label="Outbox Failed" value={diagnostics.failedOutbox} color="#C97A7A" />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <StatTile
                icon={<Schedule />}
                label="Oldest Pending"
                value={
                  diagnostics.oldestPendingEvent
                    ? new Date(diagnostics.oldestPendingEvent).toLocaleString()
                    : '—'
                }
                color="#D4A574"
              />
            </Grid>
          </Grid>

          {/* Sync logs by status */}
          {Object.keys(diagnostics.syncLogsByStatus).length > 0 && (
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography sx={{ ...OVERLINE_SX, mb: 1 }}>
                  Sync Logs par Status
                </Typography>
                <Grid container spacing={1}>
                  {Object.entries(diagnostics.syncLogsByStatus).map(([status, count]) => (
                    <Grid item xs={6} sm={3} key={status}>
                      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        <strong>{status}:</strong> {count}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Metrics */}
      {metrics && (
        <>
          <Typography variant="h6" gutterBottom sx={{ color: 'var(--ink)' }}>
            Metriques
          </Typography>
          <Grid container spacing={2}>
            {/* Latency P95 */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography sx={{ ...OVERLINE_SX, mb: 1 }}>
                    Sync Latency P95 (ms)
                  </Typography>
                  {Object.keys(metrics.syncLatencyP95).length > 0 ? (
                    Object.entries(metrics.syncLatencyP95).map(([channel, latency]) => (
                      <Typography key={channel} variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {channel}: <strong>{latency}ms</strong>
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2" sx={{ color: 'var(--muted)' }}>Aucune donnee</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Success / Failure counts */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography sx={{ ...OVERLINE_SX, mb: 1 }}>
                    Sync Success / Failure
                  </Typography>
                  {Object.keys(metrics.syncSuccessCount).length > 0 || Object.keys(metrics.syncFailureCount).length > 0 ? (
                    <>
                      {Object.entries(metrics.syncSuccessCount).map(([channel, count]) => (
                        <Typography key={`s-${channel}`} variant="body2" sx={{ color: 'var(--ok)', fontVariantNumeric: 'tabular-nums' }}>
                          {channel} success: {count}
                        </Typography>
                      ))}
                      {Object.entries(metrics.syncFailureCount).map(([channel, count]) => (
                        <Typography key={`f-${channel}`} variant="body2" sx={{ color: 'var(--err)', fontVariantNumeric: 'tabular-nums' }}>
                          {channel} failure: {count}
                        </Typography>
                      ))}
                    </>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'var(--muted)' }}>Aucune donnee</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Calendar stats */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography sx={{ ...OVERLINE_SX, mb: 1 }}>
                    Calendrier
                  </Typography>
                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    Conflits: <strong>{metrics.calendarConflicts}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    Double bookings bloques: <strong>{metrics.doubleBookingsPrevented}</strong>
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default DiagnosticsTab;
