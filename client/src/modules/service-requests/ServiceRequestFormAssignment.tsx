import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Badge,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Field,
  FieldLabel,
  FieldError,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '../../components/ui';
import { Person, Group, Timer } from '../../icons';
import './baitly-service-request-editor.css';
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
  profilePictureUrl?: string | null;
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

// ─── Assignment type chip config (actif = encre `-ink` sur fond `-soft`) ──

interface AssignmentTypeDef {
  value: '' | 'user' | 'team';
  key: string;
  icon: React.ReactElement;
}

const ASSIGNMENT_TYPES: AssignmentTypeDef[] = [
  { value: '', key: 'none', icon: <Timer size={20} strokeWidth={1.75} /> },
  { value: 'user', key: 'user', icon: <Person size={20} strokeWidth={1.75} /> },
  { value: 'team', key: 'team', icon: <Group size={20} strokeWidth={1.75} /> },
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
    const assignmentGroupId = React.useId();

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
      if (disabled || (watchedAssignedToType || '') === value) return;
      setValue('assignedToType', value === '' ? undefined : value);
      setValue('assignedToId', undefined);
    }, [setValue, disabled, watchedAssignedToType]);

    // If no assignment capability and not in edit mode, nothing to render
    if (!canAssignForProperty && !isEditMode) {
      return null;
    }

    return (
      <>

        {/* Type d'assignation - Chips */}
        {canAssignForProperty && (
          <div className="mb-3">
            <fieldset className="baitly-assignment-modes" disabled={disabled}>
              <legend>{t('serviceRequests.fields.assignmentType')}</legend>
              <div className="baitly-assignment-modes__options">
              {ASSIGNMENT_TYPES.map((at) => {
                const isSelected = (watchedAssignedToType || '') === at.value;
                return (
                  <label key={at.value} className="baitly-assignment-mode" data-selected={isSelected}>
                    <input type="radio" name={assignmentGroupId} value={at.value} checked={isSelected}
                      onChange={() => handleAssignmentTypeClick(at.value)} />
                    <span className="baitly-assignment-mode__icon" aria-hidden="true">{at.icon}</span>
                    <span><strong>{t(`serviceRequests.assignment.modes.${at.key}.title`)}</strong>
                      <small>{t(`serviceRequests.assignment.modes.${at.key}.description`)}</small></span>
                  </label>
                );
              })}
              </div>
            </fieldset>

            {/* Indication auto-sélection */}
            {watchedServiceType && (
              (() => {
                const cat = getServiceCategory(watchedServiceType);
                if (cat === 'cleaning') {
                  return (
                    <p className="text-2xs text-faint italic mt-0.5">
                      {t('serviceRequests.assignment.cleaningPreselected')}
                    </p>
                  );
                }
                if (cat === 'maintenance') {
                  return (
                    <p className="text-2xs text-faint italic mt-0.5">
                      {t('serviceRequests.assignment.maintenancePreselected')}
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
              render={({ field, fieldState }) => {
                const selectedItem = watchedAssignedToType === 'user'
                  ? users.find(u => u.id === field.value)
                  : teams.find(t => t.id === field.value);
                const hasValue = !!selectedItem;
                const fieldLabel = watchedAssignedToType === 'user'
                  ? t('serviceRequests.fields.assignedToUser')
                  : t('serviceRequests.fields.assignedToTeam');

                return (
                  <Field>
                    <FieldLabel htmlFor="service-request-assigned-to">{fieldLabel}</FieldLabel>
                    {/* Radix Select ne manipule que des chaines : l'id numerique du
                        formulaire est converti aux deux extremites. */}
                    <Select
                      value={field.value != null ? String(field.value) : ''}
                      onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                      disabled={disabled}
                    >
                      <SelectTrigger
                        id="service-request-assigned-to"
                        className="baitly-assignee-trigger w-full"
                        aria-invalid={!!fieldState.error}
                        onBlur={field.onBlur}
                      >
                        <div className="baitly-assignee-option">
                          {watchedAssignedToType === 'user' && hasValue ? <Avatar className="baitly-assignee-avatar" aria-hidden="true">
                            <AvatarImage src={(selectedItem as User).profilePictureUrl ?? undefined} alt="" />
                            <AvatarFallback>{[(selectedItem as User).firstName?.[0], (selectedItem as User).lastName?.[0]].filter(Boolean).join('').toUpperCase()}</AvatarFallback>
                          </Avatar> : <span className="baitly-assignee-avatar" aria-hidden="true">{watchedAssignedToType === 'user' ? <Person size={20} /> : <Group size={20} />}</span>}
                          <span className="baitly-assignee-option__text">
                          <strong>
                            {hasValue
                              ? watchedAssignedToType === 'user'
                                ? `${(selectedItem as typeof users[number]).firstName} ${(selectedItem as typeof users[number]).lastName}`
                                : (selectedItem as Team).name
                              : t('serviceRequests.fields.select')}
                          </strong>
                          <small>{hasValue ? watchedAssignedToType === 'team' ? `${(selectedItem as Team).memberCount} ${t('serviceRequests.members')}` : (selectedItem as User).role : t('serviceRequests.assignment.chooseProvider')}</small>
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="baitly-form-options baitly-assignee-options">
                        {watchedAssignedToType === 'user'
                          ? getAssignableUsers().map((user) => (
                              <SelectItem key={user.id} value={String(user.id)}>
                                <div className="baitly-assignee-option">
                                  <Avatar className="baitly-assignee-avatar" aria-hidden="true">
                                    <AvatarImage src={user.profilePictureUrl ?? undefined} alt="" />
                                    <AvatarFallback>{[user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div className="baitly-assignee-option__text">
                                    <span className="block text-[12.5px] text-foreground">
                                      {user.firstName} {user.lastName}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {user.role} • {user.email}
                                    </span>
                                  </div>
                                  {matchingSet.has(user.id) && (
                                    <Badge variant="secondary" className="h-[18px] text-[9.5px] font-bold text-success-ink bg-success-soft px-1">Propose</Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))
                          : filteredTeams.map((team) => (
                              <SelectItem key={team.id} value={String(team.id)}>
                                <div className="baitly-assignee-option">
                                  <span className="baitly-assignee-avatar" aria-hidden="true"><Group size={20} /></span>
                                  <div className="baitly-assignee-option__text">
                                    <span className="block text-[12.5px] text-foreground font-medium">
                                      {team.name}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {team.memberCount} {t('serviceRequests.members')}
                                    </span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                    {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                  </Field>
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
