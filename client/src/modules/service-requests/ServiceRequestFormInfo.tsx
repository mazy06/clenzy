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
import { Controller, Control, FieldErrors } from 'react-hook-form';
import { INTERVENTION_TYPE_OPTIONS } from '../../types/interventionTypes';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequestFormValues } from '../../schemas';

export interface ServiceRequestFormInfoProps {
  control: Control<ServiceRequestFormValues>;
  errors: FieldErrors<ServiceRequestFormValues>;
}

const ServiceRequestFormInfo: React.FC<ServiceRequestFormInfoProps> = React.memo(
  ({ control, errors }) => {
    const { t } = useTranslation();

    const serviceTypes = INTERVENTION_TYPE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
    }));

    return (
      <>
        {/* Informations de base */}
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
          {t('serviceRequests.sections.basicInfo')}
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={8}>
            <Controller
              name="title"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={`${t('serviceRequests.fields.title')} *`}
                  required
                  placeholder={t('serviceRequests.fields.titlePlaceholder')}
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <Controller
              name="serviceType"
              control={control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth required error={!!fieldState.error}>
                  <InputLabel>{t('serviceRequests.fields.serviceType')} *</InputLabel>
                  <Select
                    {...field}
                    label={`${t('serviceRequests.fields.serviceType')} *`}
                    size="small"
                  >
                    {serviceTypes.map((type) => {
                      const typeOption = INTERVENTION_TYPE_OPTIONS.find(
                        (option) => option.value === type.value
                      );
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
        </Grid>

        {/* Description */}
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
          {t('serviceRequests.sections.description')}
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12}>
            <Controller
              name="description"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={3}
                  label={`${t('serviceRequests.fields.detailedDescription')} *`}
                  required
                  placeholder={t('serviceRequests.fields.descriptionPlaceholder')}
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Grid>
        </Grid>
      </>
    );
  }
);

ServiceRequestFormInfo.displayName = 'ServiceRequestFormInfo';

export default ServiceRequestFormInfo;
