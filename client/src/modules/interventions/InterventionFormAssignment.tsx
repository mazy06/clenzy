import React from 'react';
import {
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
} from '@mui/material';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { InterventionFormValues } from '../../schemas';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
}

export interface InterventionFormAssignmentProps {
  control: Control<InterventionFormValues>;
  errors: FieldErrors<InterventionFormValues>;
  setValue: UseFormSetValue<InterventionFormValues>;
  users: User[];
  teams: Team[];
  watchedAssignedToType: 'user' | 'team' | undefined;
}

const InterventionFormAssignment: React.FC<InterventionFormAssignmentProps> = React.memo(
  ({ control, errors, setValue, users, teams, watchedAssignedToType }) => {
    const { t } = useTranslation();

    return (
      <Card sx={{ mb: 1.5 }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
            {t('interventions.sections.assignment')}
          </Typography>

          <Controller
            name="assignedToType"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth sx={{ mb: 1.5 }}>
                <InputLabel>{t('interventions.fields.assignmentType')}</InputLabel>
                <Select
                  value={field.value || ''}
                  onChange={(e) => {
                    const val = e.target.value as 'user' | 'team' | '';
                    field.onChange(val || undefined);
                    setValue('assignedToId', undefined);
                  }}
                  label={t('interventions.fields.assignmentType')}
                  size="small"
                >
                  <MenuItem value="">{t('interventions.fields.noAssignment')}</MenuItem>
                  <MenuItem value="user">{t('interventions.fields.user')}</MenuItem>
                  <MenuItem value="team">{t('interventions.fields.team')}</MenuItem>
                </Select>
              </FormControl>
            )}
          />

          {watchedAssignedToType === 'user' && (
            <Controller
              name="assignedToId"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>{t('interventions.fields.assignedUser')}</InputLabel>
                  <Select
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    label={t('interventions.fields.assignedUser')}
                    size="small"
                  >
                    {users.filter(user => ['TECHNICIAN', 'SUPERVISOR', 'MANAGER'].includes(user.role)).map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        <Typography variant="body2">{user.firstName} {user.lastName} ({user.role})</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          )}

          {watchedAssignedToType === 'team' && (
            <Controller
              name="assignedToId"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>{t('interventions.fields.assignedTeam')}</InputLabel>
                  <Select
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    label={t('interventions.fields.assignedTeam')}
                    size="small"
                  >
                    {teams.map((team) => (
                      <MenuItem key={team.id} value={team.id}>
                        <Typography variant="body2">{team.name} ({team.interventionType})</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          )}
        </CardContent>
      </Card>
    );
  }
);

InterventionFormAssignment.displayName = 'InterventionFormAssignment';

export default InterventionFormAssignment;
