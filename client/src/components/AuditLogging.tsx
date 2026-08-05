import React, { useState, useEffect, useCallback } from 'react';
import StatusChip from './StatusChip';
import { Alert as BuiAlert, AlertAction, AlertDescription, Button, Field, FieldLabel, Input } from './ui';
import { Info as BuiInfo, TriangleAlert } from 'lucide-react';
import { Spinner } from './ui';
import {
  Card,
  CardContent,
  NativeSelect,
  NativeSelectOption,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui';
import {
  Info,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
  Person,
  Clear,
  Refresh,
  AdminPanelSettings,
  Lock,
  ReportProblem,
  Visibility,
  VpnKey,
} from '../icons';
import { monitoringApi } from '../services/api/monitoringApi';
import type { AuditLogEntry, AuditLogPage } from '../services/api/monitoringApi';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';
import PagePagination from './PagePagination';

/**
 * Chip -soft : encre `-ink` sur fond `-soft`.
 *
 * <p>Les tons sont choisis a l'execution depuis le type d'evenement renvoye par
 * l'API : les couleurs restent donc des VALEURS CSS, Tailwind n'emettant ses
 * classes qu'a la compilation. Les variables Baitly UI portent leur declinaison
 * claire ET sombre (theme/baitly-ui.css) ; l'encre `-ink` tient le 4,5:1 la ou la
 * teinte vive plafonne a ~2,2:1 sur une carte.</p>
 */
const NEUTRAL_TOKEN = { fg: 'var(--bui-muted-foreground)', bg: 'var(--bui-muted)' };

// Type d'evenement → tokens semantiques
const EVENT_TOKEN: Record<string, { fg: string; bg: string }> = {
  LOGIN_SUCCESS: { fg: 'var(--bui-success-ink)', bg: 'var(--bui-success-soft)' },
  LOGIN_FAILURE: { fg: 'var(--bui-warning-ink)', bg: 'var(--bui-warning-soft)' },
  PERMISSION_DENIED: { fg: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' },
  SUSPICIOUS_ACTIVITY: { fg: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' },
  DATA_ACCESS: { fg: 'var(--bui-info-ink)', bg: 'var(--bui-info-soft)' },
  ADMIN_ACTION: { fg: 'var(--bui-info-ink)', bg: 'var(--bui-info-soft)' },
  SECRET_ROTATION: { fg: 'var(--bui-info-ink)', bg: 'var(--bui-info-soft)' },
};

// Resultat → tokens semantiques (SUCCESS success, DENIED/ERROR destructive)
const RESULT_TOKEN: Record<string, { fg: string; bg: string }> = {
  SUCCESS: { fg: 'var(--bui-success-ink)', bg: 'var(--bui-success-soft)' },
  DENIED: { fg: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' },
  ERROR: { fg: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' },
};

interface AuditLogFilters {
  eventType: string;
  actorId: string;
  result: string;
}

const PAGE_SIZE = 15;

// Icone decorative : teinte VIVE et non l'encre `-ink`, qui est reservee au texte.
const getEventTypeIcon = (eventType: string) => {
  switch (eventType) {
    case 'LOGIN_SUCCESS':
      return <span className="inline-flex text-success"><CheckCircle size={20} strokeWidth={1.75} /></span>;
    case 'LOGIN_FAILURE':
      return <span className="inline-flex text-warning"><Warning size={20} strokeWidth={1.75} /></span>;
    case 'PERMISSION_DENIED':
      return <span className="inline-flex text-destructive"><Lock size={20} strokeWidth={1.75} /></span>;
    case 'DATA_ACCESS':
      return <span className="inline-flex text-info"><Visibility size={20} strokeWidth={1.75} /></span>;
    case 'ADMIN_ACTION':
      return <span className="inline-flex text-info"><AdminPanelSettings size={20} strokeWidth={1.75} /></span>;
    case 'SECRET_ROTATION':
      return <span className="inline-flex text-info"><VpnKey size={20} strokeWidth={1.75} /></span>;
    case 'SUSPICIOUS_ACTIVITY':
      return <span className="inline-flex text-destructive"><ReportProblem size={20} strokeWidth={1.75} /></span>;
    default:
      return <span className="inline-flex text-info"><Info size={20} strokeWidth={1.75} /></span>;
  }
};

const eventToken = (eventType: string) => EVENT_TOKEN[eventType] ?? NEUTRAL_TOKEN;
const resultToken = (result: string) => RESULT_TOKEN[result?.toUpperCase()] ?? NEUTRAL_TOKEN;

const formatEventType = (eventType: string) => {
  return eventType.replace(/_/g, ' ');
};

const AuditLogging: React.FC = () => {
  const [page, setPage] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({
    eventType: '',
    actorId: '',
    result: '',
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number> = {
        page: currentPage,
        size: PAGE_SIZE,
        sort: 'createdAt,desc',
      };
      if (filters.eventType) params.eventType = filters.eventType;
      if (filters.actorId) params.actorId = filters.actorId;
      if (filters.result) params.result = filters.result;

      const data = await monitoringApi.getAuditLogs(params);
      setPage(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError("Erreur lors de la récupération des logs d'audit");
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleRefresh = useCallback(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Register page-header actions + last-update timestamp.
  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-1.5">
        {loading && <Spinner className="size-4" />}
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Le span porte la ref que Radix pose sur son enfant : Button est
                une fonction, il n'en transmet pas. */}
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Actualiser les logs"
                onClick={handleRefresh}
              >
                <Refresh size={20} strokeWidth={1.75} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Actualiser les logs</TooltipContent>
        </Tooltip>
      </div>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, loading, handleRefresh]);

  useEffect(() => {
    setHeaderLastUpdate(lastUpdate);
  }, [setHeaderLastUpdate, lastUpdate]);

  const handleFilterChange = (field: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(0);
  };

  const clearFilters = () => {
    setFilters({ eventType: '', actorId: '', result: '' });
    setCurrentPage(0);
  };

  if (loading && !page) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (error && !page) {
    return (
      <BuiAlert variant="destructive">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Réessayer
          </Button>
        </AlertAction>
      </BuiAlert>
    );
  }

  const logs = page?.content ?? [];
  const totalPages = page?.totalPages ?? 1;
  const totalElements = page?.totalElements ?? 0;

  return (
    <div>
      {/* Filtres */}
      <Card className="mb-[18px]">
        <CardContent>
          <h6 className="text-sm font-semibold mt-0 mb-[0.35em] text-foreground">
            Filtres
          </h6>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              <Field>
                <FieldLabel htmlFor="audit-event-type">Type d'événement</FieldLabel>
                <NativeSelect
                  id="audit-event-type"
                  size="sm"
                  className="w-full"
                  value={filters.eventType}
                  onChange={(e) => handleFilterChange('eventType', e.target.value)}
                >
                  <NativeSelectOption value="">Tous</NativeSelectOption>
                  <NativeSelectOption value="LOGIN_SUCCESS">Connexion réussie</NativeSelectOption>
                  <NativeSelectOption value="LOGIN_FAILURE">Échec de connexion</NativeSelectOption>
                  <NativeSelectOption value="PERMISSION_DENIED">Accès refusé</NativeSelectOption>
                  <NativeSelectOption value="DATA_ACCESS">Accès aux données</NativeSelectOption>
                  <NativeSelectOption value="ADMIN_ACTION">Action admin</NativeSelectOption>
                  <NativeSelectOption value="SECRET_ROTATION">Rotation de secret</NativeSelectOption>
                  <NativeSelectOption value="SUSPICIOUS_ACTIVITY">Activité suspecte</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              <Field>
                <FieldLabel htmlFor="audit-result">Résultat</FieldLabel>
                <NativeSelect
                  id="audit-result"
                  size="sm"
                  className="w-full"
                  value={filters.result}
                  onChange={(e) => handleFilterChange('result', e.target.value)}
                >
                  <NativeSelectOption value="">Tous</NativeSelectOption>
                  <NativeSelectOption value="SUCCESS">Succès</NativeSelectOption>
                  <NativeSelectOption value="DENIED">Refusé</NativeSelectOption>
                  <NativeSelectOption value="ERROR">Erreur</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              <Field>
                <FieldLabel htmlFor="audit-actor-id">ID Acteur</FieldLabel>
                <Input
                  id="audit-actor-id"
                  className="w-full"
                  value={filters.actorId}
                  onChange={(e) => handleFilterChange('actorId', e.target.value)}
                />
              </Field>
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <Clear size={18} strokeWidth={1.75} />
                Effacer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardContent>
          <div className="flex justify-between items-center mb-3">
            <h6 className="text-sm font-semibold m-0 text-foreground">
              Logs d'audit ({totalElements} entrées)
            </h6>
            {totalPages > 1 && (
              <StatusChip tone="accent" label={`Page ${currentPage + 1} sur ${totalPages}`} className="tabular-nums" />
            )}
          </div>

          {logs.length === 0 ? (
            <BuiAlert variant="info">
              <BuiInfo />
              <AlertDescription>Aucun log d'audit trouvé pour les filtres sélectionnés</AlertDescription>
            </BuiAlert>
          ) : (
            <div className="flex flex-col">
              {logs.map((log, index) => (
                <React.Fragment key={log.id}>
                  <div className="flex items-start gap-2 py-1.5">
                    <span className="flex w-9 shrink-0 items-center justify-start pt-0.5">
                      {getEventTypeIcon(log.eventType)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium">
                          {log.action || formatEventType(log.eventType)}
                        </span>
                        <StatusChip tokens={{ color: eventToken(log.eventType).fg, bg: eventToken(log.eventType).bg }} label={formatEventType(log.eventType)} />
                        {log.result && (
                          <StatusChip tokens={{ color: resultToken(log.result).fg, bg: resultToken(log.result).bg }} label={log.result} />
                        )}
                      </div>
                      <div className="mt-1.5">
                        {log.details && (
                          <p className="text-xs mt-0 mb-[0.35em] text-foreground">
                            {log.details}
                          </p>
                        )}
                        {/* Meta technique : mono compact sur fond de champ */}
                        <div className="inline-flex gap-3 flex-wrap mt-0.5 px-1.5 py-0.5 bg-field border border-solid border-field-line rounded-md">
                          {log.actorEmail && (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {log.actorEmail}
                            </span>
                          )}
                          {log.actorIp && (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              IP {log.actorIp}
                            </span>
                          )}
                          {log.timestamp && (
                            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {index < logs.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center mt-[18px]">
              <PagePagination
                totalPages={totalPages}
                page={currentPage}
                onPageChange={(value) => setCurrentPage(value)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogging;
