import React, { useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Person, Group } from '@mui/icons-material';
import { Controller, Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { REQUEST_STATUS_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequestFormValues } from '../../schemas';

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
  memberCount: number;
}

export interface ServiceRequestFormAssignmentProps {
  control: Control<ServiceRequestFormValues>;
  errors: FieldErrors<ServiceRequestFormValues>;
  setValue: UseFormSetValue<ServiceRequestFormValues>;
  users: User[];
  teams: Team[];
  canAssignForProperty: boolean;
  watchedAssignedToType: 'user' | 'team' | undefined;
  isEditMode: boolean;
}

const ServiceRequestFormAssignment: React.FC<ServiceRequestFormAssignmentProps> = React.memo(
  ({
    control,
    errors,
    setValue,
    users,
    teams,
    canAssignForProperty,
    watchedAssignedToType,
    isEditMode,
  }) => {
    const { t } = useTranslation();

    const statuses = REQUEST_STATUS_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
    }));

    const getAssignableUsers = useCallback(() => {
      return users.filter((user) =>
        ['housekeeper', 'technician', 'supervisor', 'manager'].includes(user.role.toLowerCase())
      );
    }, [users]);

    const getInterventionTypeLabel = useCallback(
      (type: string) => {
        const interventionTypes: Record<string, string> = {
          cleaning: t('serviceRequests.interventionTypes.cleaning'),
          maintenance: t('serviceRequests.interventionTypes.maintenance'),
          repair: t('serviceRequests.interventionTypes.repair'),
          inspection: t('serviceRequests.interventionTypes.inspection'),
          mixed: t('serviceRequests.interventionTypes.mixed'),
        };
        return interventionTypes[type.toLowerCase()] || type;
      },
      [t]
    );

    // If no assignment capability and not in edit mode, nothing to render
    if (!canAssignForProperty && !isEditMode) {
      return null;
    }

    return (
      <>
        {/* Status field - only in edit mode */}
        {isEditMode && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth required>
                    <InputLabel>{t('common.status')} *</InputLabel>
                    <Select
                      value={field.value || 'PENDING'}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      label={`${t('common.status')} *`}
                      size="small"
                    >
                      {statuses.map((status) => (
                        <MenuItem key={status.value} value={status.value}>
                          {status.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
          </Grid>
        )}

        {/* Type d'assignation - only when user can assign */}
        {canAssignForProperty && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Controller
                name="assignedToType"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>{t('serviceRequests.fields.assignmentType')}</InputLabel>
                    <Select
                      value={field.value || ''}
                      onChange={(e) => {
                        const val = e.target.value as 'user' | 'team' | '';
                        field.onChange(val || undefined);
                        setValue('assignedToId', undefined);
                      }}
                      onBlur={field.onBlur}
                      label={t('serviceRequests.fields.assignmentType')}
                      size="small"
                    >
                      <MenuItem value="">
                        <em>{t('serviceRequests.fields.noAssignment')}</em>
                      </MenuItem>
                      <MenuItem value="user">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Person sx={{ fontSize: 18 }} />
                          <Typography variant="body2">
                            {t('serviceRequests.fields.individualUser')}
                          </Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="team">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Group sx={{ fontSize: 18 }} />
                          <Typography variant="body2">
                            {t('serviceRequests.fields.team')}
                          </Typography>
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
          </Grid>
        )}

        {/* Assignation specifique */}
        {canAssignForProperty && watchedAssignedToType && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12}>
              <Controller
                name="assignedToId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>
                      {watchedAssignedToType === 'user'
                        ? t('serviceRequests.fields.assignedToUser')
                        : t('serviceRequests.fields.assignedToTeam')}
                    </InputLabel>
                    <Select
                      value={field.value || ''}
                      onChange={(e) =>
                        field.onChange(e.target.value ? Number(e.target.value) : undefined)
                      }
                      onBlur={field.onBlur}
                      label={
                        watchedAssignedToType === 'user'
                          ? t('serviceRequests.fields.assignedToUser')
                          : t('serviceRequests.fields.assignedToTeam')
                      }
                      size="small"
                    >
                      <MenuItem value="">
                        <em>{t('serviceRequests.fields.select')}</em>
                      </MenuItem>
                      {watchedAssignedToType === 'user'
                        ? getAssignableUsers().map((user) => (
                            <MenuItem key={user.id} value={user.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Person sx={{ fontSize: 18 }} />
                                <Typography variant="body2">
                                  {user.firstName} {user.lastName} ({user.role}) - {user.email}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))
                        : teams.map((team) => (
                            <MenuItem key={team.id} value={team.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Group sx={{ fontSize: 18 }} />
                                <Box>
                                  <Typography
                                    variant="body2"
                                    fontWeight={500}
                                    sx={{ fontSize: '0.85rem' }}
                                  >
                                    {team.name}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ fontSize: '0.7rem' }}
                                  >
                                    {team.memberCount} {t('serviceRequests.members')}{' '}
                                    {'\u2022'} {getInterventionTypeLabel(team.interventionType)}
                                  </Typography>
                                </Box>
                              </Box>
                            </MenuItem>
                          ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
          </Grid>
        )}
      </>
    );
  }
);

ServiceRequestFormAssignment.displayName = 'ServiceRequestFormAssignment';

export default ServiceRequestFormAssignment;
