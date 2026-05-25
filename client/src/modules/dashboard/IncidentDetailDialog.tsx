import React, { useState } from 'react';
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
} from '@mui/material';
import { Close, Refresh, Delete } from '../../icons';
import type { IncidentDto, IncidentStatus } from '../../services/api/incidentApi';
import { incidentApi } from '../../services/api/incidentApi';
import { useAuth } from '../../hooks/useAuth';

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

const formatDuration = (minutes: number | null): string => {
  if (minutes === null || minutes === undefined) return '-';
  // Arrondi au entier — la precision sub-minute n'a pas de valeur metier ici
  // et provoque du bruit IEEE-754 ('4.040000000000873min') sur les longues durees.
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}min`;
};

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
}

// ─── Component ───────────────────────────────────────────────────────────────

const IncidentDetailDialog: React.FC<IncidentDetailDialogProps> = ({
  open,
  onClose,
  incidents,
  loading,
  onRefresh,
  otherSeveritiesOpenCount = 0,
}) => {
  const { isSuperAdmin } = useAuth();
  const canDelete = isSuperAdmin();

  const [retestingId, setRetestingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'warning' | 'error';
  }>({ open: false, message: '', severity: 'success' });

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

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Détail des incidents P1
          </Typography>
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

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : incidents.length === 0 ? (
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
                  {incidents.map((incident) => {
                    const statusConfig = STATUS_CONFIG[incident.status];
                    const isRetesting = retestingId === incident.id;
                    return (
                      <TableRow key={incident.id} hover>
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
                          {formatDuration(incident.resolutionMinutes)}
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

      {/* Confirmation de suppression — guard contre un clic accidentel sur un
          incident encore en cours d'investigation. */}
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
