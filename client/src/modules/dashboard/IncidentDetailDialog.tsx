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
import { Close, Refresh, Delete } from '../../icons';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import type { IncidentDto, IncidentStatus } from '../../services/api/incidentApi';
import { incidentApi } from '../../services/api/incidentApi';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { formatDuration } from '../../utils/durationUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<IncidentStatus, { label: string; tone: StatusTone }> = {
  OPEN: { label: 'Ouvert', tone: 'err' },
  ACKNOWLEDGED: { label: 'Pris en charge', tone: 'warn' },
  RESOLVED: { label: 'Résolu', tone: 'ok' },
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
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
      notify.success(`Incident #${incidentId} supprimé.`);
      onRefresh?.();
    } catch (err) {
      // Diagnostic precis : distinguer 403 (role manquant) / 404 (deja supprime) / autre.
      const apiErr = err as { status?: number; message?: string } | undefined;
      const status = apiErr?.status;
      let message: string;
      if (status === 403) {
        message = "Acces refuse — le rôle SUPER_ADMIN est requis pour cette action.";
      } else if (status === 404) {
        message = `Incident #${incidentId} introuvable (peut-etre deja supprime).`;
      } else {
        const backendMsg = apiErr?.message ?? 'erreur inconnue';
        message = `Erreur lors de la suppression (HTTP ${status ?? '?'} — ${backendMsg}).`;
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
      notify.success(`${okCount} incident${okCount > 1 ? 's' : ''} hors cible supprimé${okCount > 1 ? 's' : ''}.`);
    } else if (okCount === 0) {
      notify.error(`Echec de la suppression bulk (${failCount} erreurs).`);
    } else {
      notify.warning(`${okCount} supprimé${okCount > 1 ? 's' : ''}, ${failCount} echec${failCount > 1 ? 's' : ''}.`);
    }

    onRefresh?.();
  };

  const handleRetest = async (incidentId: number) => {
    setRetestingId(incidentId);
    try {
      const result = await incidentApi.retestIncident(incidentId);

      if (result.status === 'UP' && result.resolved) {
        notify.success(`Service ${result.service} est opérationnel — incident résolu`);
      } else {
        notify.warning(`Service ${result.service} est toujours inaccessible : ${result.message}`);
      }

      onRefresh?.();
    } catch {
      notify.error('Erreur lors du retest');
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
              <DialogTitle className="cn-text-h6 font-semibold">
                Détail des incidents P1
              </DialogTitle>
              {overTargetCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* Le span porte la ref que Radix pose sur son enfant :
                        Badge est une fonction, il n'en transmet pas. */}
                    <span className="inline-flex">
                      <Badge variant="destructive" className="h-[22px] text-[0.7rem] font-semibold">{`${overTargetCount} hors cible à nettoyer`}</Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{`Cible KPI : < ${formatDuration(targetMinutes)}. Ces incidents tirent la moyenne au-dessus du seuil.`}</TooltipContent>
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
              <AlertDescription>{otherSeveritiesOpenCount}incident
              {otherSeveritiesOpenCount > 1 ? 's' : ''}ouvert
              {otherSeveritiesOpenCount > 1 ? 's' : ''}de sévérité autre que P1
              {otherSeveritiesOpenCount > 1 ? ' ne sont pas affichés' : " n'est pas affiché"}ici
              (ce tableau ne montre que les incidents P1).</AlertDescription>
            </UiAlert>
          )}

          {/* Stats KPI + bulk action — uniquement si on a des hors cible */}
          {!loading && overTargetCount > 0 && (
            <UiAlert variant="warning" className="mb-3">
              <AlertDescription>
                <div className="flex flex-col gap-0.5">
                  <p className="cn-text-body2 font-semibold">
                    Moyenne actuelle : {formatDuration(stats.currentAvg)}{' '}
                    <span className="cn-text-caption text-muted-foreground">
                      (cible : &lt; {formatDuration(targetMinutes)})
                    </span>
                  </p>
                  <span className="cn-text-caption text-muted-foreground">
                    En supprimant les {overTargetCount} hors cible →{' '}
                    <span className={cn('cn-text-caption font-semibold', stats.projectedAvg <= targetMinutes ? 'text-[var(--ok)]' : 'text-[var(--warn)]')}>
                      moyenne projetée {formatDuration(stats.projectedAvg)}
                    </span>{' '}
                    sur {stats.projectedCount} incident{stats.projectedCount > 1 ? 's' : ''} restant
                    {stats.projectedCount > 1 ? 's' : ''}.
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
                    Supprimer les {overTargetCount} hors cible
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
            <div className="text-center py-6">
              <p className="cn-text-body1 text-muted-foreground">
                Aucun incident P1 récent.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Actions</TableHead>
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
                        className={overTarget ? 'bg-[color-mix(in_srgb,var(--err)_4%,transparent)]' : undefined}
                      >
                        <TableCell className="whitespace-nowrap text-[0.8rem]">
                          {formatDate(incident.openedAt)}
                        </TableCell>
                        <TableCell className="text-[0.8rem]">
                          {incident.type}
                        </TableCell>
                        <TableCell className="text-[0.8rem]">
                          {incident.serviceName}
                        </TableCell>
                        <TableCell className="text-[0.8rem] max-w-[200px]">
                          <p className="cn-text-body2 truncate" title={incident.title}>
                            {incident.title}
                          </p>
                        </TableCell>
                        <TableCell>
                          <StatusChip
                            label={statusConfig.label}
                            tone={statusConfig.tone}
                            className="text-[0.7rem]"
                          />
                        </TableCell>
                        <TableCell className="text-[0.8rem] whitespace-nowrap">
                          <div className="inline-flex items-center gap-0.5">
                            <span className={cn('cn-text-body1 text-[0.8rem] tabular-nums', overTarget ? 'font-semibold' : 'font-normal', overTarget ? 'text-[var(--err)]' : 'text-[inherit]')}>
                              {formatDuration(incident.resolutionMinutes)}
                            </span>
                            {overTarget && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Badge variant="destructive" className="h-[18px] text-[0.625rem] font-semibold tracking-[0.03em]">hors cible</Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{`Au-dessus de la cible (< ${formatDuration(targetMinutes)}) — pollue la moyenne KPI P1. Candidat à suppression pour purger le KPI.`}</TooltipContent>
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
                                      className="text-[var(--mui-primary)]"
                                      aria-label="Retester le service"
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
                                <TooltipContent>Retester le service — si UP, l&apos;incident sera auto-résolu</TooltipContent>
                              </Tooltip>
                            )}
                            {canDelete && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-[var(--err)]"
                                      aria-label="Supprimer l'incident"
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
                                    ? 'Supprimer définitivement (service non monitoré localement, etc.)'
                                    : 'Supprimer cet incident résolu (purge la moyenne KPI P1)'}
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
              Fermer
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
            <DialogTitle>Supprimer l&apos;incident #{confirmDeleteId} ?</DialogTitle>
          </DialogHeader>
          <p className="cn-text-body2 mb-1.5">
            Cette action retire l&apos;incident de la base. Conséquences :
          </p>
          <ul className="cn-text-body2 ps-3 text-muted-foreground">
            <li>Décrémente le compteur d&apos;incidents ouverts (badge).</li>
            <li>Si l&apos;incident était RÉSOLU, sa durée n&apos;entre plus dans la moyenne KPI P1.</li>
            <li>Action irréversible — pas de soft-delete.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}
              disabled={deletingId !== null}
            >
              Supprimer
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
              Supprimer {overTargetCount} incident{overTargetCount > 1 ? 's' : ''} hors cible ?
            </DialogTitle>
          </DialogHeader>
          <p className="cn-text-body2 mb-1.5">
            Tous les incidents RÉSOLUS dont la durée dépasse {formatDuration(targetMinutes)} seront supprimés :
          </p>
          <ul className="cn-text-body2 ps-3 text-muted-foreground mb-1.5">
            {overTargetIncidents.slice(0, 5).map((i) => (
              <li key={i.id}>
                {i.serviceName} — {formatDuration(i.resolutionMinutes)}
              </li>
            ))}
            {overTargetIncidents.length > 5 && (
              <li><i>+ {overTargetIncidents.length - 5} autre{overTargetIncidents.length - 5 > 1 ? 's' : ''}</i></li>
            )}
          </ul>
          <span className="cn-text-caption text-muted-foreground">
            Action irréversible. Moyenne KPI P1 après suppression : <b>{formatDuration(stats.projectedAvg)}</b>.
          </span>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkOpen(false)} disabled={bulkDeleting}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? <Spinner className="size-3.5" /> : <Delete />}
              Supprimer tout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IncidentDetailDialog;
