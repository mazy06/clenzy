import React from 'react';
import {
  Typography,
  TextField,
  Card,
  CardContent,
} from '@mui/material';
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
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                {t('interventions.sections.costs')}
              </Typography>

              <Controller
                name="estimatedCost"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    fullWidth
                    label={t('interventions.fields.estimatedCost')}
                    type="number"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    inputProps={{ min: 0, step: 0.01 }}
                    size="small"
                  />
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Notes et photos */}
        <Card sx={{ mt: isHost() ? 0 : 1.5 }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
              {t('interventions.sections.notesPhotos')}
            </Typography>

            <Controller
              name="notes"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={t('interventions.fields.notes')}
                  multiline
                  rows={3}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  sx={{ mb: 1.5 }}
                  size="small"
                />
              )}
            />

            <Controller
              name="photos"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={t('interventions.fields.photosUrl')}
                  placeholder={t('interventions.fields.photosUrlPlaceholder')}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  size="small"
                />
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
