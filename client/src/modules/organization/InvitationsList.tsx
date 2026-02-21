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

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell>Envoyee le</TableCell>
            <TableCell>Expire le</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invitations.map((inv) => (
            <TableRow key={inv.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight={500}>
                  {inv.invitedEmail}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {getRoleLabel(inv.roleInvited)}
                </Typography>
              </TableCell>
              <TableCell>
                {getStatusChip(inv.status)}
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {new Date(inv.expiresAt).toLocaleDateString('fr-FR')}
                </Typography>
              </TableCell>
              <TableCell align="right">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
