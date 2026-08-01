import React, { useCallback, useEffect, useMemo } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { SELECT_CHIP_CLASS } from './serviceRequestsListConstants';
import { Badge } from '../../components/ui';
import { Grid, FormControl, InputLabel, Select, MenuItem, FormHelperText } from '@mui/material';
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
      const eligibleTeamIdSet = new Set(eligibleTeamIds);
      return teams.filter((team) => eligibleTeamIdSet.has(team.id));
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
          <div className="mb-3">
            <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)] mb-1">
              {t('serviceRequests.fields.assignmentType')}
            </p>
            <div className="flex gap-1 flex-wrap">
              {ASSIGNMENT_TYPES.map((at) => {
                const isSelected = (watchedAssignedToType || '') === at.value;
                return (
                  <StatusChip
                    key={at.value}
                    outlined
                    selected={isSelected}
                    pressed={isSelected}
                    tokens={{ color: at.fg, bg: at.bg }}
                    icon={at.icon}
                    label={at.label}
                    onClick={disabled ? undefined : () => handleAssignmentTypeClick(at.value)}
                    disabled={disabled}
                    className={cn(SELECT_CHIP_CLASS, disabled && 'opacity-45')}
                  />
                );
              })}
            </div>

            {/* Indication auto-sélection */}
            {watchedServiceType && (
              (() => {
                const cat = getServiceCategory(watchedServiceType);
                if (cat === 'cleaning') {
                  return (
                    <p className="cn-text-body1 text-[10px] text-[var(--faint)] italic mt-0.5">
                      Type nettoyage → assignation équipe pré-sélectionnée
                    </p>
                  );
                }
                if (cat === 'maintenance') {
                  return (
                    <p className="cn-text-body1 text-[10px] text-[var(--faint)] italic mt-0.5">
                      Type maintenance → assignation équipe pré-sélectionnée
                    </p>
                  );
                }
                return null;
              })()
            )}
          </div>
        )}

        {/* Assignation specifique - Select avec style cohérent */}
        {canAssignForProperty && watchedAssignedToType && (
          <div className="mb-1.5">
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
                        <div className="flex items-center gap-1">
                          {watchedAssignedToType === 'user' ? (
                            <span className={cn('inline-flex', hasValue ? 'text-[var(--accent)]' : 'text-[var(--faint)]')}><Person size={16} strokeWidth={1.75} /></span>
                          ) : (
                            <span className={cn('inline-flex', hasValue ? 'text-[var(--accent)]' : 'text-[var(--faint)]')}><Group size={16} strokeWidth={1.75} /></span>
                          )}
                          <p className={cn('cn-text-body1 text-[12.5px]', hasValue ? 'text-[var(--body)]' : 'text-[var(--faint)]')}>
                            {hasValue
                              ? watchedAssignedToType === 'user'
                                ? `${(selectedItem as typeof users[number]).firstName} ${(selectedItem as typeof users[number]).lastName}`
                                : (selectedItem as Team).name
                              : t('serviceRequests.fields.select')}
                          </p>
                        </div>
                      )}
                    >
                      {watchedAssignedToType === 'user'
                        ? getAssignableUsers().map((user) => (
                            <MenuItem key={user.id} value={user.id}>
                              <div className="flex items-center gap-1 w-full">
                                <span className={cn('inline-flex', matchingSet.has(user.id) ? 'text-[var(--ok)]' : 'text-[var(--accent)]')}><Person size={16} strokeWidth={1.75} /></span>
                                <div className="flex-1 min-w-0">
                                  <p className="cn-text-body1 text-[12.5px] text-[var(--body)]">
                                    {user.firstName} {user.lastName}
                                  </p>
                                  <p className="cn-text-body1 text-[10.5px] text-[var(--faint)]">
                                    {user.role} • {user.email}
                                  </p>
                                </div>
                                {matchingSet.has(user.id) && (
                                  <Badge variant="secondary" className="h-[18px] text-[9.5px] font-bold text-[var(--ok)] bg-[var(--ok-soft)] px-1">Propose</Badge>
                                )}
                              </div>
                            </MenuItem>
                          ))
                        : filteredTeams.map((team) => (
                            <MenuItem key={team.id} value={team.id}>
                              <div className="flex items-center gap-1">
                                <span className="inline-flex text-[var(--accent)]"><Group size={16} strokeWidth={1.75} /></span>
                                <div>
                                  <p className="cn-text-body1 text-[12.5px] text-[var(--body)] font-medium">
                                    {team.name}
                                  </p>
                                  <p className="cn-text-body1 text-[10.5px] text-[var(--faint)]">
                                    {team.memberCount} {t('serviceRequests.members')} • {getInterventionTypeLabel(team.interventionType)}
                                  </p>
                                </div>
                              </div>
                            </MenuItem>
                          ))}
                    </Select>
                  </FormControl>
                );
              }}
            />
          </div>
        )}
      </>
    );
  }
);

ServiceRequestFormAssignment.displayName = 'ServiceRequestFormAssignment';

export default ServiceRequestFormAssignment;
