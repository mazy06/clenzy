import React, { useEffect, useState } from 'react';
import { getOrgRoleLabel } from '../../utils/orgRoleLabels';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { invitationsApi, InvitationDto } from '../../services/api/invitationsApi';

interface Props {
  organizationId: number;
  refreshTrigger: number; // incrementer pour forcer un refresh
}

export default function InvitationsList({ organizationId, refreshTrigger }: Props) {
  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadInvitations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invitationsApi.list(organizationId);
      setInvitations(data);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Erreur lors du chargement des invitations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      loadInvitations();
    }
  }, [organizationId, refreshTrigger]);

  const handleCancel = async (invitationId: number) => {
    setActionLoading(invitationId);
    try {
      await invitationsApi.cancel(organizationId, invitationId);
      await loadInvitations();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Erreur lors de l\'annulation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (invitationId: number) => {
    if (!window.confirm('Supprimer definitivement cette invitation ?')) return;
    setActionLoading(invitationId);
    try {
      await invitationsApi.cancel(organizationId, invitationId);
      await loadInvitations();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Erreur lors de la suppression.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async (invitationId: number) => {
    setActionLoading(invitationId);
    try {
      await invitationsApi.resend(organizationId, invitationId);
      await loadInvitations();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Erreur lors du renvoi.');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Chip label="En attente" color="warning" size="small" variant="outlined" />;
      case 'ACCEPTED':
        return <Chip label="Acceptee" color="success" size="small" variant="outlined" />;
      case 'EXPIRED':
        return <Chip label="Expiree" color="default" size="small" variant="outlined" />;
      case 'CANCELLED':
        return <Chip label="Annulee" color="error" size="small" variant="outlined" />;
      default:
        return <Chip label={status} size="small" variant="outlined" />;
    }
  };

  const getRoleLabel = getOrgRoleLabel;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (invitations.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        Aucune invitation envoyee.
      </Typography>
    );
  }

  // Format compact : jj/mm/aa au lieu de jj/mm/aaaa pour gagner ~2 chars/cellule
  const formatShortDate = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const CELL_SX = {
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
    py: 0.75,
    px: 1,
  } as const;

  return (
    <TableContainer>
      <Table size="small" sx={{ tableLayout: 'auto' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...CELL_SX, fontWeight: 600 }}>Email</TableCell>
            <TableCell sx={{ ...CELL_SX, fontWeight: 600 }}>Role</TableCell>
            <TableCell sx={{ ...CELL_SX, fontWeight: 600 }}>Statut</TableCell>
            <TableCell sx={{ ...CELL_SX, fontWeight: 600 }}>Envoyee</TableCell>
            <TableCell sx={{ ...CELL_SX, fontWeight: 600 }}>Expire</TableCell>
            <TableCell align="right" sx={{ ...CELL_SX, fontWeight: 600 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invitations.map((inv) => (
            <TableRow key={inv.id} hover>
              <TableCell sx={CELL_SX}>
                <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.75rem' }}>
                  {inv.invitedEmail}
                </Typography>
              </TableCell>
              <TableCell sx={CELL_SX}>
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                  {getRoleLabel(inv.roleInvited)}
                </Typography>
              </TableCell>
              <TableCell sx={CELL_SX}>
                {getStatusChip(inv.status)}
              </TableCell>
              <TableCell sx={CELL_SX}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {formatShortDate(inv.createdAt)}
                </Typography>
              </TableCell>
              <TableCell sx={CELL_SX}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {formatShortDate(inv.expiresAt)}
                </Typography>
              </TableCell>
              <TableCell align="right" sx={CELL_SX}>
                {inv.status === 'PENDING' && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                    <Tooltip title="Renvoyer l'invitation">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleResend(inv.id)}
                        disabled={actionLoading === inv.id}
                      >
                        {actionLoading === inv.id ? (
                          <CircularProgress size={18} />
                        ) : (
                          <RefreshIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Annuler l'invitation">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleCancel(inv.id)}
                        disabled={actionLoading === inv.id}
                      >
                        <CancelIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                {(inv.status === 'CANCELLED' || inv.status === 'EXPIRED') && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                    <Tooltip title="Supprimer l'invitation">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(inv.id)}
                        disabled={actionLoading === inv.id}
                      >
                        {actionLoading === inv.id ? (
                          <CircularProgress size={18} />
                        ) : (
                          <DeleteIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
