import React from 'react';
import { Card, CardContent, Field, FieldLabel, FieldError, Input, Textarea } from '../../components/ui';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { InterventionFormValues } from '../../schemas';

export interface InterventionFormCostsNotesProps {
  control: Control<InterventionFormValues>;
  errors: FieldErrors<InterventionFormValues>;
  isHost: () => boolean;
}

const InterventionFormCostsNotes: React.FC<InterventionFormCostsNotesProps> = React.memo(
  ({ control, errors, isHost }) => {
    const { t } = useTranslation();

    return (
      <>
        {/* Couts - Seulement pour les admins et managers, pas pour les HOST */}
        {!isHost() && (
          <Card size="sm">
            <CardContent>
              <h6 className="cn-text-subtitle1 font-semibold mb-2">
                {t('interventions.sections.costs')}
              </h6>

              <Controller
                name="estimatedCost"
                control={control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="intervention-estimated-cost">
                      {t('interventions.fields.estimatedCost')}
                    </FieldLabel>
                    <Input
                      id="intervention-estimated-cost"
                      className="w-full"
                      type="number"
                      min={0}
                      step={0.01}
                      name={field.name}
                      value={field.value ?? ''}
                      onBlur={field.onBlur}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      aria-invalid={!!fieldState.error}
                    />
                    {fieldState.error?.message && <FieldError>{fieldState.error.message}</FieldError>}
                  </Field>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Notes et photos */}
        <Card size="sm" className={isHost() ? undefined : 'mt-[9px]'}>
          <CardContent>
            <h6 className="cn-text-subtitle1 font-semibold mb-2">
              {t('interventions.sections.notesPhotos')}
            </h6>

            <Controller
              name="notes"
              control={control}
              render={({ field, fieldState }) => (
                // `field` n'est pas etale : sa prop `ref` irait sur un composant
                // fonction du kit, que React 18 ne sait pas referencer.
                <Field className="mb-[9px]">
                  <FieldLabel htmlFor="intervention-notes">{t('interventions.fields.notes')}</FieldLabel>
                  <Textarea
                    id="intervention-notes"
                    className="w-full"
                    rows={3}
                    name={field.name}
                    value={field.value ?? ''}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error?.message && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />

            <Controller
              name="photos"
              control={control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="intervention-photos">{t('interventions.fields.photosUrl')}</FieldLabel>
                  <Input
                    id="intervention-photos"
                    className="w-full"
                    placeholder={t('interventions.fields.photosUrlPlaceholder')}
                    name={field.name}
                    value={field.value ?? ''}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error?.message && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          </CardContent>
        </Card>
      </>
    );
  }
);

InterventionFormCostsNotes.displayName = 'InterventionFormCostsNotes';

export default InterventionFormCostsNotes;
