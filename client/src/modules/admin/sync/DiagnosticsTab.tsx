import React, { useEffect, useState } from 'react';
import { cn } from '../../../utils/cn';
import {
  Alert,
  AlertDescription,
  Skeleton,
  Card,
  CardContent,
  Separator,
} from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import {
  Hub,
  CheckCircle,
  HealthAndSafety,
  HourglassEmpty,
  ErrorOutline,
  Schedule,
} from '../../../icons';
import StatTile from '../../../components/baitly/StatTile';
import { syncAdminApi, DiagnosticsSummary, MetricsSnapshot } from '../../../services/api/syncAdminApi';

/** Label overline d'entête de carte — échelle Baitly UI. */
const OVERLINE_CLASS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground';

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
      <div className="grid grid-cols-12 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2" key={i}>
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <Alert variant="destructive" className="mb-3">
      <TriangleAlert />
      <AlertDescription>{error}</AlertDescription>
    </Alert>;
  }

  return (
    <div>
      {/* Diagnostics Summary — StatTile (carte plate hairline, valeur display) */}
      {diagnostics && (
        <>
          <h6 className="text-sm font-semibold text-foreground mb-[0.35em]">
            Vue d'ensemble
          </h6>
          <div className="grid grid-cols-12 gap-3 mb-[18px]">
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <StatTile icon={<Hub />} label="Total Connexions" value={diagnostics.totalConnections} iconClassName="text-primary" />
            </div>
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <StatTile icon={<CheckCircle />} label="Actives" value={diagnostics.activeConnections} iconClassName="text-success" />
            </div>
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <StatTile icon={<HealthAndSafety />} label="Healthy" value={diagnostics.healthyConnections} iconClassName="text-success" />
            </div>
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <StatTile icon={<HourglassEmpty />} label="Outbox Pending" value={diagnostics.pendingOutbox} iconClassName="text-info" />
            </div>
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <StatTile icon={<ErrorOutline />} label="Outbox Failed" value={diagnostics.failedOutbox} iconClassName="text-destructive" />
            </div>
            <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2">
              <StatTile
                icon={<Schedule />}
                label="Oldest Pending"
                value={
                  diagnostics.oldestPendingEvent
                    ? new Date(diagnostics.oldestPendingEvent).toLocaleString()
                    : '—'
                }
                iconClassName="text-warning"
              />
            </div>
          </div>

          {/* Sync logs by status */}
          {Object.keys(diagnostics.syncLogsByStatus).length > 0 && (
            <Card className="mb-[18px]">
              <CardContent>
                <p className={cn(OVERLINE_CLASS, 'mb-1.5')}>
                  Sync Logs par Status
                </p>
                <div className="grid grid-cols-12 gap-1.5">
                  {Object.entries(diagnostics.syncLogsByStatus).map(([status, count]) => (
                    <div className="col-span-6 min-[600px]:col-span-3" key={status}>
                      <p className="text-xs tabular-nums">
                        <strong>{status}:</strong> {count}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Separator className="my-[18px]" />

      {/* Metrics */}
      {metrics && (
        <>
          <h6 className="text-sm font-semibold text-foreground mb-[0.35em]">
            Metriques
          </h6>
          <div className="grid grid-cols-12 gap-3">
            {/* Latency P95 */}
            <div className="col-span-12 min-[900px]:col-span-4">
              <Card>
                <CardContent>
                  <p className={cn(OVERLINE_CLASS, 'mb-1.5')}>
                    Sync Latency P95 (ms)
                  </p>
                  {Object.keys(metrics.syncLatencyP95).length > 0 ? (
                    Object.entries(metrics.syncLatencyP95).map(([channel, latency]) => (
                      <p className="text-xs tabular-nums" key={channel}>
                        {channel}: <strong>{latency}ms</strong>
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucune donnee</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Success / Failure counts */}
            <div className="col-span-12 min-[900px]:col-span-4">
              <Card>
                <CardContent>
                  <p className={cn(OVERLINE_CLASS, 'mb-1.5')}>
                    Sync Success / Failure
                  </p>
                  {Object.keys(metrics.syncSuccessCount).length > 0 || Object.keys(metrics.syncFailureCount).length > 0 ? (
                    <>
                      {/* Encre `-ink` : la teinte vive plafonne à ~2,2:1 sur une carte claire. */}
                      {Object.entries(metrics.syncSuccessCount).map(([channel, count]) => (
                        <p className="text-xs text-success-ink tabular-nums" key={`s-${channel}`}>
                          {channel} success: {count}
                        </p>
                      ))}
                      {Object.entries(metrics.syncFailureCount).map(([channel, count]) => (
                        <p className="text-xs text-destructive-ink tabular-nums" key={`f-${channel}`}>
                          {channel} failure: {count}
                        </p>
                      ))}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucune donnee</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Calendar stats */}
            <div className="col-span-12 min-[900px]:col-span-4">
              <Card>
                <CardContent>
                  <p className={cn(OVERLINE_CLASS, 'mb-1.5')}>
                    Calendrier
                  </p>
                  <p className="text-xs tabular-nums">
                    Conflits: <strong>{metrics.calendarConflicts}</strong>
                  </p>
                  <p className="text-xs tabular-nums">
                    Double bookings bloques: <strong>{metrics.doubleBookingsPrevented}</strong>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DiagnosticsTab;
