import React, { useCallback, useEffect, useState } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { getOrgRoleLabel, getOrgRoleHex, getOrgRoleIcon } from '../../utils/orgRoleLabels';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { cn } from '../../utils/cn';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
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

// ─── Classes partagées pour les boutons d'action ────────────────────────────
// Ecrites en litteraux : une classe Tailwind ne peut pas naitre d'une fabrique
// parametree (les classes sont emises en scannant les sources).

const ACTION_BTN_BASE_CLS =
  'size-7 rounded-[7px] text-[var(--muted)] border border-solid border-[var(--line-2)] bg-[var(--card)] disabled:border-[var(--line)] [transition:border-color_150ms_cubic-bezier(0.22,1,0.36,1),background-color_150ms_cubic-bezier(0.22,1,0.36,1),color_150ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none';

/** Variante de bouton d'action : hover teinte (texte couleur, bord 40%, fond -soft) */
const ACTION_BTN_PRIMARY_CLS =
  'hover:text-[var(--accent)] hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:bg-[var(--accent-soft)] focus-visible:[outline:2px_solid_var(--accent)] focus-visible:outline-offset-2';
const ACTION_BTN_WARM_CLS =
  'hover:text-[var(--warn)] hover:border-[color-mix(in_srgb,var(--warn)_40%,transparent)] hover:bg-[var(--warn-soft)] focus-visible:[outline:2px_solid_var(--warn)] focus-visible:outline-offset-2';
const ACTION_BTN_DANGER_CLS =
  'hover:text-[var(--err)] hover:border-[color-mix(in_srgb,var(--err)_40%,transparent)] hover:bg-[var(--err-soft)] focus-visible:[outline:2px_solid_var(--err)] focus-visible:outline-offset-2';
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

// py 0.75 / px 1 en spacing MUI (6px) = 4.5px / 6px. Le nowrap vient deja du primitif.
const CELL_CLS = 'text-[0.75rem] py-[4.5px] px-1.5';
// Email cell : shrinkable + ellipsis pour eviter de pousser la table et clipper les actions
const CELL_EMAIL_CLS = 'text-[0.75rem] py-[4.5px] px-1.5 max-w-0 w-full';
// Entete : l'overline vient du primitif (cn-table-head) — on ne garde que l'espacement
const HEAD_CELL_CLS = 'py-[4.5px] px-1.5';

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
    <div className="overflow-x-hidden">
      <Table className="table-auto">
        <TableHeader>
          <TableRow>
            <TableHead className={HEAD_CELL_CLS}>Email</TableHead>
            <TableHead className={HEAD_CELL_CLS}>Role</TableHead>
            <TableHead className={HEAD_CELL_CLS}>Statut</TableHead>
            <TableHead className={HEAD_CELL_CLS}>Envoyee</TableHead>
            <TableHead className={HEAD_CELL_CLS}>Expire</TableHead>
            <TableHead className="py-[4.5px] ps-1.5 pe-[7.5px] text-end">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className={CELL_EMAIL_CLS}>
                <p className="cn-text-body2 font-medium text-[0.75rem] overflow-hidden text-ellipsis whitespace-nowrap" title={inv.invitedEmail}>
                  {inv.invitedEmail}
                </p>
              </TableCell>
              <TableCell className={CELL_CLS}>
                {(() => {
                  const roleColor = getOrgRoleHex(inv.roleInvited);
                  const RoleIcon = getOrgRoleIcon(inv.roleInvited);
                  return (
                    <StatusChip tokens={{ color: roleColor, bg: `${roleColor}18` }} label={getRoleLabel(inv.roleInvited)} icon={<RoleIcon size={11} strokeWidth={2} />} />
                  );
                })()}
              </TableCell>
              <TableCell className={CELL_CLS}>
                {getStatusChip(inv.status)}
              </TableCell>
              <TableCell className={CELL_CLS}>
                <p className="cn-text-body2 text-muted-foreground text-[0.75rem] tabular-nums">
                  {formatShortDate(inv.createdAt)}
                </p>
              </TableCell>
              <TableCell className={CELL_CLS}>
                <p className="cn-text-body2 text-muted-foreground text-[0.75rem] tabular-nums">
                  {formatShortDate(inv.expiresAt)}
                </p>
              </TableCell>
              <TableCell className="text-[0.75rem] py-[4.5px] ps-1.5 pe-[7.5px] text-end">
                {inv.status === 'PENDING' && (
                  <div className="inline-flex items-center gap-0.5">
                    <Tooltip>
                      {/* Le Button du kit ne transmet pas de ref : span d'ancrage. */}
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleResend(inv.id)}
                            disabled={actionLoading === inv.id}
                            aria-label="Renvoyer l'invitation"
                            className={cn(ACTION_BTN_BASE_CLS, ACTION_BTN_PRIMARY_CLS)}
                          >
                            {actionLoading === inv.id ? (
                              <Spinner className="size-[13px]" />
                            ) : (
                              <RefreshIcon size={13} strokeWidth={1.75} />
                            )}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Renvoyer l&apos;invitation</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleCancel(inv.id)}
                            disabled={actionLoading === inv.id}
                            aria-label="Annuler l'invitation"
                            className={cn(ACTION_BTN_BASE_CLS, ACTION_BTN_WARM_CLS)}
                          >
                            <CancelIcon size={13} strokeWidth={1.75} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Annuler l&apos;invitation</TooltipContent>
                    </Tooltip>
                  </div>
                )}
                {(inv.status === 'CANCELLED' || inv.status === 'EXPIRED') && (
                  <div className="inline-flex items-center gap-0.5 justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(inv.id)}
                            disabled={actionLoading === inv.id}
                            aria-label="Supprimer l'invitation"
                            className={cn(ACTION_BTN_BASE_CLS, ACTION_BTN_DANGER_CLS)}
                          >
                            {actionLoading === inv.id ? (
                              <Spinner className="size-[13px]" />
                            ) : (
                              <DeleteIcon size={13} strokeWidth={1.75} />
                            )}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Supprimer l&apos;invitation</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

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
