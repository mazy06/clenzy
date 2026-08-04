import React from 'react';
import {
  Spinner,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
  NativeSelect,
  NativeSelectOption,
  RadioGroup,
  RadioGroupItem,
} from '../../components/ui';
import {
  CheckCircle,
  Cancel,
} from '../../icons';
import type { ServiceRequest, AssignTeam, AssignUser } from './serviceRequestsUtils';

// ============================================================================
// DELETE CONFIRM DIALOG
// ============================================================================

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  requestTitle?: string;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function DeleteConfirmDialog({ open, onClose, onConfirm, requestTitle, t }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('serviceRequests.confirmDelete')}</DialogTitle>
          <DialogDescription>
            {t('serviceRequests.confirmDeleteMessage', { title: requestTitle })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose} variant="ghost" size="sm">{t('common.cancel')}</Button>
          <Button onClick={onConfirm} variant="destructive" size="sm">
            {t('serviceRequests.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// STATUS CHANGE DIALOG
// ============================================================================

interface StatusChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  requestTitle?: string;
  newStatus: string;
  onStatusChange: (status: string) => void;
  statuses: Array<{ value: string; label: string }>;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function StatusChangeDialog({
  open,
  onClose,
  onConfirm,
  requestTitle,
  newStatus,
  onStatusChange,
  statuses,
  t,
}: StatusChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('serviceRequests.changeStatus')}</DialogTitle>
          <DialogDescription>
            {t('serviceRequests.changeStatusMessage', { title: requestTitle })}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="service-request-new-status">{t('serviceRequests.newStatus')}</FieldLabel>
          <NativeSelect
            id="service-request-new-status"
            className="w-full"
            size="sm"
            value={newStatus}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {statuses.flatMap((status) =>
              status.value === 'all'
                ? []
                : [
                    <NativeSelectOption key={status.value} value={status.value}>
                      {status.label}
                    </NativeSelectOption>,
                  ],
            )}
          </NativeSelect>
        </Field>
        <DialogFooter>
          <Button onClick={onClose} variant="ghost" size="sm">{t('common.cancel')}</Button>
          <Button onClick={onConfirm} size="sm">
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ASSIGN DIALOG
// ============================================================================

interface AssignDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedRequest: ServiceRequest | null;
  assignmentType: 'team' | 'user' | 'none';
  onAssignmentTypeChange: (type: 'team' | 'user' | 'none') => void;
  selectedTeamId: number | null;
  onTeamChange: (id: number) => void;
  selectedUserId: number | null;
  onUserChange: (id: number) => void;
  teams: AssignTeam[];
  users: AssignUser[];
  loadingData: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function AssignDialog({
  open,
  onClose,
  onConfirm,
  selectedRequest,
  assignmentType,
  onAssignmentTypeChange,
  selectedTeamId,
  onTeamChange,
  selectedUserId,
  onUserChange,
  teams,
  users,
  loadingData,
  t,
}: AssignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('serviceRequests.assign')}</DialogTitle>
          <DialogDescription>
            {t('serviceRequests.assignDescription')}
          </DialogDescription>
        </DialogHeader>

        {selectedRequest && (
          <p className="cn-text-body2 text-muted-foreground">
            {t('serviceRequests.assign')}: <strong>{selectedRequest.title}</strong>
          </p>
        )}

        <FieldSet className="w-full mt-3">
          <FieldLegend variant="label">{t('serviceRequests.assignmentType')}</FieldLegend>
          <RadioGroup
            value={assignmentType}
            onValueChange={(value) => onAssignmentTypeChange(value as 'team' | 'user' | 'none')}
          >
            <Field orientation="horizontal">
              <RadioGroupItem value="team" id="assign-type-team" />
              <FieldLabel htmlFor="assign-type-team" className="font-normal">
                {t('serviceRequests.fields.team')}
              </FieldLabel>
            </Field>
            {assignmentType === 'team' && (
              <Field className="ms-6 mt-1.5 mb-3">
                <FieldLabel htmlFor="assign-team-select">{t('serviceRequests.fields.team')}</FieldLabel>
                <NativeSelect
                  id="assign-team-select"
                  className="w-full"
                  value={selectedTeamId ?? ''}
                  // Le choix vide est le placeholder : on ignore la selection plutot
                  // que de remonter un identifiant 0 au parent (prop typee `number`).
                  onChange={(e) => { if (e.target.value) onTeamChange(Number(e.target.value)); }}
                  disabled={loadingData}
                >
                  <NativeSelectOption value="">
                    {teams.length === 0 && !loadingData ? t('serviceRequests.noTeamsAvailable') : '—'}
                  </NativeSelectOption>
                  {teams.map((team) => (
                    <NativeSelectOption key={team.id} value={team.id}>
                      {team.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}

            <Field orientation="horizontal">
              <RadioGroupItem value="user" id="assign-type-user" />
              <FieldLabel htmlFor="assign-type-user" className="font-normal">
                {t('serviceRequests.fields.assignedToUser')}
              </FieldLabel>
            </Field>
            {assignmentType === 'user' && (
              <Field className="ms-6 mt-1.5 mb-3">
                <FieldLabel htmlFor="assign-user-select">{t('serviceRequests.fields.assignedToUser')}</FieldLabel>
                <NativeSelect
                  id="assign-user-select"
                  className="w-full"
                  value={selectedUserId ?? ''}
                  onChange={(e) => { if (e.target.value) onUserChange(Number(e.target.value)); }}
                  disabled={loadingData}
                >
                  <NativeSelectOption value="">
                    {users.length === 0 && !loadingData ? t('serviceRequests.noUsersAvailable') : '—'}
                  </NativeSelectOption>
                  {users.map((user) => (
                    <NativeSelectOption key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.role})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}

            <Field orientation="horizontal">
              <RadioGroupItem value="none" id="assign-type-none" />
              <FieldLabel htmlFor="assign-type-none" className="font-normal">
                {t('serviceRequests.fields.noAssignment')}
              </FieldLabel>
            </Field>
          </RadioGroup>
        </FieldSet>

        {loadingData && (
          <div className="flex justify-center py-3">
            <Spinner className="size-6" />
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose} variant="ghost">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loadingData || (assignmentType === 'team' && !selectedTeamId) || (assignmentType === 'user' && !selectedUserId)}
          >
            {t('serviceRequests.assign')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// VALIDATE CONFIRM DIALOG
// ============================================================================

// ============================================================================
// ERROR DIALOG
// ============================================================================

interface ErrorDialogProps {
  open: boolean;
  onClose: () => void;
  message: string;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function ErrorDialog({ open, onClose, message, t }: ErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 text-[var(--err)]">
            <span className="inline-flex text-destructive"><Cancel size={20} strokeWidth={1.75} /></span>
            {t('common.error')}
          </DialogTitle>
          <DialogDescription>
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {/* Fermer n'est pas une action destructive : c'est la seule action de la modale, donc `default`.
              La tonalite d'erreur est deja portee par le titre. */}
          <Button onClick={onClose} size="sm">
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// SUCCESS DIALOG
// ============================================================================

interface SuccessDialogProps {
  open: boolean;
  onClose: () => void;
  message: string;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function SuccessDialog({ open, onClose, message, t }: SuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 text-[var(--ok)]">
            <span className="inline-flex text-[var(--bui-success-ink)]"><CheckCircle size={20} strokeWidth={1.75} /></span>
            {t('common.success')}
          </DialogTitle>
          <DialogDescription>
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {/* Seule action de la modale de succes -> `default`, la tonalite verte reste sur le titre. */}
          <Button onClick={onClose} size="sm">
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
