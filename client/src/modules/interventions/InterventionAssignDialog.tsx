import React from 'react';
import {
  Box, Typography, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButton, ToggleButtonGroup, FormControl, InputLabel, Select as MuiSelect, MenuItem,
} from '@mui/material';
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.8125rem' }}>
          {selectedIntervention.title}
        </Typography>
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
          <Box component="span" sx={{ display: "inline-flex", mr: 0.5 }}><GroupIcon size={18} strokeWidth={1.75} /></Box>
          Équipe
        </ToggleButton>
        <ToggleButton value="user" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
          <Box component="span" sx={{ display: "inline-flex", mr: 0.5 }}><PersonIcon size={18} strokeWidth={1.75} /></Box>
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
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({team.memberCount} membres)
                    </Typography>
                  )}
                </MenuItem>
              ))
            : availableUsers.map((u) => (
                <MenuItem key={u.id} value={u.id} sx={{ fontSize: '0.875rem' }}>
                  {u.firstName} {u.lastName}
                  {u.role && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({u.role})
                    </Typography>
                  )}
                </MenuItem>
              ))}
        </MuiSelect>
      </FormControl>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} size="small" sx={{ textTransform: 'none' }}>
        Annuler
      </Button>
      <Button
        onClick={onAssign}
        variant="contained"
        size="small"
        disabled={assignTargetId === '' || assignLoading}
        sx={{ textTransform: 'none' }}
      >
        {assignLoading ? <CircularProgress size={18} /> : 'Assigner'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default InterventionAssignDialog;
