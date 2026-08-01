import React from 'react';
import { Spinner, Button } from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, Select, FormControl, InputLabel, MenuItem, Radio, RadioGroup, FormControlLabel, FormLabel } from '@mui/material';
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
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t('serviceRequests.confirmDelete')}</DialogTitle>
      <DialogContent>
        <p className="cn-text-body2">
          {t('serviceRequests.confirmDeleteMessage', { title: requestTitle })}
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="ghost" size="sm">{t('common.cancel')}</Button>
        <Button onClick={onConfirm} variant="destructive" size="sm">
          {t('serviceRequests.delete')}
        </Button>
      </DialogActions>
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
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t('serviceRequests.changeStatus')}</DialogTitle>
      <DialogContent>
        <span className="cn-text-caption mb-2 text-[0.75rem]">
          {t('serviceRequests.changeStatusMessage', { title: requestTitle })}
        </span>
        <FormControl fullWidth>
          <InputLabel>{t('serviceRequests.newStatus')}</InputLabel>
          <Select
            value={newStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            label="Nouveau statut"
            size="small"
          >
            {statuses.flatMap((status) =>
              status.value === 'all'
                ? []
                : [
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>,
                  ],
            )}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="ghost" size="sm">{t('common.cancel')}</Button>
        <Button onClick={onConfirm} size="sm">
          {t('common.confirm')}
        </Button>
      </DialogActions>
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {t('serviceRequests.assign')}
      </DialogTitle>
      <DialogContent>
        {selectedRequest && (
          <div className="mb-3">
            <p className="cn-text-body2 text-muted-foreground mb-1.5">
              {t('serviceRequests.assign')}: <strong>{selectedRequest.title}</strong>
            </p>
            <span className="cn-text-caption text-muted-foreground">
              {t('serviceRequests.assignDescription')}
            </span>
          </div>
        )}

        <FormControl component="fieldset" sx={{ width: '100%', mt: 2 }}>
          <FormLabel component="legend">{t('serviceRequests.assignmentType')}</FormLabel>
          <RadioGroup
            value={assignmentType}
            onChange={(e) => {
              onAssignmentTypeChange(e.target.value as 'team' | 'user' | 'none');
            }}
          >
            <FormControlLabel value="team" control={<Radio />} label={t('serviceRequests.fields.team')} />
            {assignmentType === 'team' && (
              <FormControl fullWidth sx={{ ml: 4, mt: 1, mb: 2 }}>
                <InputLabel>{t('serviceRequests.fields.team')}</InputLabel>
                <Select
                  value={selectedTeamId || ''}
                  onChange={(e) => onTeamChange(e.target.value as number)}
                  label={t('serviceRequests.fields.team')}
                  disabled={loadingData}
                >
                  {teams.length === 0 && !loadingData && (
                    <MenuItem disabled>{t('serviceRequests.noTeamsAvailable')}</MenuItem>
                  )}
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControlLabel value="user" control={<Radio />} label={t('serviceRequests.fields.assignedToUser')} />
            {assignmentType === 'user' && (
              <FormControl fullWidth sx={{ ml: 4, mt: 1, mb: 2 }}>
                <InputLabel>{t('serviceRequests.fields.assignedToUser')}</InputLabel>
                <Select
                  value={selectedUserId || ''}
                  onChange={(e) => onUserChange(e.target.value as number)}
                  label={t('serviceRequests.fields.assignedToUser')}
                  disabled={loadingData}
                >
                  {users.length === 0 && !loadingData && (
                    <MenuItem disabled>{t('serviceRequests.noUsersAvailable')}</MenuItem>
                  )}
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.role})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControlLabel value="none" control={<Radio />} label={t('serviceRequests.fields.noAssignment')} />
          </RadioGroup>
        </FormControl>

        {loadingData && (
          <div className="flex justify-center py-3">
            <Spinner className="size-6" />
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="ghost">
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loadingData || (assignmentType === 'team' && !selectedTeamId) || (assignmentType === 'user' && !selectedUserId)}
        >
          {t('serviceRequests.assign')}
        </Button>
      </DialogActions>
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
        <span className="inline-flex text-destructive"><Cancel size={20} strokeWidth={1.75} /></span>
        {t('common.error')}
      </DialogTitle>
      <DialogContent>
        <p className="cn-text-body2">
          {message}
        </p>
      </DialogContent>
      <DialogActions>
        {/* Fermer n'est pas une action destructive : c'est la seule action de la modale, donc `default`.
            La tonalite d'erreur est deja portee par le titre. */}
        <Button onClick={onClose} size="sm">
          {t('common.close')}
        </Button>
      </DialogActions>
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
        <span className="inline-flex text-[var(--bui-success-ink)]"><CheckCircle size={20} strokeWidth={1.75} /></span>
        {t('common.success')}
      </DialogTitle>
      <DialogContent>
        <p className="cn-text-body2">
          {message}
        </p>
      </DialogContent>
      <DialogActions>
        {/* Seule action de la modale de succes -> `default`, la tonalite verte reste sur le titre. */}
        <Button onClick={onClose} size="sm">
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
