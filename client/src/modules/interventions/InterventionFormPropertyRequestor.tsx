import React from 'react';
import {
  Typography,
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
import { useTranslation } from '../../hooks/useTranslation';
import type { InterventionFormValues } from '../../schemas';

interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  postalCode: string;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface InterventionFormPropertyRequestorProps {
  control: Control<InterventionFormValues>;
  errors: FieldErrors<InterventionFormValues>;
  properties: Property[];
  users: User[];
  isAdmin: () => boolean;
  isManager: () => boolean;
}

const InterventionFormPropertyRequestor: React.FC<InterventionFormPropertyRequestorProps> = React.memo(
  ({ control, errors, properties, users, isAdmin, isManager }) => {
    const { t } = useTranslation();

    return (
      <Card sx={{ mb: 1.5 }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
            {t('interventions.sections.propertyRequestor')}
          </Typography>

          <Controller
            name="propertyId"
            control={control}
            render={({ field, fieldState }) => (
              <FormControl fullWidth required sx={{ mb: 1.5 }} error={!!fieldState.error}>
                <InputLabel>{t('interventions.fields.property')}</InputLabel>
                <Select
                  {...field}
                  label={t('interventions.fields.property')}
                  size="small"
                >
                  {properties.map((property) => (
                    <MenuItem key={property.id} value={property.id}>
                      <Typography variant="body2">{property.name} - {property.address}, {property.city}</Typography>
                    </MenuItem>
                  ))}
                </Select>
                {fieldState.error && (
                  <FormHelperText>{fieldState.error.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />

          <Controller
            name="requestorId"
            control={control}
            render={({ field, fieldState }) => (
              <FormControl fullWidth required error={!!fieldState.error}>
                <InputLabel>{t('interventions.fields.requestor')}</InputLabel>
                <Select
                  {...field}
                  label={t('interventions.fields.requestor')}
                  disabled={!isAdmin() && !isManager()}
                  size="small"
                >
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      <Typography variant="body2">{user.firstName} {user.lastName} ({user.email})</Typography>
                    </MenuItem>
                  ))}
                </Select>
                {!isAdmin() && !isManager() && (
                  <FormHelperText sx={{ fontSize: '0.7rem' }}>
                    {t('interventions.fields.requestorHelper')}
                  </FormHelperText>
                )}
                {fieldState.error && (
                  <FormHelperText>{fieldState.error.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        </CardContent>
      </Card>
    );
  }
);

InterventionFormPropertyRequestor.displayName = 'InterventionFormPropertyRequestor';

export default InterventionFormPropertyRequestor;
