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
} from '@mui/material';
import { PriorityHigh, Schedule } from '@mui/icons-material';
import { Controller, Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequestFormValues } from '../../schemas';

export interface ServiceRequestFormPlanningProps {
  control: Control<ServiceRequestFormValues>;
  errors: FieldErrors<ServiceRequestFormValues>;
}

const ServiceRequestFormPlanning: React.FC<ServiceRequestFormPlanningProps> = React.memo(
  ({ control, errors }) => {
    const { t } = useTranslation();

    const priorities = [
      { value: 'LOW', label: t('serviceRequests.priorities.low') },
      { value: 'NORMAL', label: t('serviceRequests.priorities.normal') },
      { value: 'HIGH', label: t('serviceRequests.priorities.high') },
      { value: 'CRITICAL', label: t('serviceRequests.priorities.critical') },
    ];

    const durations = [
      { value: 0.5, label: t('serviceRequests.durations.30min') },
      { value: 1, label: t('serviceRequests.durations.1h') },
      { value: 1.5, label: t('serviceRequests.durations.1h30') },
      { value: 2, label: t('serviceRequests.durations.2h') },
      { value: 3, label: t('serviceRequests.durations.3h') },
      { value: 4, label: t('serviceRequests.durations.4h') },
      { value: 6, label: t('serviceRequests.durations.6h') },
      { value: 8, label: t('serviceRequests.durations.8h') },
    ];

    return (
      <>
        {/* Priorite et duree */}
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
          {t('serviceRequests.sections.priorityPlanning')}
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <Controller
              name="priority"
              control={control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth required error={!!fieldState.error}>
                  <InputLabel>{t('serviceRequests.fields.priority')} *</InputLabel>
                  <Select
                    {...field}
                    label={`${t('serviceRequests.fields.priority')} *`}
                    size="small"
                  >
                    {priorities.map((priority) => (
                      <MenuItem key={priority.value} value={priority.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <PriorityHigh sx={{ fontSize: 18 }} />
                          <Typography variant="body2">{priority.label}</Typography>
                        </Box>
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

          <Grid item xs={12} md={4}>
            <Controller
              name="estimatedDurationHours"
              control={control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth required error={!!fieldState.error}>
                  <InputLabel>{t('serviceRequests.fields.estimatedDuration')} *</InputLabel>
                  <Select
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    onBlur={field.onBlur}
                    label={`${t('serviceRequests.fields.estimatedDuration')} *`}
                    size="small"
                  >
                    {durations.map((duration) => (
                      <MenuItem key={duration.value} value={duration.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Schedule sx={{ fontSize: 18 }} />
                          <Typography variant="body2">{duration.label}</Typography>
                        </Box>
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

          <Grid item xs={12} md={4}>
            <Controller
              name="desiredDate"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={`${t('serviceRequests.fields.dueDate')} *`}
                  type="datetime-local"
                  required
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              )}
            />
          </Grid>
        </Grid>
      </>
    );
  }
);

ServiceRequestFormPlanning.displayName = 'ServiceRequestFormPlanning';

export default ServiceRequestFormPlanning;
