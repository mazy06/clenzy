import React from 'react';
import { Button, Spinner } from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, ToggleButton, ToggleButtonGroup, FormControl, InputLabel, Select as MuiSelect, MenuItem } from '@mui/material';
import { Person as PersonIcon, Group as GroupIcon } from '../../icons';
import type { Team } from '../../services/api';
import type { User } from '../../services/api/usersApi';
import type { Intervention } from './useInterventionsList';

interface InterventionAssignDialogProps {
  open: boolean;
  selectedIntervention: Intervention | null;
  assignType: 'user' | 'team';
  assignTargetId: number | '';
  teams: Team[];
  availableUsers: User[];
  assignLoading: boolean;
  onClose: () => void;
  onAssign: () => void;
  setAssignType: React.Dispatch<React.SetStateAction<'user' | 'team'>>;
  setAssignTargetId: React.Dispatch<React.SetStateAction<number | ''>>;
}

/** Dialog d'assignation rapide d'une intervention à une équipe ou un utilisateur. */
const InterventionAssignDialog: React.FC<InterventionAssignDialogProps> = ({
  open, selectedIntervention, assignType, assignTargetId, teams, availableUsers,
  assignLoading, onClose, onAssign, setAssignType, setAssignTargetId,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="xs"
    fullWidth
    PaperProps={{ sx: { borderRadius: 2 } }}
  >
    <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>
      Assigner l'intervention
      {selectedIntervention && (
        <p className="cn-text-body2 text-muted-foreground mt-0.5 text-[0.8125rem]">
          {selectedIntervention.title}
        </p>
      )}
    </DialogTitle>
    <DialogContent sx={{ pt: 2 }}>
      <ToggleButtonGroup
        value={assignType}
        exclusive
        onChange={(_e, val) => {
          if (val !== null) {
            setAssignType(val);
            setAssignTargetId('');
          }
        }}
        size="small"
        fullWidth
        sx={{ mb: 2 }}
      >
        <ToggleButton value="team" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
          <span className="inline-flex me-0.5"><GroupIcon size={18} strokeWidth={1.75} /></span>
          Équipe
        </ToggleButton>
        <ToggleButton value="user" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
          <span className="inline-flex me-0.5"><PersonIcon size={18} strokeWidth={1.75} /></span>
          Utilisateur
        </ToggleButton>
      </ToggleButtonGroup>

      <FormControl fullWidth size="small">
        <InputLabel>{assignType === 'team' ? 'Équipe' : 'Utilisateur'}</InputLabel>
        <MuiSelect
          value={assignTargetId}
          onChange={(e) => setAssignTargetId(e.target.value as number)}
          label={assignType === 'team' ? 'Équipe' : 'Utilisateur'}
        >
          {assignType === 'team'
            ? teams.map((team) => (
                <MenuItem key={team.id} value={team.id} sx={{ fontSize: '0.875rem' }}>
                  {team.name}
                  {team.memberCount !== undefined && (
                    <span className="cn-text-caption text-muted-foreground ms-1.5">
                      ({team.memberCount} membres)
                    </span>
                  )}
                </MenuItem>
              ))
            : availableUsers.map((u) => (
                <MenuItem key={u.id} value={u.id} sx={{ fontSize: '0.875rem' }}>
                  {u.firstName} {u.lastName}
                  {u.role && (
                    <span className="cn-text-caption text-muted-foreground ms-1.5">
                      ({u.role})
                    </span>
                  )}
                </MenuItem>
              ))}
        </MuiSelect>
      </FormControl>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button variant="outline" size="sm" onClick={onClose}>
        Annuler
      </Button>
      <Button
        size="sm"
        onClick={onAssign}
        disabled={assignTargetId === '' || assignLoading}
      >
        {assignLoading ? <Spinner className="size-[18px]" /> : 'Assigner'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default InterventionAssignDialog;
