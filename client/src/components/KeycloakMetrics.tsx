import React, { useState, useEffect } from 'react';
import StatusChip from './StatusChip';
import { Alert as UiAlert, AlertDescription } from './ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from './ui';
import { Card, CardContent, Grid, Alert, Button, IconButton, Tooltip, LinearProgress } from '@mui/material';
import { cn } from '../utils/cn';
import {
  TrendingUp,
  Refresh,
  Group,
  Security,
  Wifi,
  BugReport,
} from '../icons';
import { monitoringApi } from '../services/api/monitoringApi';
import type { KeycloakMetricsResponse, TestCoverageMetrics } from '../services/api/monitoringApi';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';

/** Chip -soft : texte couleur + fond -soft (pilule/typo via theme global MuiChip) */

const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };
const INFO_TOKEN = { fg: 'var(--info)', bg: 'var(--info-soft)' };

// Niveau semantique → token couleur (texte des grosses valeurs + chips)
const SEM_TOKEN: Record<'success' | 'warning' | 'error', { fg: string; bg: string }> = {
  success: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  warning: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  error: { fg: 'var(--err)', bg: 'var(--err-soft)' },
};

/** Grosse valeur de carte : display + tabular-nums (pattern StatTile) */
const DISPLAY_VALUE_CLASS = 'font-[family-name:var(--font-display)] tabular-nums';

const getStatusColor = (value: number, threshold: number) => {
  if (value <= threshold * 0.7) return 'success';
  if (value <= threshold) return 'warning';
  return 'error';
};

const getPerformanceColor = (value: number, isLowerBetter = false) => {
  if (isLowerBetter) {
    return value <= 100 ? 'success' : value <= 200 ? 'warning' : 'error';
  }
  return value >= 90 ? 'success' : value >= 70 ? 'warning' : 'error';
};

const getCoverageColor = (percent: number): 'success' | 'warning' | 'error' => {
  if (percent >= 80) return 'success';
  if (percent >= 60) return 'warning';
  return 'error';
};

const KeycloakMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<KeycloakMetricsResponse | null>(null);
  const [coverage, setCoverage] = useState<TestCoverageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, coverageData] = await Promise.all([
        monitoringApi.getKeycloakMetrics(),
        monitoringApi.getTestCoverage().catch(() => null),
      ]);
      setMetrics(metricsData);
      setCoverage(coverageData);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Erreur lors de la récupération des métriques plateforme');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleRefresh = () => {
    fetchMetrics();
  };

  // Register page-header actions and last-update timestamp.
  useEffect(() => {
    setHeaderActions(
      <Tooltip title="Actualiser les métriques">
        <IconButton onClick={handleRefresh} size="small">
          <Refresh size={20} strokeWidth={1.75} />
        </IconButton>
      </Tooltip>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  useEffect(() => {
    setHeaderLastUpdate(lastUpdate);
  }, [setHeaderLastUpdate, lastUpdate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={handleRefresh}>
          Réessayer
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  if (!metrics) {
    return (
      <UiAlert variant="warning">
        <TriangleAlert />
        <AlertDescription>Aucune donnée de métriques disponible</AlertDescription>
      </UiAlert>
    );
  }

  return (
    <div>
      <Grid container spacing={3}>
        {/* Utilisateurs */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <h6 className="cn-text-h6 mb-[0.35em] flex items-center">
                <span className="inline-flex me-1.5 text-[var(--accent)]"><Group size={20} strokeWidth={1.75} /></span>
                Utilisateurs
              </h6>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <div className="text-center">
                    <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS, 'text-[var(--ink)]')}>
                      {metrics.users.total}
                    </h4>
                    <p className="cn-text-body2 text-muted-foreground">
                      Total
                    </p>
                  </div>
                </Grid>
                <Grid item xs={6}>
                  <div className="text-center">
                    <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS, 'text-[var(--ok)]')}>
                      {metrics.users.active}
                    </h4>
                    <p className="cn-text-body2 text-muted-foreground">
                      Actifs
                    </p>
                  </div>
                </Grid>
                <Grid item xs={12}>
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusChip tokens={{ color: INFO_TOKEN.fg, bg: INFO_TOKEN.bg }} label={`${metrics.users.newThisWeek} nouveaux`} icon={<TrendingUp size={16} strokeWidth={1.75} />} />
                    <StatusChip tokens={{ color: NEUTRAL_TOKEN.fg, bg: NEUTRAL_TOKEN.bg }} label={`${metrics.users.inactive} inactifs`} />
                  </div>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Sessions / Tokens */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <h6 className="cn-text-h6 mb-[0.35em] flex items-center">
                <span className="inline-flex me-1.5 text-[var(--accent)]"><Wifi size={20} strokeWidth={1.75} /></span>
                Tokens JWT
              </h6>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <div className="text-center">
                    <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS, 'text-[var(--ink)]')}>
                      {metrics.sessions.totalTokens}
                    </h4>
                    <p className="cn-text-body2 text-muted-foreground">
                      Total traités
                    </p>
                  </div>
                </Grid>
                <Grid item xs={6}>
                  <div className="text-center">
                    <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS, 'text-[var(--ok)]')}>
                      {metrics.sessions.validTokens}
                    </h4>
                    <p className="cn-text-body2 text-muted-foreground">
                      Valides
                    </p>
                  </div>
                </Grid>
                <Grid item xs={12}>
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusChip tokens={{ color: INFO_TOKEN.fg, bg: INFO_TOKEN.bg }} label={`${metrics.sessions.cacheHits} cache hits`} />
                    <StatusChip tokens={{ color: NEUTRAL_TOKEN.fg, bg: NEUTRAL_TOKEN.bg }} label={`${metrics.sessions.revokedTokens} révoqués`} />
                  </div>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <h6 className="cn-text-h6 mb-[0.35em] flex items-center">
                <span className="inline-flex me-1.5 text-[var(--accent)]"><TrendingUp size={20} strokeWidth={1.75} /></span>
                Performance API
              </h6>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <div className="text-center">
                    {/* Couleur calculee a l'execution : style inline, une classe Tailwind ne peut pas naitre d'une variable */}
                    <h6 className={cn('cn-text-h6', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getPerformanceColor(metrics.performance.avgResponseTimeMs, true)].fg }}>
                      {metrics.performance.avgResponseTimeMs}ms
                    </h6>
                    <p className="cn-text-body2 text-muted-foreground">
                      Temps de réponse moy.
                    </p>
                  </div>
                </Grid>
                <Grid item xs={6}>
                  <div className="text-center">
                    <h6 className={cn('cn-text-h6', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getPerformanceColor(metrics.performance.uptimePercent)].fg }}>
                      {metrics.performance.uptimePercent}%
                    </h6>
                    <p className="cn-text-body2 text-muted-foreground">
                      Uptime
                    </p>
                  </div>
                </Grid>
                <Grid item xs={12}>
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusChip tokens={{ color: INFO_TOKEN.fg, bg: INFO_TOKEN.bg }} label={`${metrics.performance.totalRequests} requêtes`} />
                    <StatusChip tokens={{ color: SEM_TOKEN[getPerformanceColor(100 - metrics.performance.errorRate)].fg, bg: SEM_TOKEN[getPerformanceColor(100 - metrics.performance.errorRate)].bg }} label={`${metrics.performance.errorRate}% erreurs`} />
                  </div>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Sécurité */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <h6 className="cn-text-h6 mb-[0.35em] flex items-center">
                <span className="inline-flex me-1.5 text-[var(--accent)]"><Security size={20} strokeWidth={1.75} /></span>
                Sécurité (7 derniers jours)
              </h6>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <div className="text-center">
                    <h6 className={cn('cn-text-h6', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getStatusColor(metrics.security.failedLogins, 20)].fg }}>
                      {metrics.security.failedLogins}
                    </h6>
                    <p className="cn-text-body2 text-muted-foreground">
                      Échecs de connexion
                    </p>
                  </div>
                </Grid>
                <Grid item xs={6}>
                  <div className="text-center">
                    <h6 className={cn('cn-text-h6', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getStatusColor(metrics.security.permissionDenied, 10)].fg }}>
                      {metrics.security.permissionDenied}
                    </h6>
                    <p className="cn-text-body2 text-muted-foreground">
                      Accès refusés
                    </p>
                  </div>
                </Grid>
                <Grid item xs={12}>
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusChip tokens={{ color: SEM_TOKEN[metrics.security.suspiciousActivity > 0 ? 'warning' : 'success'].fg, bg: SEM_TOKEN[metrics.security.suspiciousActivity > 0 ? 'warning' : 'success'].bg }} label={`${metrics.security.suspiciousActivity} activité suspecte`} />
                    {metrics.security.lastIncident && (
                      <StatusChip tokens={{ color: NEUTRAL_TOKEN.fg, bg: NEUTRAL_TOKEN.bg }} label={`Dernier incident: ${new Date(metrics.security.lastIncident).toLocaleString()}`} />
                    )}
                  </div>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        {/* Couverture de tests */}
        {coverage && coverage.available && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <h6 className="cn-text-h6 mb-[0.35em] flex items-center">
                  <span className="inline-flex me-1.5 text-[var(--accent)]"><BugReport size={20} strokeWidth={1.75} /></span>
                  Couverture de Tests
                  {coverage.reportDate && (
                    <StatusChip tokens={{ color: NEUTRAL_TOKEN.fg, bg: NEUTRAL_TOKEN.bg }} label={`Rapport du ${new Date(coverage.reportDate).toLocaleDateString()}`} className="ms-3" />
                  )}
                </h6>
                <Grid container spacing={3}>
                  {/* Lignes */}
                  {coverage.linePercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.linePercent)].fg }}>
                          {coverage.linePercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Lignes
                        </p>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.linePercent, 100)}
                          color={getCoverageColor(coverage.linePercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.lineCovered}/{coverage.lineTotal}
                        </span>
                      </div>
                    </Grid>
                  )}
                  {/* Branches */}
                  {coverage.branchPercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.branchPercent)].fg }}>
                          {coverage.branchPercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Branches
                        </p>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.branchPercent, 100)}
                          color={getCoverageColor(coverage.branchPercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.branchCovered}/{coverage.branchTotal}
                        </span>
                      </div>
                    </Grid>
                  )}
                  {/* Instructions */}
                  {coverage.instructionPercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.instructionPercent)].fg }}>
                          {coverage.instructionPercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Instructions
                        </p>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.instructionPercent, 100)}
                          color={getCoverageColor(coverage.instructionPercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.instructionCovered}/{coverage.instructionTotal}
                        </span>
                      </div>
                    </Grid>
                  )}
                  {/* Méthodes */}
                  {coverage.methodPercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.methodPercent)].fg }}>
                          {coverage.methodPercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Méthodes
                        </p>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.methodPercent, 100)}
                          color={getCoverageColor(coverage.methodPercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.methodCovered}/{coverage.methodTotal}
                        </span>
                      </div>
                    </Grid>
                  )}
                  {/* Classes */}
                  {coverage.classPercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.classPercent)].fg }}>
                          {coverage.classPercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Classes
                        </p>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.classPercent, 100)}
                          color={getCoverageColor(coverage.classPercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.classCovered}/{coverage.classTotal}
                        </span>
                      </div>
                    </Grid>
                  )}
                  {/* Complexité */}
                  {coverage.complexityPercent != null && (
                    <Grid item xs={12} sm={6} md={2}>
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.complexityPercent)].fg }}>
                          {coverage.complexityPercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Complexité
                        </p>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(coverage.complexityPercent, 100)}
                          color={getCoverageColor(coverage.complexityPercent)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.complexityCovered}/{coverage.complexityTotal}
                        </span>
                      </div>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Message si couverture non disponible */}
        {coverage && !coverage.available && (
          <Grid item xs={12}>
            <Alert severity="info" icon={<BugReport size={20} strokeWidth={1.75} />}>
              {coverage.message || 'Rapport de couverture non disponible. Lancez les tests pour le générer.'}
            </Alert>
          </Grid>
        )}
      </Grid>
    </div>
  );
};

export default KeycloakMetrics;
