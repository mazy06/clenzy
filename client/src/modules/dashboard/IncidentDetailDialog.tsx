import React from 'react';
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
} from '@mui/material';
import { Close } from '@mui/icons-material';
import type { IncidentDto, IncidentStatus } from '../../services/api/incidentApi';

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
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}min`;
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface IncidentDetailDialogProps {
  open: boolean;
  onClose: () => void;
  incidents: IncidentDto[];
  loading: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

const IncidentDetailDialog: React.FC<IncidentDetailDialogProps> = ({
  open,
  onClose,
  incidents,
  loading,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Détail des incidents P1
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
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
                </TableRow>
              </TableHead>
              <TableBody>
                {incidents.map((incident) => {
                  const statusConfig = STATUS_CONFIG[incident.status];
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
  );
};

export default IncidentDetailDialog;
