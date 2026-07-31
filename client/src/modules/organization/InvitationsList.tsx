import React, { useCallback, useEffect, useState } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { getOrgRoleLabel, getOrgRoleHex, getOrgRoleIcon } from '../../utils/orgRoleLabels';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip } from '@mui/material';
import {
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Schedule as ClockIcon,
  CheckCircle,
  HourglassEmpty,
} from '../../icons';
import type { LucideIcon } from 'lucide-react';

// Statut d'invitation → tokens semantiques (envoyee --info, acceptee --ok, expiree muted, annulee --err)
const STATUS_STYLE: Record<string, { label: string; fg: string; bg: string; Icon?: LucideIcon }> = {
  PENDING: { label: 'En attente', fg: 'var(--info)', bg: 'var(--info-soft)', Icon: ClockIcon },
  ACCEPTED: { label: 'Acceptée', fg: 'var(--ok)', bg: 'var(--ok-soft)', Icon: CheckCircle },
  EXPIRED: { label: 'Expirée', fg: 'var(--muted)', bg: 'var(--hover)', Icon: HourglassEmpty },
  CANCELLED: { label: 'Annulée', fg: 'var(--err)', bg: 'var(--err-soft)', Icon: CancelIcon },
};

const DEFAULT_STATUS_STYLE = { label: '', fg: 'var(--muted)', bg: 'var(--hover)' };

// ─── Styles partagés pour les IconButton d'actions ──────────────────────────

const ACTION_BTN_BASE_SX = {
  width: 28,
  height: 28,
  borderRadius: '7px',
  color: 'var(--muted)',
  border: '1px solid var(--line-2)',
  backgroundColor: 'var(--card)',
  transition:
    'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
} as const;

/** Variante de bouton d'action : hover teinte (texte couleur, bord 40%, fond -soft) */
const actionBtnSx = (fg: string, bg: string) =>
  ({
    ...ACTION_BTN_BASE_SX,
    '&:hover': {
      color: fg,
      borderColor: `color-mix(in srgb, ${fg} 40%, transparent)`,
      backgroundColor: bg,
    },
    '&:focus-visible': { outline: `2px solid ${fg}`, outlineOffset: 2 },
    '&.Mui-disabled': { borderColor: 'var(--line)' },
  }) as const;

const ACTION_BTN_PRIMARY_SX = actionBtnSx('var(--accent)', 'var(--accent-soft)');
const ACTION_BTN_WARM_SX = actionBtnSx('var(--warn)', 'var(--warn-soft)');
const ACTION_BTN_DANGER_SX = actionBtnSx('var(--err)', 'var(--err-soft)');
import { invitationsApi, InvitationDto } from '../../services/api/invitationsApi';
import ConfirmationModal from '../../components/ConfirmationModal';

interface Props {
  organizationId: number;
  refreshTrigger: number; // incrementer pour forcer un refresh
}

const getStatusChip = (status: string) => {
  const style = STATUS_STYLE[status] ?? { ...DEFAULT_STATUS_STYLE, label: status };
  const { Icon, fg, bg, label } = style;
  return (
    <StatusChip tokens={{ color: fg, bg: bg }} label={label} icon={Icon ? <Icon size={11} strokeWidth={2} /> : undefined} />
  );
};

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
// Entete : l'overline vient du theme global (MuiTableCell head) — on ne garde que l'espacement
const HEAD_CELL_SX = { whiteSpace: 'nowrap', py: 0.75, px: 1 } as const;

export default function InvitationsList({ organizationId, refreshTrigger }: Props) {
  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  // Invitation en attente de confirmation de suppression (modal ouvert si != null).
  // Remplace l'ancien window.confirm() natif par le composant projet ConfirmationModal.
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const loadInvitations = useCallback(async () => {
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
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      loadInvitations();
    }
  }, [organizationId, refreshTrigger, loadInvitations]);

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

  const getRoleLabel = getOrgRoleLabel;

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (invitations.length === 0) {
    return (
      <p className="cn-text-body2 text-muted-foreground py-3 text-center">
        Aucune invitation envoyee.
      </p>
    );
  }

  // Invitation associee au modal pour personnaliser le message (email destinataire).
  const pendingInvitation =
    pendingDeleteId !== null ? invitations.find((i) => i.id === pendingDeleteId) ?? null : null;

  return (
    <>
    <TableContainer sx={{ overflowX: 'hidden' }}>
      <Table size="small" sx={{ tableLayout: 'auto', width: '100%' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={HEAD_CELL_SX}>Email</TableCell>
            <TableCell sx={HEAD_CELL_SX}>Role</TableCell>
            <TableCell sx={HEAD_CELL_SX}>Statut</TableCell>
            <TableCell sx={HEAD_CELL_SX}>Envoyee</TableCell>
            <TableCell sx={HEAD_CELL_SX}>Expire</TableCell>
            <TableCell align="right" sx={{ ...HEAD_CELL_SX, pr: 1.25 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invitations.map((inv) => (
            <TableRow key={inv.id} hover>
              <TableCell sx={CELL_EMAIL_SX}>
                <p className="cn-text-body2 font-medium text-[0.75rem] overflow-hidden text-ellipsis whitespace-nowrap" title={inv.invitedEmail}>
                  {inv.invitedEmail}
                </p>
              </TableCell>
              <TableCell sx={CELL_SX}>
                {(() => {
                  const roleColor = getOrgRoleHex(inv.roleInvited);
                  const RoleIcon = getOrgRoleIcon(inv.roleInvited);
                  return (
                    <StatusChip tokens={{ color: roleColor, bg: `${roleColor}18` }} label={getRoleLabel(inv.roleInvited)} icon={<RoleIcon size={11} strokeWidth={2} />} />
                  );
                })()}
              </TableCell>
              <TableCell sx={CELL_SX}>
                {getStatusChip(inv.status)}
              </TableCell>
              <TableCell sx={CELL_SX}>
                <p className="cn-text-body2 text-muted-foreground text-[0.75rem] tabular-nums">
                  {formatShortDate(inv.createdAt)}
                </p>
              </TableCell>
              <TableCell sx={CELL_SX}>
                <p className="cn-text-body2 text-muted-foreground text-[0.75rem] tabular-nums">
                  {formatShortDate(inv.expiresAt)}
                </p>
              </TableCell>
              <TableCell align="right" sx={{ ...CELL_SX, pr: 1.25 }}>
                {inv.status === 'PENDING' && (
                  <div className="inline-flex items-center gap-0.5">
                    <Tooltip title="Renvoyer l'invitation">
                      <IconButton
                        size="small"
                        onClick={() => handleResend(inv.id)}
                        disabled={actionLoading === inv.id}
                        aria-label="Renvoyer l'invitation"
                        sx={ACTION_BTN_PRIMARY_SX}
                      >
                        {actionLoading === inv.id ? (
                          <Spinner className="size-[13px]" />
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
                  </div>
                )}
                {(inv.status === 'CANCELLED' || inv.status === 'EXPIRED') && (
                  <div className="inline-flex items-center gap-0.5 justify-end">
                    <Tooltip title="Supprimer l'invitation">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(inv.id)}
                        disabled={actionLoading === inv.id}
                        aria-label="Supprimer l'invitation"
                        sx={ACTION_BTN_DANGER_SX}
                      >
                        {actionLoading === inv.id ? (
                          <Spinner className="size-[13px]" />
                        ) : (
                          <DeleteIcon size={13} strokeWidth={1.75} />
                        )}
                      </IconButton>
                    </Tooltip>
                  </div>
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
