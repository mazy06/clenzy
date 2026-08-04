import React from 'react';
import {
  Button,
  Spinner,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  NativeSelect,
  NativeSelectOption,
  ToggleGroup,
  ToggleGroupItem,
} from '../../components/ui';
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
  <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="pe-8">Assigner l'intervention</DialogTitle>
        {selectedIntervention && (
          <DialogDescription>{selectedIntervention.title}</DialogDescription>
        )}
      </DialogHeader>

      <ToggleGroup
        type="single"
        value={assignType}
        onValueChange={(val) => {
          // Radix renvoie '' quand on deselectionne : on ignore, le choix reste exclusif.
          if (val === 'user' || val === 'team') {
            setAssignType(val);
            setAssignTargetId('');
          }
        }}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <ToggleGroupItem value="team" className="flex-1">
          <GroupIcon size={18} strokeWidth={1.75} />
          Équipe
        </ToggleGroupItem>
        <ToggleGroupItem value="user" className="flex-1">
          <PersonIcon size={18} strokeWidth={1.75} />
          Utilisateur
        </ToggleGroupItem>
      </ToggleGroup>

      <Field>
        <FieldLabel htmlFor="intervention-assign-target">
          {assignType === 'team' ? 'Équipe' : 'Utilisateur'}
        </FieldLabel>
        {/* Option vide desactivee : le select natif afficherait sinon la premiere
            equipe alors que l'etat vaut encore '' (rien de choisi). */}
        <NativeSelect
          id="intervention-assign-target"
          className="w-full"
          value={assignTargetId === '' ? '' : String(assignTargetId)}
          onChange={(e) => setAssignTargetId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <NativeSelectOption value="" disabled>
            {assignType === 'team' ? 'Choisir une équipe' : 'Choisir un utilisateur'}
          </NativeSelectOption>
          {assignType === 'team'
            ? teams.map((team) => (
                <NativeSelectOption key={team.id} value={team.id}>
                  {team.memberCount !== undefined
                    ? `${team.name} (${team.memberCount} membres)`
                    : team.name}
                </NativeSelectOption>
              ))
            : availableUsers.map((u) => (
                <NativeSelectOption key={u.id} value={u.id}>
                  {u.role
                    ? `${u.firstName} ${u.lastName} (${u.role})`
                    : `${u.firstName} ${u.lastName}`}
                </NativeSelectOption>
              ))}
        </NativeSelect>
      </Field>

      <DialogFooter>
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
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default InterventionAssignDialog;
