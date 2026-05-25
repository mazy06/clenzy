import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  alpha,
} from '@mui/material';
import { Close, Refresh, Delete } from '../../icons';
import type { IncidentDto, IncidentStatus } from '../../services/api/incidentApi';
import { incidentApi } from '../../services/api/incidentApi';
import { useAuth } from '../../hooks/useAuth';
import { formatDuration } from '../../utils/durationUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: 'error' | 'success' | 'warning' }> = {
  OPEN: { label: 'Ouvert', color: 'error' },
  ACKNOWLEDGED: { label: 'Pris en charge', color: 'warning' },
  RESOLVED: { label: 'Résolu', color: 'success' },
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
  const canDelete = isSuperAdmin();

  const [retestingId, setRetestingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'warning' | 'error';
  }>({ open: false, message: '', severity: 'success' });

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
      setSnackbar({
        open: true,
        message: `Incident #${incidentId} supprimé.`,
        severity: 'success',
      });
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
      setSnackbar({ open: true, message, severity: 'error' });
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
      setSnackbar({
        open: true,
        message: `${okCount} incident${okCount > 1 ? 's' : ''} hors cible supprimé${okCount > 1 ? 's' : ''}.`,
        severity: 'success',
      });
    } else if (okCount === 0) {
      setSnackbar({
        open: true,
        message: `Echec de la suppression bulk (${failCount} erreurs).`,
        severity: 'error',
      });
    } else {
      setSnackbar({
        open: true,
        message: `${okCount} supprimé${okCount > 1 ? 's' : ''}, ${failCount} echec${failCount > 1 ? 's' : ''}.`,
        severity: 'warning',
      });
    }

    onRefresh?.();
  };

  const handleRetest = async (incidentId: number) => {
    setRetestingId(incidentId);
    try {
      const result = await incidentApi.retestIncident(incidentId);

      if (result.status === 'UP' && result.resolved) {
        setSnackbar({
          open: true,
          message: `Service ${result.service} est opérationnel — incident résolu`,
          severity: 'success',
        });
      } else {
        setSnackbar({
          open: true,
          message: `Service ${result.service} est toujours inaccessible : ${result.message}`,
          severity: 'warning',
        });
      }

      onRefresh?.();
    } catch {
      setSnackbar({
        open: true,
        message: 'Erreur lors du retest',
        severity: 'error',
      });
    } finally {
      setRetestingId(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const overTargetCount = overTargetIncidents.length;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Détail des incidents P1
            </Typography>
            {overTargetCount > 0 && (
              <Tooltip title={`Cible KPI : < ${formatDuration(targetMinutes)}. Ces incidents tirent la moyenne au-dessus du seuil.`}>
                <Chip
                  label={`${overTargetCount} hors cible à nettoyer`}
                  color="error"
                  size="small"
                  sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                />
              </Tooltip>
            )}
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {/* Avertissement diagnostic : des incidents OPEN existent dans
              d'autres sévérités (P2/P3) mais ne sont pas listés ici car
              le modal est scopé P1 (contexte du KPI 'P1 Incident Resolution'). */}
          {otherSeveritiesOpenCount > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {otherSeveritiesOpenCount} incident
              {otherSeveritiesOpenCount > 1 ? 's' : ''} ouvert
              {otherSeveritiesOpenCount > 1 ? 's' : ''} de sévérité autre que P1
              {otherSeveritiesOpenCount > 1 ? ' ne sont pas affichés' : " n'est pas affiché"} ici
              (ce tableau ne montre que les incidents P1).
            </Alert>
          )}

          {/* Stats KPI + bulk action — uniquement si on a des hors cible */}
          {!loading && overTargetCount > 0 && (
            <Alert
              severity="warning"
              icon={false}
              sx={{
                mb: 2,
                '& .MuiAlert-message': { width: '100%' },
              }}
              action={
                canDelete && (
                  <Button
                    size="small"
                    color="error"
                    variant="contained"
                    startIcon={bulkDeleting ? <CircularProgress size={14} color="inherit" /> : <Delete fontSize="small" />}
                    onClick={() => setConfirmBulkOpen(true)}
                    disabled={bulkDeleting}
                  >
                    Supprimer les {overTargetCount} hors cible
                  </Button>
                )
              }
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Moyenne actuelle : {formatDuration(stats.currentAvg)}{' '}
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                    (cible : &lt; {formatDuration(targetMinutes)})
                  </Typography>
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  En supprimant les {overTargetCount} hors cible →{' '}
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: stats.projectedAvg <= targetMinutes ? 'success.main' : 'warning.main',
                    }}
                  >
                    moyenne projetée {formatDuration(stats.projectedAvg)}
                  </Typography>{' '}
                  sur {stats.projectedCount} incident{stats.projectedCount > 1 ? 's' : ''} restant
                  {stats.projectedCount > 1 ? 's' : ''}.
                </Typography>
              </Box>
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : sortedIncidents.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                Aucun incident P1 récent.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Service</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Titre</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Statut</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Durée</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedIncidents.map((incident) => {
                    const statusConfig = STATUS_CONFIG[incident.status];
                    const isRetesting = retestingId === incident.id;
                    const overTarget = isOverTarget(incident, targetMinutes);
                    return (
                      <TableRow
                        key={incident.id}
                        hover
                        sx={overTarget ? {
                          backgroundColor: (theme) => alpha(theme.palette.error.main, 0.04),
                        } : undefined}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          {formatDate(incident.openedAt)}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>
                          {incident.type}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>
                          {incident.serviceName}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', maxWidth: 200 }}>
                          <Typography variant="body2" noWrap title={incident.title}>
                            {incident.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusConfig.label}
                            color={statusConfig.color}
                            size="small"
                            sx={{ height: 22, fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography
                              component="span"
                              sx={{
                                fontSize: '0.8rem',
                                fontWeight: overTarget ? 600 : 400,
                                color: overTarget ? 'error.main' : 'inherit',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {formatDuration(incident.resolutionMinutes)}
                            </Typography>
                            {overTarget && (
                              <Tooltip
                                title={`Au-dessus de la cible (< ${formatDuration(targetMinutes)}) — pollue la moyenne KPI P1. Candidat à suppression pour purger le KPI.`}
                              >
                                <Chip
                                  label="hors cible"
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.625rem',
                                    fontWeight: 600,
                                    letterSpacing: '0.03em',
                                  }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'inline-flex', gap: 0.25 }}>
                            {incident.status === 'OPEN' && (
                              <Tooltip title="Retester le service — si UP, l'incident sera auto-résolu">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleRetest(incident.id)}
                                  disabled={isRetesting || deletingId === incident.id}
                                >
                                  {isRetesting ? (
                                    <CircularProgress size={18} />
                                  ) : (
                                    <Refresh fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                            )}
                            {canDelete && (
                              <Tooltip
                                title={
                                  incident.status === 'OPEN'
                                    ? "Supprimer définitivement (service non monitoré localement, etc.)"
                                    : "Supprimer cet incident résolu (purge la moyenne KPI P1)"
                                }
                              >
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setConfirmDeleteId(incident.id)}
                                  disabled={deletingId === incident.id || isRetesting}
                                >
                                  {deletingId === incident.id ? (
                                    <CircularProgress size={18} />
                                  ) : (
                                    <Delete fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} startIcon={<Close />}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation de suppression unitaire */}
      <Dialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        maxWidth="xs"
      >
        <DialogTitle>Supprimer l'incident #{confirmDeleteId} ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Cette action retire l'incident de la base. Conséquences :
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, color: 'text.secondary' }}>
            <li>Décrémente le compteur d'incidents ouverts (badge).</li>
            <li>Si l'incident était RÉSOLU, sa durée n'entre plus dans la moyenne KPI P1.</li>
            <li>Action irréversible — pas de soft-delete.</li>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Annuler</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}
            disabled={deletingId !== null}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation de bulk delete */}
      <Dialog
        open={confirmBulkOpen}
        onClose={() => !bulkDeleting && setConfirmBulkOpen(false)}
        maxWidth="xs"
      >
        <DialogTitle>
          Supprimer {overTargetCount} incident{overTargetCount > 1 ? 's' : ''} hors cible ?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Tous les incidents RÉSOLUS dont la durée dépasse {formatDuration(targetMinutes)} seront supprimés :
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, color: 'text.secondary', mb: 1 }}>
            {overTargetIncidents.slice(0, 5).map((i) => (
              <li key={i.id}>
                {i.serviceName} — {formatDuration(i.resolutionMinutes)}
              </li>
            ))}
            {overTargetIncidents.length > 5 && (
              <li><i>+ {overTargetIncidents.length - 5} autre{overTargetIncidents.length - 5 > 1 ? 's' : ''}</i></li>
            )}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Action irréversible. Moyenne KPI P1 après suppression : <b>{formatDuration(stats.projectedAvg)}</b>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmBulkOpen(false)} disabled={bulkDeleting}>
            Annuler
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            startIcon={bulkDeleting ? <CircularProgress size={14} color="inherit" /> : <Delete fontSize="small" />}
          >
            Supprimer tout
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%', fontSize: '0.8rem' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default IncidentDetailDialog;
