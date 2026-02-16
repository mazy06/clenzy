import React from 'react';
import {
  Box,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import { Home, Person } from '@mui/icons-material';
import { Controller, Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequestFormValues } from '../../schemas';

interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
  ownerId?: number;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface ServiceRequestFormPropertyProps {
  control: Control<ServiceRequestFormValues>;
  errors: FieldErrors<ServiceRequestFormValues>;
  properties: Property[];
  users: User[];
  isAdminOrManager: boolean;
}

const ServiceRequestFormProperty: React.FC<ServiceRequestFormPropertyProps> = React.memo(
  ({ control, errors, properties, users, isAdminOrManager }) => {
    const { t } = useTranslation();

    return (
      <>
        {/* Propriete */}
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
          {t('serviceRequests.sections.property')}
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12}>
            <Controller
              name="propertyId"
              control={control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth required error={!!fieldState.error}>
                  <InputLabel>{t('serviceRequests.fields.property')} *</InputLabel>
                  <Select
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    onBlur={field.onBlur}
                    label={`${t('serviceRequests.fields.property')} *`}
                    size="small"
                  >
                    {properties.map((property) => (
                      <MenuItem key={property.id} value={property.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Home sx={{ fontSize: 18 }} />
                          <Typography variant="body2">
                            {property.name} - {property.address}, {property.city}
                          </Typography>
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
        </Grid>

        {/* Demandeur (requestor) */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <Controller
              name="userId"
              control={control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth required error={!!fieldState.error}>
                  <InputLabel>{t('serviceRequests.fields.requestor')} *</InputLabel>
                  <Select
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    onBlur={field.onBlur}
                    label={`${t('serviceRequests.fields.requestor')} *`}
                    disabled={!isAdminOrManager}
                    size="small"
                  >
                    {users.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Person sx={{ fontSize: 18 }} />
                          <Typography variant="body2">
                            {user.firstName} {user.lastName} ({user.role}) - {user.email}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  {!isAdminOrManager && (
                    <FormHelperText sx={{ fontSize: '0.7rem' }}>
                      {t('serviceRequests.fields.requestorHelper')}
                    </FormHelperText>
                  )}
                  {fieldState.error && (
                    <FormHelperText>{fieldState.error.message}</FormHelperText>
                  )}
                </FormControl>
              )}
            />
          </Grid>
        </Grid>
      </>
    );
  }
);

ServiceRequestFormProperty.displayName = 'ServiceRequestFormProperty';

export default ServiceRequestFormProperty;
