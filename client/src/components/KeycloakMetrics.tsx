import React, { useState, useEffect } from 'react';
import StatusChip from './StatusChip';
import {
  Alert as UiAlert,
  AlertAction,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Progress,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui';
import { TriangleAlert } from 'lucide-react';
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

/**
 * Barre de couverture : la teinte depend du niveau atteint. Les trois branches sont
 * ecrites en litteral — une classe Tailwind ne peut pas naitre d'une variable.
 */
const COVERAGE_BAR_CLASS: Record<'success' | 'warning' | 'error', string> = {
  success: 'h-1.5 [&>[data-slot=progress-indicator]]:bg-[var(--ok)]',
  warning: 'h-1.5 [&>[data-slot=progress-indicator]]:bg-[var(--warn)]',
  error: 'h-1.5 [&>[data-slot=progress-indicator]]:bg-[var(--err)]',
};

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
      <Tooltip>
        {/* Radix pose sa ref d'ancrage sur l'enfant : un <span> hote, le Button
            du kit etant une fonction qui ne transmet pas de ref (React 18). */}
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button variant="ghost" size="icon-sm" onClick={handleRefresh} aria-label="Actualiser les métriques">
              <Refresh size={20} strokeWidth={1.75} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Actualiser les métriques</TooltipContent>
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

  // `outline` et non `ghost` pour le bouton d'action : pose sur le fond teinte de
  // l'alerte, un bouton sans cadre disparaitrait.
  if (error) {
    return (
      <UiAlert variant="destructive">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Réessayer
          </Button>
        </AlertAction>
      </UiAlert>
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
      <div className="grid grid-cols-12 gap-[18px]">
        {/* Utilisateurs */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card>
            <CardContent>
              <h6 className="cn-text-h6 mb-[0.35em] flex items-center">
                <span className="inline-flex me-1.5 text-[var(--accent)]"><Group size={20} strokeWidth={1.75} /></span>
                Utilisateurs
              </h6>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <div className="text-center">
                    <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS, 'text-[var(--ink)]')}>
                      {metrics.users.total}
                    </h4>
                    <p className="cn-text-body2 text-muted-foreground">
                      Total
                    </p>
                  </div>
                </div>
                <div className="col-span-6">
                  <div className="text-center">
                    <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS, 'text-[var(--ok)]')}>
                      {metrics.users.active}
                    </h4>
                    <p className="cn-text-body2 text-muted-foreground">
                      Actifs
                    </p>
                  </div>
                </div>
                <div className="col-span-12">
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusChip tokens={{ color: INFO_TOKEN.fg, bg: INFO_TOKEN.bg }} label={`${metrics.users.newThisWeek} nouveaux`} icon={<TrendingUp size={16} strokeWidth={1.75} />} />
                    <StatusChip tokens={{ color: NEUTRAL_TOKEN.fg, bg: NEUTRAL_TOKEN.bg }} label={`${metrics.users.inactive} inactifs`} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions / Tokens */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card>
            <CardContent>
              <h6 className="cn-text-h6 mb-[0.35em] flex items-center">
                <span className="inline-flex me-1.5 text-[var(--accent)]"><Wifi size={20} strokeWidth={1.75} /></span>
                Tokens JWT
              </h6>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <div className="text-center">
                    <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS, 'text-[var(--ink)]')}>
                      {metrics.sessions.totalTokens}
                    </h4>
                    <p className="cn-text-body2 text-muted-foreground">
                      Total traités
                    </p>
                  </div>
                </div>
                <div className="col-span-6">
                  <div className="text-center">
                    <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS, 'text-[var(--ok)]')}>
                      {metrics.sessions.validTokens}
                    </h4>
                    <p className="cn-text-body2 text-muted-foreground">
                      Valides
                    </p>
                  </div>
                </div>
                <div className="col-span-12">
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusChip tokens={{ color: INFO_TOKEN.fg, bg: INFO_TOKEN.bg }} label={`${metrics.sessions.cacheHits} cache hits`} />
                    <StatusChip tokens={{ color: NEUTRAL_TOKEN.fg, bg: NEUTRAL_TOKEN.bg }} label={`${metrics.sessions.revokedTokens} révoqués`} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card>
            <CardContent>
              <h6 className="cn-text-h6 mb-[0.35em] flex items-center">
                <span className="inline-flex me-1.5 text-[var(--accent)]"><TrendingUp size={20} strokeWidth={1.75} /></span>
                Performance API
              </h6>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <div className="text-center">
                    {/* Couleur calculee a l'execution : style inline, une classe Tailwind ne peut pas naitre d'une variable */}
                    <h6 className={cn('cn-text-h6', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getPerformanceColor(metrics.performance.avgResponseTimeMs, true)].fg }}>
                      {metrics.performance.avgResponseTimeMs}ms
                    </h6>
                    <p className="cn-text-body2 text-muted-foreground">
                      Temps de réponse moy.
                    </p>
                  </div>
                </div>
                <div className="col-span-6">
                  <div className="text-center">
                    <h6 className={cn('cn-text-h6', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getPerformanceColor(metrics.performance.uptimePercent)].fg }}>
                      {metrics.performance.uptimePercent}%
                    </h6>
                    <p className="cn-text-body2 text-muted-foreground">
                      Uptime
                    </p>
                  </div>
                </div>
                <div className="col-span-12">
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusChip tokens={{ color: INFO_TOKEN.fg, bg: INFO_TOKEN.bg }} label={`${metrics.performance.totalRequests} requêtes`} />
                    <StatusChip tokens={{ color: SEM_TOKEN[getPerformanceColor(100 - metrics.performance.errorRate)].fg, bg: SEM_TOKEN[getPerformanceColor(100 - metrics.performance.errorRate)].bg }} label={`${metrics.performance.errorRate}% erreurs`} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sécurité */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card>
            <CardContent>
              <h6 className="cn-text-h6 mb-[0.35em] flex items-center">
                <span className="inline-flex me-1.5 text-[var(--accent)]"><Security size={20} strokeWidth={1.75} /></span>
                Sécurité (7 derniers jours)
              </h6>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <div className="text-center">
                    <h6 className={cn('cn-text-h6', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getStatusColor(metrics.security.failedLogins, 20)].fg }}>
                      {metrics.security.failedLogins}
                    </h6>
                    <p className="cn-text-body2 text-muted-foreground">
                      Échecs de connexion
                    </p>
                  </div>
                </div>
                <div className="col-span-6">
                  <div className="text-center">
                    <h6 className={cn('cn-text-h6', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getStatusColor(metrics.security.permissionDenied, 10)].fg }}>
                      {metrics.security.permissionDenied}
                    </h6>
                    <p className="cn-text-body2 text-muted-foreground">
                      Accès refusés
                    </p>
                  </div>
                </div>
                <div className="col-span-12">
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusChip tokens={{ color: SEM_TOKEN[metrics.security.suspiciousActivity > 0 ? 'warning' : 'success'].fg, bg: SEM_TOKEN[metrics.security.suspiciousActivity > 0 ? 'warning' : 'success'].bg }} label={`${metrics.security.suspiciousActivity} activité suspecte`} />
                    {metrics.security.lastIncident && (
                      <StatusChip tokens={{ color: NEUTRAL_TOKEN.fg, bg: NEUTRAL_TOKEN.bg }} label={`Dernier incident: ${new Date(metrics.security.lastIncident).toLocaleString()}`} />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Couverture de tests */}
        {coverage && coverage.available && (
          <div className="col-span-12">
            <Card>
              <CardContent>
                <h6 className="cn-text-h6 mb-[0.35em] flex items-center">
                  <span className="inline-flex me-1.5 text-[var(--accent)]"><BugReport size={20} strokeWidth={1.75} /></span>
                  Couverture de Tests
                  {coverage.reportDate && (
                    <StatusChip tokens={{ color: NEUTRAL_TOKEN.fg, bg: NEUTRAL_TOKEN.bg }} label={`Rapport du ${new Date(coverage.reportDate).toLocaleDateString()}`} className="ms-3" />
                  )}
                </h6>
                <div className="grid grid-cols-12 gap-[18px]">
                  {/* Lignes */}
                  {coverage.linePercent != null && (
                    <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-2">
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.linePercent)].fg }}>
                          {coverage.linePercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Lignes
                        </p>
                        <Progress
                          value={Math.min(coverage.linePercent, 100)}
                          className={COVERAGE_BAR_CLASS[getCoverageColor(coverage.linePercent)]}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.lineCovered}/{coverage.lineTotal}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Branches */}
                  {coverage.branchPercent != null && (
                    <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-2">
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.branchPercent)].fg }}>
                          {coverage.branchPercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Branches
                        </p>
                        <Progress
                          value={Math.min(coverage.branchPercent, 100)}
                          className={COVERAGE_BAR_CLASS[getCoverageColor(coverage.branchPercent)]}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.branchCovered}/{coverage.branchTotal}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Instructions */}
                  {coverage.instructionPercent != null && (
                    <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-2">
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.instructionPercent)].fg }}>
                          {coverage.instructionPercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Instructions
                        </p>
                        <Progress
                          value={Math.min(coverage.instructionPercent, 100)}
                          className={COVERAGE_BAR_CLASS[getCoverageColor(coverage.instructionPercent)]}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.instructionCovered}/{coverage.instructionTotal}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Méthodes */}
                  {coverage.methodPercent != null && (
                    <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-2">
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.methodPercent)].fg }}>
                          {coverage.methodPercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Méthodes
                        </p>
                        <Progress
                          value={Math.min(coverage.methodPercent, 100)}
                          className={COVERAGE_BAR_CLASS[getCoverageColor(coverage.methodPercent)]}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.methodCovered}/{coverage.methodTotal}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Classes */}
                  {coverage.classPercent != null && (
                    <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-2">
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.classPercent)].fg }}>
                          {coverage.classPercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Classes
                        </p>
                        <Progress
                          value={Math.min(coverage.classPercent, 100)}
                          className={COVERAGE_BAR_CLASS[getCoverageColor(coverage.classPercent)]}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.classCovered}/{coverage.classTotal}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Complexité */}
                  {coverage.complexityPercent != null && (
                    <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-2">
                      <div className="text-center">
                        <h4 className={cn('cn-text-h4', DISPLAY_VALUE_CLASS)} style={{ color: SEM_TOKEN[getCoverageColor(coverage.complexityPercent)].fg }}>
                          {coverage.complexityPercent}%
                        </h4>
                        <p className="cn-text-body2 text-muted-foreground mb-[0.35em]">
                          Complexité
                        </p>
                        <Progress
                          value={Math.min(coverage.complexityPercent, 100)}
                          className={COVERAGE_BAR_CLASS[getCoverageColor(coverage.complexityPercent)]}
                        />
                        <span className="cn-text-caption text-muted-foreground">
                          {coverage.complexityCovered}/{coverage.complexityTotal}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Message si couverture non disponible */}
        {coverage && !coverage.available && (
          <div className="col-span-12">
            <UiAlert variant="info">
              <BugReport size={20} strokeWidth={1.75} />
              <AlertDescription>
                {coverage.message || 'Rapport de couverture non disponible. Lancez les tests pour le générer.'}
              </AlertDescription>
            </UiAlert>
          </div>
        )}
      </div>
    </div>
  );
};

export default KeycloakMetrics;
