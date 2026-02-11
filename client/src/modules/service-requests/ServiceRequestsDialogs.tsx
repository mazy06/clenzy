import React from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
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
      <DialogTitle sx={{ pb: 1 }}>{t('serviceRequests.confirmDelete')}</DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        <Typography variant="body2">
          {t('serviceRequests.confirmDeleteMessage', { title: requestTitle })}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button onClick={onClose} size="small">{t('common.cancel')}</Button>
        <Button onClick={onConfirm} color="error" variant="contained" size="small">
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
      <DialogTitle sx={{ pb: 1 }}>{t('serviceRequests.changeStatus')}</DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        <Typography variant="caption" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
          {t('serviceRequests.changeStatusMessage', { title: requestTitle })}
        </Typography>
        <FormControl fullWidth>
          <InputLabel>{t('serviceRequests.newStatus')}</InputLabel>
          <Select
            value={newStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            label="Nouveau statut"
            size="small"
          >
            {statuses
              .filter(status => status.value !== 'all')
              .map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  {status.label}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button onClick={onClose} size="small">{t('common.cancel')}</Button>
        <Button onClick={onConfirm} variant="contained" size="small">
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
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('serviceRequests.assign')}: <strong>{selectedRequest.title}</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('serviceRequests.assignDescription')}
            </Typography>
          </Box>
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
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="primary"
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

interface ValidateConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedRequest: ServiceRequest | null;
  validating: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function ValidateConfirmDialog({
  open,
  onClose,
  onConfirm,
  selectedRequest,
  validating,
  t,
}: ValidateConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!validating) {
          onClose();
        }
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckCircle color="success" />
        {t('serviceRequests.validateAndCreateIntervention')}
      </DialogTitle>
      <DialogContent>
        {selectedRequest && (
          <Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {t('serviceRequests.confirmValidation', { title: selectedRequest.title })}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('serviceRequests.validateAndCreateInterventionDescription')}
            </Typography>
            {selectedRequest.assignedToName && (
              <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {selectedRequest.assignedToType === 'team' ? t('serviceRequests.fields.team') : t('serviceRequests.fields.assignedToUser')}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {selectedRequest.assignedToName}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button
          onClick={onClose}
          disabled={validating}
          size="small"
        >
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="success"
          disabled={validating}
          size="small"
          startIcon={validating ? <CircularProgress size={16} /> : <CheckCircle />}
        >
          {validating ? t('common.processing') : t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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
        <Cancel color="error" />
        {t('common.error')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button
          onClick={onClose}
          variant="contained"
          color="error"
          size="small"
        >
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
        <CheckCircle color="success" />
        {t('common.success')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button
          onClick={onClose}
          variant="contained"
          color="success"
          size="small"
        >
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
