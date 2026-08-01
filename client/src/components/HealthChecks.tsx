import React, { useState, useEffect } from 'react';
import StatusChip from './StatusChip';
import {
  Alert,
  AlertAction,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Collapsible,
  CollapsibleContent,
  Progress,
  Separator,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Info,
  HealthAndSafety,
  Refresh,
  ExpandMore,
  ExpandLess,
  Wifi,
  Speed,
  Security,
  Storage as StorageIcon,
  Memory,
} from '../icons';
import { monitoringApi } from '../services/api/monitoringApi';
import type { HealthCheckService, SystemMetrics } from '../services/api/monitoringApi';
import StatTile from './StatTile';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';

/** Chip -soft : texte couleur + fond -soft (pilule/typo via theme global MuiChip) */

const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };

// Statut sante → tokens semantiques (UP --ok, DOWN --err, DEGRADED --warn)
const STATUS_TOKEN: Record<string, { fg: string; bg: string }> = {
  UP: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  DOWN: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  DEGRADED: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
};

const statusToken = (status: string) => STATUS_TOKEN[status] ?? NEUTRAL_TOKEN;

// Equivalents hex de la palette validee (requis par l'API StatTile)
const STATUS_HEX: Record<string, string> = {
  UP: '#4A9B8E',
  DOWN: '#C97A7A',
  DEGRADED: '#D4A574',
};

const statusHex = (status: string) => STATUS_HEX[status] ?? '#7BA3C2';

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'UP':
      return <span className="inline-flex text-[var(--ok)]"><CheckCircle size={20} strokeWidth={1.75} /></span>;
    case 'DOWN':
      return <span className="inline-flex text-[var(--err)]"><ErrorIcon size={20} strokeWidth={1.75} /></span>;
    case 'DEGRADED':
      return <span className="inline-flex text-[var(--warn)]"><Warning size={20} strokeWidth={1.75} /></span>;
    default:
      return <span className="inline-flex text-[var(--info)]"><Info size={20} strokeWidth={1.75} /></span>;
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'DATABASE':
      return <StorageIcon size={20} strokeWidth={1.75} />;
    case 'AUTHENTICATION':
      return <Security size={20} strokeWidth={1.75} />;
    case 'API':
      return <Speed size={20} strokeWidth={1.75} />;
    case 'CACHE':
      return <Memory size={20} strokeWidth={1.75} />;
    case 'STORAGE':
      return <StorageIcon size={20} strokeWidth={1.75} />;
    case 'NOTIFICATIONS':
      return <Info size={20} strokeWidth={1.75} />;
    case 'MONITORING':
      return <HealthAndSafety size={20} strokeWidth={1.75} />;
    case 'NETWORK':
      return <Wifi size={20} strokeWidth={1.75} />;
    default:
      return <Info size={20} strokeWidth={1.75} />;
  }
};

const responseTimeToken = (responseTime: number) => {
  if (responseTime <= 100) return STATUS_TOKEN.UP;
  if (responseTime <= 300) return STATUS_TOKEN.DEGRADED;
  return STATUS_TOKEN.DOWN;
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}j ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const HealthChecks: React.FC = () => {
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();

  // Poll 30 s via react-query : refetch immédiat au mount, pause automatique
  // quand l'onglet est caché (refetchIntervalInBackground=false par défaut) —
  // l'ancien setInterval brut tournait indéfiniment onglet caché.
  const {
    data,
    error: queryError,
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['monitoring', 'health'],
    queryFn: () => monitoringApi.getHealth(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const healthChecks: HealthCheckService[] = data?.services ?? [];
  const systemMetrics: SystemMetrics | null = data?.systemMetrics ?? null;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const loading = isFetching;
  const error = queryError ? 'Erreur lors de la récupération des vérifications de santé' : null;

  const handleRefresh = () => {
    void refetch();
  };

  // Register page-header actions + last-update timestamp.
  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-1.5">
        {loading && <Spinner className="size-4" />}
        <Tooltip>
          {/* Le declencheur Radix pose une ref : les primitives du kit sont des
              fonctions et n'en transmettent pas — d'ou le span intermediaire. */}
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Actualiser les vérifications"
                onClick={handleRefresh}
              >
                <Refresh size={20} strokeWidth={1.75} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Actualiser les vérifications</TooltipContent>
        </Tooltip>
      </div>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, loading]);

  useEffect(() => {
    setHeaderLastUpdate(lastUpdate);
  }, [setHeaderLastUpdate, lastUpdate]);

  const toggleExpanded = (checkName: string) => {
    const newExpanded = new Set(expandedChecks);
    if (newExpanded.has(checkName)) {
      newExpanded.delete(checkName);
    } else {
      newExpanded.add(checkName);
    }
    setExpandedChecks(newExpanded);
  };

  const overallStatus = healthChecks.length > 0 ?
    healthChecks.every(check => check.status === 'UP') ? 'UP' :
    healthChecks.some(check => check.status === 'DOWN') ? 'DOWN' : 'DEGRADED' : 'UNKNOWN';

  const criticalChecks = healthChecks.filter(check => check.critical);
  const criticalStatus = criticalChecks.length > 0 ?
    criticalChecks.every(check => check.status === 'UP') ? 'UP' :
    criticalChecks.some(check => check.status === 'DOWN') ? 'DOWN' : 'DEGRADED' : 'UNKNOWN';

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (error && healthChecks.length === 0) {
    return (
      <Alert variant="destructive">
        <ErrorIcon />
        <AlertDescription>{error}</AlertDescription>
        <AlertAction>
          {/* Action d'appoint dans un bandeau : ghost. `text-current` reprend
              l'encre du bandeau d'erreur. */}
          <Button variant="ghost" size="sm" className="text-current" onClick={handleRefresh}>
            Réessayer
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  return (
    <div>
      {/* Vue d'ensemble — StatTile (carte plate hairline, valeur display) */}
      <div className="grid grid-cols-12 gap-3 mb-[18px]">
        <div className="col-span-12 min-[600px]:col-span-6">
          <StatTile
            icon={<HealthAndSafety />}
            label="Statut Global"
            value={overallStatus}
            color={statusHex(overallStatus)}
            hint={`${healthChecks.filter(check => check.status === 'UP').length} sur ${healthChecks.length} services opérationnels`}
          />
        </div>
        <div className="col-span-12 min-[600px]:col-span-6">
          <StatTile
            icon={<Security />}
            label="Services Critiques"
            value={criticalStatus}
            color={statusHex(criticalStatus)}
            hint={`${criticalChecks.filter(check => check.status === 'UP').length} sur ${criticalChecks.length} services critiques opérationnels`}
          />
        </div>
      </div>

      {/* Métriques système — valeurs display tabular-nums + barres tokens */}
      {systemMetrics && (
        <Card className="mb-[18px]">
          <CardContent>
            <h6 className="cn-text-h6 mb-[0.35em] text-[var(--ink)]">
              Métriques Système
            </h6>
            <div className="grid grid-cols-12 gap-[18px]">
              {([
                { label: 'CPU', value: systemMetrics.cpuUsage, suffix: '%' },
                { label: `Mémoire (${systemMetrics.heapUsedMb}/${systemMetrics.heapMaxMb} MB)`, value: systemMetrics.memoryUsage, suffix: '%' },
                { label: 'Disque', value: systemMetrics.diskUsage, suffix: '%' },
              ] as const).map((metric) => {
                const barColor = metric.value > 80 ? 'var(--err)' : metric.value > 60 ? 'var(--warn)' : 'var(--accent)';
                return (
                  <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-2" key={metric.label}>
                    <div className="text-center">
                      <h6 className="cn-text-h6 font-[family-name:var(--font-display)] tabular-nums text-[var(--ink)]">
                        {metric.value}{metric.suffix}
                      </h6>
                      <p className="cn-text-body2 text-[var(--muted)]">
                        {metric.label}
                      </p>
                      {/* La teinte de la barre vient d'un seuil calcule a
                          l'execution : elle transite par une variable CSS, une
                          classe Tailwind ne pouvant pas naitre d'une valeur. */}
                      <Progress
                        value={Math.min(metric.value, 100)}
                        className="mt-1.5 [&>[data-slot=progress-indicator]]:bg-(--bar)"
                        style={{ '--bar': barColor } as React.CSSProperties}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
                <div className="text-center">
                  <h6 className="cn-text-h6 font-[family-name:var(--font-display)] tabular-nums text-[var(--ok)]">
                    {formatUptime(systemMetrics.uptimeSeconds)}
                  </h6>
                  <p className="cn-text-body2 text-[var(--muted)]">
                    Uptime JVM
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vérifications détaillées */}
      <Card>
        <CardContent>
          <h6 className="cn-text-h6 mb-[0.35em] text-[var(--ink)]">
            Vérifications Détaillées ({healthChecks.length} services)
          </h6>

          <div>
            {healthChecks.map((check, index) => {
              const expanded = expandedChecks.has(check.name);
              return (
                <React.Fragment key={check.name}>
                  <div className="flex items-start gap-3 py-2">
                    <span className="inline-flex shrink-0 pt-0.5">
                      {getStatusIcon(check.status)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="cn-text-subtitle1">
                          {check.name}
                        </span>
                        <StatusChip tokens={{ color: statusToken(check.status).fg, bg: statusToken(check.status).bg }} label={check.status} />
                        <StatusChip tokens={{ color: NEUTRAL_TOKEN.fg, bg: NEUTRAL_TOKEN.bg }} label={check.category} icon={getCategoryIcon(check.category)} />
                        {check.critical && (
                          <StatusChip tokens={{ color: 'var(--err)', bg: 'var(--err-soft)' }} label="CRITIQUE" />
                        )}
                      </div>
                      <div className="mt-1.5">
                        <div className="flex items-center gap-3 flex-wrap mb-1.5">
                          <p className="cn-text-body2 text-muted-foreground">
                            <strong>Temps de réponse:</strong>
                            <StatusChip tokens={{ color: responseTimeToken(check.responseTimeMs).fg, bg: responseTimeToken(check.responseTimeMs).bg }} label={`${check.responseTimeMs}ms`} className="ms-1.5 tabular-nums" />
                          </p>
                          {check.lastCheck && (
                            <p className="cn-text-body2 text-muted-foreground">
                              <strong>Dernière vérification:</strong> {new Date(check.lastCheck).toLocaleTimeString()}
                            </p>
                          )}
                        </div>

                        {/* Collapsible pilote de l'exterieur : l'etat ouvert vit
                            dans `expandedChecks`, le bouton de bascule est un
                            frere et non un CollapsibleTrigger. */}
                        <Collapsible open={expanded}>
                          <CollapsibleContent>
                            {/* Détails techniques : mono compact sur fond --field */}
                            <div className="mt-1.5 px-[9px] py-1.5 bg-[var(--field)] border border-solid border-[var(--field-line)] rounded-[8px]">
                              <p className="cn-text-body1 font-mono text-[12px] text-[var(--body)] break-words">
                                {check.details}
                              </p>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      aria-label={expanded ? `Masquer les détails de ${check.name}` : `Afficher les détails de ${check.name}`}
                      aria-expanded={expanded}
                      onClick={() => toggleExpanded(check.name)}
                    >
                      {expanded ? <ExpandLess size={20} strokeWidth={1.75} /> : <ExpandMore size={20} strokeWidth={1.75} />}
                    </Button>
                  </div>
                  {index < healthChecks.length - 1 && <Separator />}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthChecks;
