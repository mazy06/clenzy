import React from 'react';
import {
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '../../components/ui';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { INTERVENTION_TYPE_OPTIONS } from '../../types/interventionTypes';
import { INTERVENTION_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import type { InterventionFormValues } from '../../schemas';

interface PropertyWithDefaults {
  id: number;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  defaultCheckOutTime?: string;
  defaultCheckInTime?: string;
}

export interface InterventionFormMainInfoProps {
  control: Control<InterventionFormValues>;
  errors: FieldErrors<InterventionFormValues>;
  scheduledDatePart: string;
  scheduledTimePart: string;
  setScheduledDatePart: (value: string) => void;
  setScheduledTimePart: (value: string) => void;
  properties: PropertyWithDefaults[];
  watchedPropertyId: number;
}

const interventionTypes = INTERVENTION_TYPE_OPTIONS.map(option => ({
  value: option.value,
  label: option.label
}));

const statuses = INTERVENTION_STATUS_OPTIONS.map(option => ({
  value: option.value,
  label: option.label
}));

const priorities = PRIORITY_OPTIONS.map(option => ({
  value: option.value,
  label: option.label
}));

const InterventionFormMainInfo: React.FC<InterventionFormMainInfoProps> = React.memo(
  ({
    control,
    errors,
    scheduledDatePart,
    scheduledTimePart,
    setScheduledDatePart,
    setScheduledTimePart,
    properties,
    watchedPropertyId,
  }) => {
    const { t } = useTranslation();

    return (
      <div className="col-span-12 min-[900px]:col-span-8">
        <Card size="sm">
          <CardContent>
            <h6 className="text-sm font-semibold tracking-tight mb-2">
              {t('interventions.sections.mainInfo')}
            </h6>

            <div className="grid grid-cols-12 gap-[9px]">
              <div className="col-span-12">
                <Controller
                  name="title"
                  control={control}
                  render={({ field, fieldState }) => (
                    // field.ref n'est pas transmis : les primitives du kit sont des
                    // composants fonction sans forwardRef (React 18).
                    <Field>
                      <FieldLabel htmlFor="intervention-title">{t('interventions.fields.title')}</FieldLabel>
                      <Input
                        id="intervention-title"
                        name={field.name}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        required
                        aria-invalid={!!fieldState.error}
                      />
                      {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                    </Field>
                  )}
                />
              </div>

              <div className="col-span-12">
                <Controller
                  name="description"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="intervention-description">
                        {t('interventions.fields.description')}
                      </FieldLabel>
                      <Textarea
                        id="intervention-description"
                        rows={3}
                        name={field.name}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        required
                        aria-invalid={!!fieldState.error}
                      />
                      {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                    </Field>
                  )}
                />
              </div>

              <div className="col-span-12 min-[600px]:col-span-6">
                <Controller
                  name="type"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="intervention-type">
                        {t('interventions.fields.interventionType')}
                      </FieldLabel>
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="intervention-type"
                          size="sm"
                          className="w-full"
                          aria-invalid={!!fieldState.error}
                        >
                          <SelectValue placeholder={t('interventions.fields.interventionType')} />
                        </SelectTrigger>
                        <SelectContent>
                          {interventionTypes.map((type) => {
                            const typeOption = INTERVENTION_TYPE_OPTIONS.find(option => option.value === type.value);
                            const IconComponent = typeOption?.icon;

                            return (
                              <SelectItem key={type.value} value={type.value}>
                                <span className="flex items-center gap-1">
                                  {IconComponent && <IconComponent size={18} strokeWidth={1.75} />}
                                  {type.label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                    </Field>
                  )}
                />
              </div>

              <div className="col-span-12 min-[600px]:col-span-6">
                <Controller
                  name="status"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="intervention-status">
                        {t('interventions.fields.status')}
                      </FieldLabel>
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="intervention-status"
                          size="sm"
                          className="w-full"
                          aria-invalid={!!fieldState.error}
                        >
                          <SelectValue placeholder={t('interventions.fields.status')} />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                    </Field>
                  )}
                />
              </div>

              <div className="col-span-12 min-[600px]:col-span-6">
                <Controller
                  name="priority"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="intervention-priority">
                        {t('interventions.fields.priority')}
                      </FieldLabel>
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="intervention-priority"
                          size="sm"
                          className="w-full"
                          aria-invalid={!!fieldState.error}
                        >
                          <SelectValue placeholder={t('interventions.fields.priority')} />
                        </SelectTrigger>
                        <SelectContent>
                          {priorities.map((priority) => (
                            <SelectItem key={priority.value} value={priority.value}>
                              {priority.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                    </Field>
                  )}
                />
              </div>

              {/* Date planifiee (date seule) */}
              <div className="col-span-12 min-[600px]:col-span-4">
                <Field>
                  <FieldLabel htmlFor="intervention-scheduled-date">
                    {t('interventions.fields.scheduledDate')}
                  </FieldLabel>
                  <Input
                    id="intervention-scheduled-date"
                    type="date"
                    required
                    value={scheduledDatePart}
                    onChange={(e) => setScheduledDatePart(e.target.value)}
                  />
                </Field>
              </div>

              {/* Heure de debut */}
              <div className="col-span-6 min-[600px]:col-span-4">
                <Field>
                  <FieldLabel htmlFor="intervention-scheduled-time">Heure</FieldLabel>
                  <Input
                    id="intervention-scheduled-time"
                    type="time"
                    required
                    value={scheduledTimePart}
                    onChange={(e) => setScheduledTimePart(e.target.value)}
                    step={900}
                  />
                  {(() => {
                    const sel = properties.find(p => p.id === watchedPropertyId);
                    return sel?.defaultCheckOutTime
                      ? <FieldDescription>{`Défaut : ${sel.defaultCheckOutTime}`}</FieldDescription>
                      : null;
                  })()}
                </Field>
              </div>

              {/* Duree estimee (fractionnaire) */}
              <div className="col-span-6 min-[600px]:col-span-4">
                <Controller
                  name="estimatedDurationHours"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="intervention-estimated-duration">
                        {t('interventions.fields.estimatedDuration')}
                      </FieldLabel>
                      <Input
                        id="intervention-estimated-duration"
                        type="number"
                        required
                        name={field.name}
                        value={field.value ?? ''}
                        onBlur={field.onBlur}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        aria-invalid={!!fieldState.error}
                        min={0.5}
                        max={24}
                        step={0.5}
                      />
                      {fieldState.error
                        ? <FieldError>{fieldState.error.message}</FieldError>
                        : <FieldDescription>En heures (ex: 1.5 = 1h30)</FieldDescription>}
                    </Field>
                  )}
                />
              </div>

              {/* Hidden field for react-hook-form scheduledDate */}
              <Controller
                name="scheduledDate"
                control={control}
                render={({ field }) => (
                  <input type="hidden" {...field} />
                )}
              />

              <div className="col-span-12 min-[600px]:col-span-6">
                <Controller
                  name="progressPercentage"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="intervention-progress">
                        {t('interventions.fields.initialProgress')}
                      </FieldLabel>
                      <Input
                        id="intervention-progress"
                        type="number"
                        name={field.name}
                        value={field.value ?? ''}
                        onBlur={field.onBlur}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        aria-invalid={!!fieldState.error}
                        min={0}
                        max={100}
                      />
                      {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                    </Field>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
);

InterventionFormMainInfo.displayName = 'InterventionFormMainInfo';

export default InterventionFormMainInfo;
