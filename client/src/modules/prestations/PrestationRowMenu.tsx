import type { MouseEvent, ReactNode } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui';
import {
  Assignment,
  Cancel,
  Delete,
  Edit,
  MoreHoriz,
  Visibility,
} from '../../icons';
import type { Intervention } from '../interventions/useInterventionsList';
import type { ServiceRequest } from '../service-requests/serviceRequestsUtils';
import { usePrestationActions } from './PrestationActionsContext';

/** Déclencheur « … » commun aux deux menus, aligné en fin de ligne. */
function MenuShell({ label, onOpen, children }: { label: string; onOpen: (event: MouseEvent<HTMLElement>) => void; children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onOpen} className="cursor-pointer">
            <MoreHoriz size={18} strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-[13rem]">{children}</DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Actions d'une intervention : celles de l'ancien écran Interventions. */
export function InterventionRowMenu({ intervention }: { intervention: Intervention }) {
  const actions = usePrestationActions();
  if (!actions) return null;
  const { handleMenuOpen, handleViewDetails, handleOpenAssignDialog, handleEdit, handleDelete,
    canModifyIntervention, canDeleteInterventions, isAdmin, isManager, t } = actions.intervention;
  return (
    <MenuShell label={t('prestations.actions', 'Actions')} onOpen={(event) => handleMenuOpen(event, intervention)}>
      <DropdownMenuItem onSelect={handleViewDetails}>
        <Visibility size={18} strokeWidth={1.75} />
        {t('interventions.viewDetails')}
      </DropdownMenuItem>
      {(isManager() || isAdmin()) && intervention.status === 'PENDING' && (
        <DropdownMenuItem onSelect={handleOpenAssignDialog}>
          <Assignment size={18} strokeWidth={1.75} className="text-primary" />
          {t('serviceRequests.assign')}
        </DropdownMenuItem>
      )}
      {canModifyIntervention(intervention) && (
        <DropdownMenuItem onSelect={handleEdit}>
          <Edit size={18} strokeWidth={1.75} />
          {t('serviceRequests.modify')}
        </DropdownMenuItem>
      )}
      {canDeleteInterventions && (
        <DropdownMenuItem onSelect={handleDelete}>
          <Delete size={18} strokeWidth={1.75} />
          {t('interventions.delete')}
        </DropdownMenuItem>
      )}
    </MenuShell>
  );
}

/** Actions d'une demande : celles de l'ancien écran Demandes de service. */
export function RequestRowMenu({ request }: { request: ServiceRequest }) {
  const actions = usePrestationActions();
  if (!actions) return null;
  const {
    handleMenuOpen, handleViewDetails, handleAssignServiceRequest, handleEdit, handleDelete,
    canModifyServiceRequest, canDeleteServiceRequest, canCancelServiceRequest, getRemainingCancellationTime,
    setSelectedRequestForStatusChange, setNewStatus, setStatusChangeDialogOpen, isAdmin, isManager, t,
  } = actions.request;
  return (
    <MenuShell label={t('prestations.actions', 'Actions')} onOpen={(event) => handleMenuOpen(event, request)}>
      <DropdownMenuItem onSelect={handleViewDetails}>
        <Visibility size={18} strokeWidth={1.75} />
        {t('serviceRequests.viewDetails')}
      </DropdownMenuItem>
      {(isAdmin() || isManager()) && request.status === 'PENDING' && !request.assignedToId && (
        <DropdownMenuItem onSelect={() => handleAssignServiceRequest(request)}>
          <Assignment size={18} strokeWidth={1.75} className="text-primary" />
          {t('serviceRequests.assign')}
        </DropdownMenuItem>
      )}
      {canModifyServiceRequest(request) && (
        <DropdownMenuItem onSelect={handleEdit}>
          <Edit size={18} strokeWidth={1.75} />
          {t('serviceRequests.modify')}
        </DropdownMenuItem>
      )}
      {canDeleteServiceRequest(request) && (
        <DropdownMenuItem onSelect={handleDelete}>
          <Delete size={18} strokeWidth={1.75} />
          {t('serviceRequests.delete')}
        </DropdownMenuItem>
      )}
      {canCancelServiceRequest(request) && (
        <DropdownMenuItem
          onSelect={() => {
            setSelectedRequestForStatusChange(request);
            setNewStatus('CANCELLED');
            setStatusChangeDialogOpen(true);
          }}
        >
          <Cancel size={18} strokeWidth={1.75} className="text-warning" />
          <span className="flex flex-col">
            <span>{t('serviceRequests.cancel')}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t('prestations.cancelRemaining', {
                hours: Math.round(getRemainingCancellationTime(request.createdAt)),
                defaultValue: 'Temps restant : {{hours}} h',
              })}
            </span>
          </span>
        </DropdownMenuItem>
      )}
    </MenuShell>
  );
}
