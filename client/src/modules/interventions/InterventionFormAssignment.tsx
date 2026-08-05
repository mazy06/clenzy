import React from 'react';
import {
  Card,
  CardContent,
  Field,
  FieldLabel,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
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

const ASSIGNABLE_ROLES = ['TECHNICIAN', 'EXTERIOR_TECH', 'LAUNDRY', 'SUPERVISOR', 'SUPER_MANAGER'];

const InterventionFormAssignment: React.FC<InterventionFormAssignmentProps> = React.memo(
  ({ control, errors, setValue, users, teams, watchedAssignedToType }) => {
    const { t } = useTranslation();

    return (
      <Card className="gap-0 py-0 mb-[9px]">
        <CardContent className="p-3">
          <h6 className="text-sm font-semibold tracking-tight mb-2">
            {t('interventions.sections.assignment')}
          </h6>

          <Controller
            name="assignedToType"
            control={control}
            render={({ field }) => (
              <Field className="mb-[9px]">
                <FieldLabel htmlFor="intervention-assignment-type">
                  {t('interventions.fields.assignmentType')}
                </FieldLabel>
                <NativeSelect
                  id="intervention-assignment-type"
                  className="w-full"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const val = e.target.value as 'user' | 'team' | '';
                    field.onChange(val || undefined);
                    setValue('assignedToId', undefined);
                  }}
                >
                  <NativeSelectOption value="">{t('interventions.fields.noAssignment')}</NativeSelectOption>
                  <NativeSelectOption value="user">{t('interventions.fields.user')}</NativeSelectOption>
                  <NativeSelectOption value="team">{t('interventions.fields.team')}</NativeSelectOption>
                </NativeSelect>
              </Field>
            )}
          />

          {watchedAssignedToType === 'user' && (
            <Controller
              name="assignedToId"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="intervention-assigned-user">
                    {t('interventions.fields.assignedUser')}
                  </FieldLabel>
                  <NativeSelect
                    id="intervention-assigned-user"
                    className="w-full"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  >
                    {/* Option vide explicite : sans elle, un <select> natif dont la
                        valeur ne correspond a aucune option affiche selon le
                        navigateur la premiere entree, alors que le formulaire est
                        vide — le MUI Select, lui, laissait le champ blanc. */}
                    <NativeSelectOption value="">—</NativeSelectOption>
                    {users
                      .filter((user) => ASSIGNABLE_ROLES.includes(user.role))
                      .map((user) => (
                        <NativeSelectOption key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} ({user.role})
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </Field>
              )}
            />
          )}

          {watchedAssignedToType === 'team' && (
            <Controller
              name="assignedToId"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="intervention-assigned-team">
                    {t('interventions.fields.assignedTeam')}
                  </FieldLabel>
                  <NativeSelect
                    id="intervention-assigned-team"
                    className="w-full"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  >
                    <NativeSelectOption value="">—</NativeSelectOption>
                    {teams.map((team) => (
                      <NativeSelectOption key={team.id} value={team.id}>
                        {team.name} ({team.interventionType})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
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
