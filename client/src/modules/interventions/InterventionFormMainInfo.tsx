import React from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Card,
  CardContent,
} from '@mui/material';
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
      <Grid item xs={12} md={8}>
        <Card>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
              {t('interventions.sections.mainInfo')}
            </Typography>

            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <Controller
                  name="title"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('interventions.fields.title')}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      size="small"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('interventions.fields.description')}
                      multiline
                      rows={3}
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      size="small"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="type"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth required error={!!fieldState.error}>
                      <InputLabel>{t('interventions.fields.interventionType')}</InputLabel>
                      <Select
                        {...field}
                        label={t('interventions.fields.interventionType')}
                        size="small"
                      >
                        {interventionTypes.map((type) => {
                          const typeOption = INTERVENTION_TYPE_OPTIONS.find(option => option.value === type.value);
                          const IconComponent = typeOption?.icon;

                          return (
                            <MenuItem key={type.value} value={type.value}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                {IconComponent && <IconComponent sx={{ fontSize: 18 }} />}
                                <Typography variant="body2">{type.label}</Typography>
                              </Box>
                            </MenuItem>
                          );
                        })}
                      </Select>
                      {fieldState.error && (
                        <FormHelperText>{fieldState.error.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth required error={!!fieldState.error}>
                      <InputLabel>{t('interventions.fields.status')}</InputLabel>
                      <Select
                        {...field}
                        label={t('interventions.fields.status')}
                        size="small"
                      >
                        {statuses.map((status) => (
                          <MenuItem key={status.value} value={status.value}>
                            {status.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldState.error && (
                        <FormHelperText>{fieldState.error.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormControl fullWidth required error={!!fieldState.error}>
                      <InputLabel>{t('interventions.fields.priority')}</InputLabel>
                      <Select
                        {...field}
                        label={t('interventions.fields.priority')}
                        size="small"
                      >
                        {priorities.map((priority) => (
                          <MenuItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldState.error && (
                        <FormHelperText>{fieldState.error.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              {/* Date planifiee (date seule) */}
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label={t('interventions.fields.scheduledDate')}
                  type="date"
                  required
                  value={scheduledDatePart}
                  onChange={(e) => setScheduledDatePart(e.target.value)}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Heure de debut */}
              <Grid item xs={6} sm={4}>
                <TextField
                  fullWidth
                  label="Heure"
                  type="time"
                  required
                  value={scheduledTimePart}
                  onChange={(e) => setScheduledTimePart(e.target.value)}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 900 }}
                  helperText={
                    (() => {
                      const sel = properties.find(p => p.id === watchedPropertyId);
                      return sel?.defaultCheckOutTime ? `Défaut : ${sel.defaultCheckOutTime}` : undefined;
                    })()
                  }
                />
              </Grid>

              {/* Duree estimee (fractionnaire) */}
              <Grid item xs={6} sm={4}>
                <Controller
                  name="estimatedDurationHours"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('interventions.fields.estimatedDuration')}
                      type="number"
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'En heures (ex: 1.5 = 1h30)'}
                      inputProps={{ min: 0.5, max: 24, step: 0.5 }}
                      size="small"
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  )}
                />
              </Grid>

              {/* Hidden field for react-hook-form scheduledDate */}
              <Controller
                name="scheduledDate"
                control={control}
                render={({ field }) => (
                  <input type="hidden" {...field} />
                )}
              />

              <Grid item xs={12} sm={6}>
                <Controller
                  name="progressPercentage"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('interventions.fields.initialProgress')}
                      type="number"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      inputProps={{ min: 0, max: 100 }}
                      size="small"
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    );
  }
);

InterventionFormMainInfo.displayName = 'InterventionFormMainInfo';

export default InterventionFormMainInfo;
