import React, { useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  Alert,
  Typography,
  Grid,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { syncAdminApi, DiagnosticsSummary, MetricsSnapshot } from '../../../services/api/syncAdminApi';

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
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>;
  }

  return (
    <Box>
      {/* Diagnostics Summary */}
      {diagnostics && (
        <>
          <Typography variant="h6" gutterBottom>
            Vue d'ensemble
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4} md={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Total Connexions</Typography>
                  <Typography variant="h4">{diagnostics.totalConnections}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Actives</Typography>
                  <Typography variant="h4" color="success.main">{diagnostics.activeConnections}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Healthy</Typography>
                  <Typography variant="h4" color="success.main">{diagnostics.healthyConnections}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Outbox Pending</Typography>
                  <Typography variant="h4" color="info.main">{diagnostics.pendingOutbox}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Outbox Failed</Typography>
                  <Typography variant="h4" color="error.main">{diagnostics.failedOutbox}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">Oldest Pending</Typography>
                  <Typography variant="body2">
                    {diagnostics.oldestPendingEvent
                      ? new Date(diagnostics.oldestPendingEvent).toLocaleString()
                      : '—'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Sync logs by status */}
          {Object.keys(diagnostics.syncLogsByStatus).length > 0 && (
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Sync Logs par Status
                </Typography>
                <Grid container spacing={1}>
                  {Object.entries(diagnostics.syncLogsByStatus).map(([status, count]) => (
                    <Grid item xs={6} sm={3} key={status}>
                      <Typography variant="body2">
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
          <Typography variant="h6" gutterBottom>
            Metriques
          </Typography>
          <Grid container spacing={2}>
            {/* Latency P95 */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Sync Latency P95 (ms)
                  </Typography>
                  {Object.keys(metrics.syncLatencyP95).length > 0 ? (
                    Object.entries(metrics.syncLatencyP95).map(([channel, latency]) => (
                      <Typography key={channel} variant="body2">
                        {channel}: <strong>{latency}ms</strong>
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">Aucune donnee</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Success / Failure counts */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Sync Success / Failure
                  </Typography>
                  {Object.keys(metrics.syncSuccessCount).length > 0 || Object.keys(metrics.syncFailureCount).length > 0 ? (
                    <>
                      {Object.entries(metrics.syncSuccessCount).map(([channel, count]) => (
                        <Typography key={`s-${channel}`} variant="body2" color="success.main">
                          {channel} success: {count}
                        </Typography>
                      ))}
                      {Object.entries(metrics.syncFailureCount).map(([channel, count]) => (
                        <Typography key={`f-${channel}`} variant="body2" color="error.main">
                          {channel} failure: {count}
                        </Typography>
                      ))}
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">Aucune donnee</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Calendar stats */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Calendrier
                  </Typography>
                  <Typography variant="body2">
                    Conflits: <strong>{metrics.calendarConflicts}</strong>
                  </Typography>
                  <Typography variant="body2">
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
