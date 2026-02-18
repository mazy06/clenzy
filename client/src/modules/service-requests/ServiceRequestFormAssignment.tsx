import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  alpha,
} from '@mui/material';
import { Person, Group, BlockOutlined } from '@mui/icons-material';
import { Controller, Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { REQUEST_STATUS_OPTIONS } from '../../types/statusEnums';
import { INTERVENTION_TYPE_OPTIONS } from '../../types/interventionTypes';
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
  watchedServiceType?: string;
  isEditMode: boolean;
  disabled?: boolean;
  eligibleTeamIds?: number[];
}

// ─── Assignment type chip config ─────────────────────────────────────────────

interface AssignmentTypeDef {
  value: '' | 'user' | 'team';
  label: string;
  icon: React.ReactElement;
  color: string;
}

const ASSIGNMENT_TYPES: AssignmentTypeDef[] = [
  { value: '', label: 'Aucune', icon: <BlockOutlined sx={{ fontSize: 14 }} />, color: '#94A3B8' },
  { value: 'user', label: 'Individuel', icon: <Person sx={{ fontSize: 14 }} />, color: '#6B8A9A' },
  { value: 'team', label: 'Équipe', icon: <Group sx={{ fontSize: 14 }} />, color: '#6B8A9A' },
];

/** Shared Select sx for consistent styling */
const SELECT_SX = {
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'grey.200',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'primary.light',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'primary.main',
  },
} as const;

/** Determine the service category from a service type value */
function getServiceCategory(serviceType: string): 'cleaning' | 'maintenance' | 'specialized' | 'other' {
  const option = INTERVENTION_TYPE_OPTIONS.find(o => o.value === serviceType);
  return option?.category || 'other';
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
    watchedServiceType,
    isEditMode,
    disabled = false,
    eligibleTeamIds,
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

    // Filter teams by eligible IDs from the selected forfait
    const filteredTeams = useMemo(() => {
      if (!eligibleTeamIds || eligibleTeamIds.length === 0) return teams;
      return teams.filter((team) => eligibleTeamIds.includes(team.id));
    }, [teams, eligibleTeamIds]);

    // ─── Auto-select assignment type based on service type ───
    // Cleaning services → auto-select 'team' (équipe d'entretien)
    // Maintenance services → auto-select 'team' (équipe de maintenance)
    // The actual team filtering by group will be added once group notion exists
    useEffect(() => {
      if (!watchedServiceType || !canAssignForProperty || isEditMode) return;

      const category = getServiceCategory(watchedServiceType);

      if (category === 'cleaning' || category === 'maintenance') {
        setValue('assignedToType', 'team');
        setValue('assignedToId', undefined);
      }
      // For 'specialized' and 'other', don't auto-select — let the user choose
    }, [watchedServiceType, canAssignForProperty, isEditMode, setValue]);

    // Handle assignment type chip click
    const handleAssignmentTypeClick = useCallback((value: '' | 'user' | 'team') => {
      if (disabled) return;
      setValue('assignedToType', value === '' ? undefined : value);
      setValue('assignedToId', undefined);
    }, [setValue, disabled]);

    // If no assignment capability and not in edit mode, nothing to render
    if (!canAssignForProperty && !isEditMode) {
      return null;
    }

    return (
      <>
        {/* Status field - only in edit mode */}
        {isEditMode && (
          <Box sx={{ mb: 2 }}>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth required disabled={disabled}>
                  <InputLabel shrink sx={{ color: 'text.secondary' }}>
                    {t('common.status')} *
                  </InputLabel>
                  <Select
                    value={field.value || 'PENDING'}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    label={`${t('common.status')} *`}
                    size="small"
                    disabled={disabled}
                    notched
                    sx={SELECT_SX}
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
          </Box>
        )}

        {/* Type d'assignation - Chips */}
        {canAssignForProperty && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
              {t('serviceRequests.fields.assignmentType')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {ASSIGNMENT_TYPES.map((at) => {
                const isSelected = (watchedAssignedToType || '') === at.value;
                return (
                  <Chip
                    key={at.value}
                    icon={at.icon}
                    label={at.label}
                    onClick={disabled ? undefined : () => handleAssignmentTypeClick(at.value)}
                    disabled={disabled}
                    variant={isSelected ? 'filled' : 'outlined'}
                    size="small"
                    sx={{
                      height: 30,
                      fontSize: '0.75rem',
                      fontWeight: isSelected ? 600 : 500,
                      borderWidth: 1.5,
                      borderColor: isSelected ? at.color : 'grey.200',
                      bgcolor: isSelected ? alpha(at.color, 0.12) : 'transparent',
                      color: isSelected ? at.color : 'text.secondary',
                      '& .MuiChip-icon': {
                        fontSize: 14,
                        ml: 0.5,
                        color: isSelected ? at.color : 'primary.main',
                      },
                      '& .MuiChip-label': { px: 0.75 },
                      '&:hover': disabled ? {} : {
                        bgcolor: alpha(at.color, 0.06),
                        borderColor: at.color,
                      },
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  />
                );
              })}
            </Box>

            {/* Indication auto-sélection */}
            {watchedServiceType && (
              (() => {
                const cat = getServiceCategory(watchedServiceType);
                if (cat === 'cleaning') {
                  return (
                    <Typography sx={{ fontSize: '0.5625rem', color: 'text.disabled', fontStyle: 'italic', mt: 0.5 }}>
                      Type nettoyage → assignation équipe pré-sélectionnée
                    </Typography>
                  );
                }
                if (cat === 'maintenance') {
                  return (
                    <Typography sx={{ fontSize: '0.5625rem', color: 'text.disabled', fontStyle: 'italic', mt: 0.5 }}>
                      Type maintenance → assignation équipe pré-sélectionnée
                    </Typography>
                  );
                }
                return null;
              })()
            )}
          </Box>
        )}

        {/* Assignation specifique - Select avec style cohérent */}
        {canAssignForProperty && watchedAssignedToType && (
          <Box sx={{ mb: 1 }}>
            <Controller
              name="assignedToId"
              control={control}
              render={({ field }) => {
                const selectedItem = watchedAssignedToType === 'user'
                  ? users.find(u => u.id === field.value)
                  : teams.find(t => t.id === field.value);
                const hasValue = !!selectedItem;

                return (
                  <FormControl fullWidth disabled={disabled}>
                    <InputLabel shrink sx={{ color: 'text.secondary' }}>
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
                      disabled={disabled}
                      displayEmpty
                      notched
                      sx={SELECT_SX}
                      renderValue={() => (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {watchedAssignedToType === 'user' ? (
                            <Person sx={{ fontSize: 16, color: hasValue ? 'primary.main' : 'grey.400' }} />
                          ) : (
                            <Group sx={{ fontSize: 16, color: hasValue ? 'primary.main' : 'grey.400' }} />
                          )}
                          <Typography sx={{ fontSize: '0.8125rem', color: hasValue ? 'text.secondary' : 'grey.400' }}>
                            {hasValue
                              ? watchedAssignedToType === 'user'
                                ? `${(selectedItem as typeof users[number]).firstName} ${(selectedItem as typeof users[number]).lastName}`
                                : (selectedItem as Team).name
                              : t('serviceRequests.fields.select')}
                          </Typography>
                        </Box>
                      )}
                    >
                      {watchedAssignedToType === 'user'
                        ? getAssignableUsers().map((user) => (
                            <MenuItem key={user.id} value={user.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Person sx={{ fontSize: 16, color: 'primary.main' }} />
                                <Box>
                                  <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                                    {user.firstName} {user.lastName}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.625rem', color: 'text.disabled' }}>
                                    {user.role} • {user.email}
                                  </Typography>
                                </Box>
                              </Box>
                            </MenuItem>
                          ))
                        : filteredTeams.map((team) => (
                            <MenuItem key={team.id} value={team.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Group sx={{ fontSize: 16, color: 'primary.main' }} />
                                <Box>
                                  <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', fontWeight: 500 }}>
                                    {team.name}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.625rem', color: 'text.disabled' }}>
                                    {team.memberCount} {t('serviceRequests.members')} • {getInterventionTypeLabel(team.interventionType)}
                                  </Typography>
                                </Box>
                              </Box>
                            </MenuItem>
                          ))}
                    </Select>
                  </FormControl>
                );
              }}
            />
          </Box>
        )}
      </>
    );
  }
);

ServiceRequestFormAssignment.displayName = 'ServiceRequestFormAssignment';

export default ServiceRequestFormAssignment;
