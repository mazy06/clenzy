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
import {
  Person,
  Schedule,
} from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyFormValues } from '../../schemas';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface PropertyFormSettingsProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
  users: User[];
  propertyStatuses: { value: string; label: string }[];
  cleaningFrequencies: { value: string; label: string }[];
  isAdmin: () => boolean;
  isManager: () => boolean;
}

const PropertyFormSettings: React.FC<PropertyFormSettingsProps> = React.memo(
  ({ control, errors, users, propertyStatuses, cleaningFrequencies, isAdmin, isManager }) => {
    const { t } = useTranslation();

    return (
      <>
        {/* Configuration */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
            {t('properties.configuration')}
          </Typography>
        </Grid>

        {/* Champ Owner - comportement différent selon le rôle */}
        <Grid item xs={12} md={6}>
          <Controller
            name="ownerId"
            control={control}
            render={({ field, fieldState }) => (
              <FormControl fullWidth required error={!!fieldState.error}>
                <InputLabel>{t('properties.owner')} *</InputLabel>
                <Select
                  {...field}
                  label={`${t('properties.owner')} *`}
                  disabled={!isAdmin() && !isManager()} // Seuls les admin/manager peuvent changer le propriétaire
                  size="small"
                >
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Person sx={{ fontSize: 16 }} />
                        <Typography variant="body2">{user.firstName} {user.lastName} ({user.role}) - {user.email}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="status"
            control={control}
            render={({ field, fieldState }) => (
              <FormControl fullWidth required error={!!fieldState.error}>
                <InputLabel>{t('properties.status')}</InputLabel>
                <Select
                  {...field}
                  label={t('properties.status')}
                  size="small"
                >
                  {propertyStatuses.map(status => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
                {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="cleaningFrequency"
            control={control}
            render={({ field, fieldState }) => (
              <FormControl fullWidth required error={!!fieldState.error}>
                <InputLabel>{t('properties.cleaningFrequency')}</InputLabel>
                <Select
                  {...field}
                  label={t('properties.cleaningFrequency')}
                  size="small"
                >
                  {cleaningFrequencies.map(freq => (
                    <MenuItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </MenuItem>
                  ))}
                </Select>
                {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="maxGuests"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                type="number"
                label={t('properties.maxGuests')}
                onChange={(e) => field.onChange(Number(e.target.value))}
                required
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
        </Grid>

        {/* Heures par défaut */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Schedule sx={{ fontSize: 18 }} />
            Heures par défaut
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="defaultCheckInTime"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                type="time"
                label="Heure d'arrivée par défaut"
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message || 'Check-in (défaut : 15:00)'}
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 900 }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="defaultCheckOutTime"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                type="time"
                label="Heure de départ par défaut"
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message || 'Check-out (défaut : 11:00)'}
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 900 }}
              />
            )}
          />
        </Grid>

        {/* Description */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
            {t('properties.description')}
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="description"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                label={t('properties.description')}
                multiline
                rows={3}
                placeholder={t('properties.descriptionPlaceholder')}
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
        </Grid>
      </>
    );
  }
);

PropertyFormSettings.displayName = 'PropertyFormSettings';

export default PropertyFormSettings;
