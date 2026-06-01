import React, { useEffect, useState } from 'react';
import { getOrgRoleLabel, getOrgRoleHex, getOrgRoleIcon } from '../../utils/orgRoleLabels';
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
  Schedule as ClockIcon,
  CheckCircle,
  HourglassEmpty,
} from '../../icons';
import type { LucideIcon } from 'lucide-react';

const STATUS_STYLE: Record<string, { label: string; color: string; Icon?: LucideIcon }> = {
  PENDING: { label: 'En attente', color: '#D4A574', Icon: ClockIcon },
  ACCEPTED: { label: 'Acceptée', color: '#4A9B8E', Icon: CheckCircle },
  EXPIRED: { label: 'Expirée', color: '#8A8378', Icon: HourglassEmpty },
  CANCELLED: { label: 'Annulée', color: '#C97A7A', Icon: CancelIcon },
};

const DEFAULT_STATUS_STYLE = { label: '', color: '#8A8378' };

// ─── Styles partagés pour les IconButton d'actions ──────────────────────────

const ACTION_BTN_BASE_SX = {
  width: 28,
  height: 28,
  borderRadius: '7px',
  color: 'text.secondary',
  border: '1px solid',
  borderColor: 'divider',
  backgroundColor: 'background.paper',
  transition:
    'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 150ms cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

const ACTION_BTN_PRIMARY_SX = {
  ...ACTION_BTN_BASE_SX,
  '&:hover': {
    color: '#6B8A9A',
    borderColor: '#6B8A9A66',
    backgroundColor: '#6B8A9A0F',
    boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04)',
  },
  '&:focus-visible': { outline: '2px solid #6B8A9A', outlineOffset: 2 },
  '&.Mui-disabled': { borderColor: 'divider' },
} as const;

const ACTION_BTN_WARM_SX = {
  ...ACTION_BTN_BASE_SX,
  '&:hover': {
    color: '#D4A574',
    borderColor: '#D4A57466',
    backgroundColor: '#D4A5740F',
    boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04)',
  },
  '&:focus-visible': { outline: '2px solid #D4A574', outlineOffset: 2 },
  '&.Mui-disabled': { borderColor: 'divider' },
} as const;

const ACTION_BTN_DANGER_SX = {
  ...ACTION_BTN_BASE_SX,
  '&:hover': {
    color: '#C97A7A',
    borderColor: '#C97A7A66',
    backgroundColor: '#C97A7A0F',
    boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04)',
  },
  '&:focus-visible': { outline: '2px solid #C97A7A', outlineOffset: 2 },
  '&.Mui-disabled': { borderColor: 'divider' },
} as const;
import { invitationsApi, InvitationDto } from '../../services/api/invitationsApi';
import ConfirmationModal from '../../components/ConfirmationModal';

interface Props {
  organizationId: number;
  refreshTrigger: number; // incrementer pour forcer un refresh
}

export default function InvitationsList({ organizationId, refreshTrigger }: Props) {
  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  // Invitation en attente de confirmation de suppression (modal ouvert si != null).
  // Remplace l'ancien window.confirm() natif par le composant projet ConfirmationModal.
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

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

  // Click corbeille -> ouvre le modal de confirmation (sans bloquer le thread comme window.confirm).
  const handleDelete = (invitationId: number) => {
    setPendingDeleteId(invitationId);
  };

  // Confirme la suppression (appelee depuis le ConfirmationModal).
  const confirmDelete = async () => {
    if (pendingDeleteId === null) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    setActionLoading(id);
    try {
      await invitationsApi.cancel(organizationId, id);
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
    const style = STATUS_STYLE[status] ?? { ...DEFAULT_STATUS_STYLE, label: status };
    const { Icon, color, label } = style;
    return (
      <Chip
        icon={Icon ? <Icon size={11} strokeWidth={2} /> : undefined}
        label={label}
        size="small"
        sx={{
          height: 22,
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.01em',
          backgroundColor: `${color}14`,
          color,
          border: `1px solid ${color}33`,
          borderRadius: '6px',
          px: 0.25,
          '& .MuiChip-icon': {
            color: `${color} !important`,
            ml: '6px',
            mr: '-2px',
          },
          '& .MuiChip-label': { px: 0.875 },
        }}
      />
    );
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
  // Email cell : shrinkable + ellipsis pour eviter de pousser la table et clipper les actions
  const CELL_EMAIL_SX = { fontSize: '0.75rem', py: 0.75, px: 1, maxWidth: 0, width: '100%' } as const;
  const CELL_ACTIONS_SX = { ...CELL_SX, fontWeight: 600, pr: 1.25 } as const;

  // Invitation associee au modal pour personnaliser le message (email destinataire).
  const pendingInvitation =
    pendingDeleteId !== null ? invitations.find((i) => i.id === pendingDeleteId) ?? null : null;

  return (
    <>
    <TableContainer sx={{ overflowX: 'hidden' }}>
      <Table size="small" sx={{ tableLayout: 'auto', width: '100%' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...CELL_SX, fontWeight: 600 }}>Email</TableCell>
            <TableCell sx={{ ...CELL_SX, fontWeight: 600 }}>Role</TableCell>
            <TableCell sx={{ ...CELL_SX, fontWeight: 600 }}>Statut</TableCell>
            <TableCell sx={{ ...CELL_SX, fontWeight: 600 }}>Envoyee</TableCell>
            <TableCell sx={{ ...CELL_SX, fontWeight: 600 }}>Expire</TableCell>
            <TableCell align="right" sx={CELL_ACTIONS_SX}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invitations.map((inv) => (
            <TableRow key={inv.id} hover>
              <TableCell sx={CELL_EMAIL_SX}>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  sx={{
                    fontSize: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={inv.invitedEmail}
                >
                  {inv.invitedEmail}
                </Typography>
              </TableCell>
              <TableCell sx={CELL_SX}>
                {(() => {
                  const roleColor = getOrgRoleHex(inv.roleInvited);
                  const RoleIcon = getOrgRoleIcon(inv.roleInvited);
                  return (
                    <Chip
                      icon={<RoleIcon size={11} strokeWidth={2} />}
                      label={getRoleLabel(inv.roleInvited)}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                        backgroundColor: `${roleColor}14`,
                        color: roleColor,
                        border: `1px solid ${roleColor}33`,
                        borderRadius: '6px',
                        px: 0.25,
                        '& .MuiChip-icon': {
                          color: `${roleColor} !important`,
                          ml: '6px',
                          mr: '-2px',
                        },
                        '& .MuiChip-label': { px: 0.875 },
                      }}
                    />
                  );
                })()}
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
              <TableCell align="right" sx={{ ...CELL_SX, pr: 1.25 }}>
                {inv.status === 'PENDING' && (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <Tooltip title="Renvoyer l'invitation">
                      <IconButton
                        size="small"
                        onClick={() => handleResend(inv.id)}
                        disabled={actionLoading === inv.id}
                        aria-label="Renvoyer l'invitation"
                        sx={ACTION_BTN_PRIMARY_SX}
                      >
                        {actionLoading === inv.id ? (
                          <CircularProgress size={13} color="inherit" />
                        ) : (
                          <RefreshIcon size={13} strokeWidth={1.75} />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Annuler l'invitation">
                      <IconButton
                        size="small"
                        onClick={() => handleCancel(inv.id)}
                        disabled={actionLoading === inv.id}
                        aria-label="Annuler l'invitation"
                        sx={ACTION_BTN_WARM_SX}
                      >
                        <CancelIcon size={13} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                {(inv.status === 'CANCELLED' || inv.status === 'EXPIRED') && (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                    <Tooltip title="Supprimer l'invitation">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(inv.id)}
                        disabled={actionLoading === inv.id}
                        aria-label="Supprimer l'invitation"
                        sx={ACTION_BTN_DANGER_SX}
                      >
                        {actionLoading === inv.id ? (
                          <CircularProgress size={13} color="inherit" />
                        ) : (
                          <DeleteIcon size={13} strokeWidth={1.75} />
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

    <ConfirmationModal
      open={pendingDeleteId !== null}
      onClose={() => setPendingDeleteId(null)}
      onConfirm={confirmDelete}
      title="Supprimer cette invitation ?"
      message={
        pendingInvitation
          ? `L'invitation envoyee a ${pendingInvitation.invitedEmail} sera definitivement supprimee. Cette action est irreversible.`
          : 'Cette invitation sera definitivement supprimee. Cette action est irreversible.'
      }
      severity="error"
      confirmText="Supprimer"
      cancelText="Annuler"
      loading={actionLoading !== null && actionLoading === pendingDeleteId}
    />
    </>
  );
}
