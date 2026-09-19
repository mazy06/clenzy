import React, { useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import { Badge, Button } from '../../components/ui';
import { Alert as UiAlert, AlertAction, AlertDescription } from '../../components/ui';
import { Info } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { CheckCircleOutline, Close, Refresh, Delete } from '../../icons';
import EmptyState from '../../components/EmptyState';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import type { IncidentDto, IncidentStatus } from '../../services/api/incidentApi';
import { incidentApi } from '../../services/api/incidentApi';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import { formatDuration } from '../../utils/durationUtils';
import { activeIntlLocale } from '../../utils/activeLocale';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Clefs seules : un libellé figé ici ne se retraduirait jamais. */
const STATUS_CONFIG: Record<IncidentStatus, { labelKey: string; tone: StatusTone }> = {
  OPEN: { labelKey: 'incidentDialog.status.OPEN', tone: 'err' },
  ACKNOWLEDGED: { labelKey: 'incidentDialog.status.ACKNOWLEDGED', tone: 'warn' },
  RESOLVED: { labelKey: 'incidentDialog.status.RESOLVED', tone: 'ok' },
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString(activeIntlLocale(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

/** True si un incident RESOLVED a une duree au-dessus de la cible. OPEN exclus. */
function isOverTarget(incident: IncidentDto, targetMinutes: number): boolean {
  return (
    incident.status === 'RESOLVED'
    && incident.resolutionMinutes !== null
    && incident.resolutionMinutes !== undefined
    && incident.resolutionMinutes > targetMinutes
  );
}

/**
 * Tri stable : OPEN en tete (urgence operationnelle), puis RESOLVED tries
 * par duree DESC (les plus pollueurs en premier pour identifier les
 * candidats au cleanup d'un coup d'oeil).
 */
function sortIncidents(incidents: IncidentDto[]): IncidentDto[] {
  return [...incidents].sort((a, b) => {
    // OPEN d'abord
    const aOpen = a.status === 'OPEN' ? 0 : 1;
    const bOpen = b.status === 'OPEN' ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;

    // Pour OPEN : par openedAt DESC
    if (a.status === 'OPEN') {
      return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
    }

    // Pour RESOLVED : par duree DESC (hors cible en haut)
    const aDur = a.resolutionMinutes ?? 0;
    const bDur = b.resolutionMinutes ?? 0;
    return bDur - aDur;
  });
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface IncidentDetailDialogProps {
  open: boolean;
  onClose: () => void;
  incidents: IncidentDto[];
  loading: boolean;
  onRefresh?: () => void;
  /**
   * Nombre d'incidents OPEN d'autres severites (P2/P3) NON inclus dans
   * la liste — utile pour afficher un avertissement diagnostic quand le
   * badge global ne matche pas le scope P1 du modal.
   */
  otherSeveritiesOpenCount?: number;
  /**
   * Seuil cible du KPI P1 Incident Resolution (en minutes). Les incidents
   * RESOLVED avec une duree au-dessus de ce seuil polluent la moyenne
   * et sont visuellement flagges (rouge) pour permettre a l'admin
   * d'identifier immediatement les candidats au cleanup.
   */
  targetMinutes?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

const IncidentDetailDialog: React.FC<IncidentDetailDialogProps> = ({
  open,
  onClose,
  incidents,
  loading,
  onRefresh,
  otherSeveritiesOpenCount = 0,
  targetMinutes = 60,
}) => {
  const { t } = useTranslation();
  const { isSuperAdmin } = useAuth();
  const { notify } = useNotification();
  const canDelete = isSuperAdmin();

  const [retestingId, setRetestingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ─── Derived state : tri + stats KPI ───────────────────────────────────────

  const sortedIncidents = useMemo(() => sortIncidents(incidents), [incidents]);

  const overTargetIncidents = useMemo(
    () => sortedIncidents.filter((i) => isOverTarget(i, targetMinutes)),
    [sortedIncidents, targetMinutes],
  );

  /**
   * Stats KPI calculees localement a partir des incidents affiches.
   * - currentAvg : moyenne actuelle des RESOLVED (matche le KPI backend)
   * - projectedAvg : moyenne projetee si on supprime les hors cible
   * Note : la projection est une estimation locale, le backend recalcule
   * exactement apres la suppression effective.
   */
  const stats = useMemo(() => {
    const resolved = sortedIncidents.filter(
      (i) => i.status === 'RESOLVED'
        && i.resolutionMinutes !== null
        && i.resolutionMinutes !== undefined,
    );
    const total = resolved.length;
    if (total === 0) {
      return { currentAvg: 0, projectedAvg: 0, total: 0, projectedCount: 0 };
    }
    const currentSum = resolved.reduce((acc, i) => acc + (i.resolutionMinutes ?? 0), 0);
    const currentAvg = currentSum / total;

    const remaining = resolved.filter((i) => !isOverTarget(i, targetMinutes));
    const projectedCount = remaining.length;
    const projectedSum = remaining.reduce((acc, i) => acc + (i.resolutionMinutes ?? 0), 0);
    const projectedAvg = projectedCount > 0 ? projectedSum / projectedCount : 0;

    return { currentAvg, projectedAvg, total, projectedCount };
  }, [sortedIncidents, targetMinutes]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleDelete = async (incidentId: number) => {
    setDeletingId(incidentId);
    try {
      await incidentApi.deleteIncident(incidentId);
      notify.success(t('incidentDialog.toast.deleted', { id: incidentId }));
      onRefresh?.();
    } catch (err) {
      // Diagnostic precis : distinguer 403 (role manquant) / 404 (deja supprime) / autre.
      const apiErr = err as { status?: number; message?: string } | undefined;
      const status = apiErr?.status;
      let message: string;
      if (status === 403) {
        message = t('incidentDialog.toast.forbidden');
      } else if (status === 404) {
        message = t('incidentDialog.toast.notFound', { id: incidentId });
      } else {
        message = t('incidentDialog.toast.deleteError', {
          status: status ?? '?',
          message: apiErr?.message ?? t('incidentDialog.toast.unknownError'),
        });
      }
      notify.error(message);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  /**
   * Bulk delete : supprime tous les incidents RESOLVED dont la duree depasse
   * la cible. Iterate en serie pour pouvoir compter les succes/echecs et ne
   * pas surcharger le backend (admin-only, rare). Refresh une seule fois a
   * la fin pour eviter le flicker de plusieurs Promise.all sur le KPI.
   */
  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    let okCount = 0;
    let failCount = 0;
    for (const incident of overTargetIncidents) {
      try {
        await incidentApi.deleteIncident(incident.id);
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setBulkDeleting(false);
    setConfirmBulkOpen(false);

    if (failCount === 0) {
      notify.success(t('incidentDialog.toast.bulkSuccess', { count: okCount }));
    } else if (okCount === 0) {
      notify.error(t('incidentDialog.toast.bulkError', { count: failCount }));
    } else {
      notify.warning(t('incidentDialog.toast.bulkPartial', { count: okCount, fail: failCount }));
    }

    onRefresh?.();
  };

  const handleRetest = async (incidentId: number) => {
    setRetestingId(incidentId);
    try {
      const result = await incidentApi.retestIncident(incidentId);

      if (result.status === 'UP' && result.resolved) {
        notify.success(t('incidentDialog.toast.retestUp', { service: result.service }));
      } else {
        notify.warning(t('incidentDialog.toast.retestDown', { service: result.service, message: result.message }));
      }

      onRefresh?.();
    } catch {
      notify.error(t('incidentDialog.toast.retestError'));
    } finally {
      setRetestingId(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const overTargetCount = overTargetIncidents.length;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="max-w-[900px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-1.5 flex-wrap">
              <DialogTitle className="text-base font-semibold tracking-tight">
                {t('incidentDialog.title')}
              </DialogTitle>
              {overTargetCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* Le span porte la ref que Radix pose sur son enfant :
                        Badge est une fonction, il n'en transmet pas. */}
                    <span className="inline-flex">
                      <Badge variant="destructive" className="h-[22px] text-2xs font-semibold tabular-nums">{t('incidentDialog.overTargetBadge', { count: overTargetCount })}</Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('incidentDialog.overTargetTooltip', { target: formatDuration(targetMinutes) })}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </DialogHeader>

          <div>
          {/* Avertissement diagnostic : des incidents OPEN existent dans
              d'autres sévérités (P2/P3) mais ne sont pas listés ici car
              le modal est scopé P1 (contexte du KPI 'P1 Incident Resolution'). */}
          {otherSeveritiesOpenCount > 0 && (
            <UiAlert variant="info" className="mb-3">
              <Info />
              {/* Les sauts de ligne JSX entre expressions sont supprimés, pas
                  convertis en espace : la phrase se compose d'un seul tenant. */}
              <AlertDescription>
                {t('incidentDialog.otherSeverities', { count: otherSeveritiesOpenCount })}
              </AlertDescription>
            </UiAlert>
          )}

          {/* Stats KPI + bulk action — uniquement si on a des hors cible */}
          {!loading && overTargetCount > 0 && (
            <UiAlert variant="warning" className="mb-3">
              <AlertDescription>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-semibold tabular-nums">
                    {t('incidentDialog.currentAvg', { value: formatDuration(stats.currentAvg) })}{' '}
                    <span className="text-xs font-normal opacity-80">
                      {t('incidentDialog.targetHint', { target: formatDuration(targetMinutes) })}
                    </span>
                  </p>
                  <span className="text-xs">
                    {t('incidentDialog.projectionLead', { count: overTargetCount })}{' '}
                    <span className={cn('text-xs font-semibold tabular-nums', stats.projectedAvg <= targetMinutes ? 'text-success-ink' : 'text-warning-ink')}>
                      {t('incidentDialog.projectedAvg', { value: formatDuration(stats.projectedAvg) })}
                    </span>{' '}
                    {t('incidentDialog.projectionTail', { count: stats.projectedCount })}
                  </span>
                </div>
              </AlertDescription>
              {canDelete && (
                <AlertAction>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmBulkOpen(true)}
                    disabled={bulkDeleting}
                  >
                    {bulkDeleting ? <Spinner className="size-3.5" /> : <Delete />}
                    {t('incidentDialog.bulkDeleteButton', { count: overTargetCount })}
                  </Button>
                </AlertAction>
              )}
            </UiAlert>
          )}

          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-10" />
            </div>
          ) : sortedIncidents.length === 0 ? (
            <EmptyState
              variant="transparent"
              icon={<CheckCircleOutline />}
              title={t('incidentDialog.empty.title')}
              description={t('incidentDialog.empty.description')}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.date')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead>{t('incidentDialog.table.service')}</TableHead>
                    <TableHead>{t('incidentDialog.table.title')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>{t('incidentDialog.table.duration')}</TableHead>
                    <TableHead>{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedIncidents.map((incident) => {
                    const statusConfig = STATUS_CONFIG[incident.status];
                    const isRetesting = retestingId === incident.id;
                    const overTarget = isOverTarget(incident, targetMinutes);
                    return (
                      <TableRow
                        key={incident.id}
                        className={overTarget ? 'bg-destructive/5' : undefined}
                      >
                        <TableCell className="whitespace-nowrap text-xs tabular-nums">
                          {formatDate(incident.openedAt)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {incident.type}
                        </TableCell>
                        <TableCell className="text-xs">
                          {incident.serviceName}
                        </TableCell>
                        <TableCell className="max-w-[200px] text-xs">
                          <p className="truncate" title={incident.title}>
                            {incident.title}
                          </p>
                        </TableCell>
                        <TableCell>
                          <StatusChip
                            label={t(statusConfig.labelKey)}
                            tone={statusConfig.tone}
                            className="text-2xs"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          <div className="inline-flex items-center gap-0.5">
                            <span className={cn('text-xs tabular-nums', overTarget ? 'font-semibold text-destructive-ink' : 'font-normal text-inherit')}>
                              {formatDuration(incident.resolutionMinutes)}
                            </span>
                            {overTarget && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Badge variant="destructive" className="h-[18px] text-2xs font-semibold tracking-wide">{t('incidentDialog.overTargetChip')}</Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{t('incidentDialog.overTargetRowTooltip', { target: formatDuration(targetMinutes) })}</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex gap-0.5">
                            {incident.status === 'OPEN' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-primary"
                                      aria-label={t('incidentDialog.retestAria')}
                                      onClick={() => handleRetest(incident.id)}
                                      disabled={isRetesting || deletingId === incident.id}
                                    >
                                      {isRetesting ? (
                                        <Spinner className="size-[18px]" />
                                      ) : (
                                        <Refresh size={18} strokeWidth={1.75} />
                                      )}
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{t('incidentDialog.retestTooltip')}</TooltipContent>
                              </Tooltip>
                            )}
                            {canDelete && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-destructive"
                                      aria-label={t('incidentDialog.deleteAria')}
                                      onClick={() => setConfirmDeleteId(incident.id)}
                                      disabled={deletingId === incident.id || isRetesting}
                                    >
                                      {deletingId === incident.id ? (
                                        <Spinner className="size-[18px]" />
                                      ) : (
                                        <Delete size={18} strokeWidth={1.75} />
                                      )}
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {incident.status === 'OPEN'
                                    ? t('incidentDialog.deleteTooltipOpen')
                                    : t('incidentDialog.deleteTooltipResolved')}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          </div>

          <DialogFooter>
            {/* Dialog de consultation : « Fermer » n'engage rien, il reste tertiaire. */}
            <Button variant="ghost" onClick={onClose}>
              <Close />
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression unitaire */}
      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(next) => { if (!next) setConfirmDeleteId(null); }}
      >
        <DialogContent className="max-w-[444px]">
          <DialogHeader>
            <DialogTitle>{t('incidentDialog.confirmDelete.title', { id: confirmDeleteId })}</DialogTitle>
          </DialogHeader>
          <p className="mb-1.5 text-sm">
            {t('incidentDialog.confirmDelete.intro')}
          </p>
          <ul className="ps-3 text-xs text-muted-foreground">
            <li>{t('incidentDialog.confirmDelete.c1')}</li>
            <li>{t('incidentDialog.confirmDelete.c2')}</li>
            <li>{t('incidentDialog.confirmDelete.c3')}</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}
              disabled={deletingId !== null}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation de bulk delete */}
      <Dialog
        open={confirmBulkOpen}
        onOpenChange={(next) => { if (!next && !bulkDeleting) setConfirmBulkOpen(false); }}
      >
        <DialogContent className="max-w-[444px]">
          <DialogHeader>
            <DialogTitle>
              {t('incidentDialog.confirmBulk.title', { count: overTargetCount })}
            </DialogTitle>
          </DialogHeader>
          <p className="mb-1.5 text-sm">
            {t('incidentDialog.confirmBulk.intro', { target: formatDuration(targetMinutes) })}
          </p>
          <ul className="mb-1.5 ps-3 text-xs text-muted-foreground">
            {overTargetIncidents.slice(0, 5).map((i) => (
              <li key={i.id}>
                {i.serviceName} — {formatDuration(i.resolutionMinutes)}
              </li>
            ))}
            {overTargetIncidents.length > 5 && (
              <li><i>{t('incidentDialog.confirmBulk.more', { count: overTargetIncidents.length - 5 })}</i></li>
            )}
          </ul>
          <span className="text-xs text-muted-foreground">
            {t('incidentDialog.confirmBulk.footer')} <b className="tabular-nums">{formatDuration(stats.projectedAvg)}</b>.
          </span>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkOpen(false)} disabled={bulkDeleting}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? <Spinner className="size-3.5" /> : <Delete />}
              {t('incidentDialog.confirmBulk.deleteAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IncidentDetailDialog;
