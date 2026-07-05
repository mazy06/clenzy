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
} from '@mui/material';
import { Person, Group, BlockOutlined } from '../../icons';
import { Controller, Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
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
  /** Ids des techniciens qui PROPOSENT les prestations du devis (mis en avant). */
  matchingUserIds?: number[];
}

// ─── Assignment type chip config (tokens — actif = texte couleur + fond -soft) ──

interface AssignmentTypeDef {
  value: '' | 'user' | 'team';
  label: string;
  icon: React.ReactElement;
  fg: string;
  bg: string;
}

const ASSIGNMENT_TYPES: AssignmentTypeDef[] = [
  { value: '', label: 'Aucune', icon: <BlockOutlined size={14} strokeWidth={1.75} />, fg: 'var(--muted)', bg: 'var(--hover)' },
  { value: 'user', label: 'Individuel', icon: <Person size={14} strokeWidth={1.75} />, fg: 'var(--accent)', bg: 'var(--accent-soft)' },
  { value: 'team', label: 'Équipe', icon: <Group size={14} strokeWidth={1.75} />, fg: 'var(--accent)', bg: 'var(--accent-soft)' },
];

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
    matchingUserIds = [],
  }) => {
    const { t } = useTranslation();

    const matchingSet = React.useMemo(() => new Set(matchingUserIds), [matchingUserIds]);

    const getAssignableUsers = useCallback(() => {
      const assignable = users.filter((user) =>
        ['housekeeper', 'technician', 'supervisor', 'manager'].includes(user.role.toLowerCase())
      );
      // Techniciens qui proposent les prestations du devis d'abord (P2).
      return [...assignable].sort((a, b) => {
        const am = matchingSet.has(a.id) ? 0 : 1;
        const bm = matchingSet.has(b.id) ? 0 : 1;
        return am - bm;
      });
    }, [users, matchingSet]);

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

        {/* Type d'assignation - Chips */}
        {canAssignForProperty && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', mb: 0.75 }}>
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
                    size="small"
                    aria-pressed={isSelected}
                    sx={{
                      height: 30,
                      fontSize: '11.5px',
                      fontWeight: isSelected ? 600 : 500,
                      border: '1px solid',
                      borderColor: isSelected ? at.fg : 'var(--line-2)',
                      bgcolor: isSelected ? at.bg : 'var(--card)',
                      color: isSelected ? at.fg : 'var(--body)',
                      '& .MuiChip-icon': {
                        fontSize: 14,
                        ml: 0.5,
                        color: isSelected ? at.fg : 'var(--muted)',
                      },
                      '& .MuiChip-label': { px: 0.75 },
                      '&:hover': disabled ? {} : {
                        bgcolor: isSelected ? at.bg : 'var(--hover)',
                        borderColor: at.fg,
                      },
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: disabled ? 0.45 : 1,
                      transition: 'background-color .15s, border-color .15s, color .15s',
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
                    <Typography sx={{ fontSize: '10px', color: 'var(--faint)', fontStyle: 'italic', mt: 0.5 }}>
                      Type nettoyage → assignation équipe pré-sélectionnée
                    </Typography>
                  );
                }
                if (cat === 'maintenance') {
                  return (
                    <Typography sx={{ fontSize: '10px', color: 'var(--faint)', fontStyle: 'italic', mt: 0.5 }}>
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
                    <InputLabel shrink>
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
                      renderValue={() => (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {watchedAssignedToType === 'user' ? (
                            <Box component="span" sx={{ display: 'inline-flex', color: hasValue ? 'var(--accent)' : 'var(--faint)' }}><Person size={16} strokeWidth={1.75} /></Box>
                          ) : (
                            <Box component="span" sx={{ display: 'inline-flex', color: hasValue ? 'var(--accent)' : 'var(--faint)' }}><Group size={16} strokeWidth={1.75} /></Box>
                          )}
                          <Typography sx={{ fontSize: '12.5px', color: hasValue ? 'var(--body)' : 'var(--faint)' }}>
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
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%' }}>
                                <Box component="span" sx={{ display: 'inline-flex', color: matchingSet.has(user.id) ? 'var(--ok)' : 'var(--accent)' }}><Person size={16} strokeWidth={1.75} /></Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontSize: '12.5px', color: 'var(--body)' }}>
                                    {user.firstName} {user.lastName}
                                  </Typography>
                                  <Typography sx={{ fontSize: '10.5px', color: 'var(--faint)' }}>
                                    {user.role} • {user.email}
                                  </Typography>
                                </Box>
                                {matchingSet.has(user.id) && (
                                  <Chip
                                    label="Propose"
                                    size="small"
                                    sx={{ height: 18, fontSize: '9.5px', fontWeight: 700, color: 'var(--ok)', bgcolor: 'var(--ok-soft)', '& .MuiChip-label': { px: 0.75 } }}
                                  />
                                )}
                              </Box>
                            </MenuItem>
                          ))
                        : filteredTeams.map((team) => (
                            <MenuItem key={team.id} value={team.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Group size={16} strokeWidth={1.75} /></Box>
                                <Box>
                                  <Typography sx={{ fontSize: '12.5px', color: 'var(--body)', fontWeight: 500 }}>
                                    {team.name}
                                  </Typography>
                                  <Typography sx={{ fontSize: '10.5px', color: 'var(--faint)' }}>
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
