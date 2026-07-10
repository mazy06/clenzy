import React from 'react';
import { Box, Typography, TextField, MenuItem } from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';
import type { UseReservationFormResult } from './useReservationForm';
import { FIELD_SX } from './reservationDialogStyles';

interface Props {
  form: UseReservationFormResult;
}

/** Sélecteur de propriété (création libre, étape 1). Auto-sélection 1er logement pour non platform-staff. */
const PropertySelectField: React.FC<Props> = ({ form }) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <TextField
        select
        label={t('reservations.fields.property')}
        value={form.propertyId === '' ? '' : form.propertyId}
        onChange={(e) => form.setPropertyId(Number(e.target.value))}
        fullWidth
        required
        disabled={!form.isPlatformStaff || form.propertiesLoading}
        InputLabelProps={{ shrink: true }}
        sx={FIELD_SX}
        SelectProps={{ displayEmpty: true }}
      >
        <MenuItem value="" disabled>
          {t('reservations.dialog.propertyPlaceholder')}
        </MenuItem>
        {form.properties.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.name}
          </MenuItem>
        ))}
      </TextField>
      {!form.isPlatformStaff && form.propertyName && (
        <Typography sx={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>
          {t('reservations.dialog.propertyAutoSelected')}
        </Typography>
      )}
    </Box>
  );
};

export default PropertySelectField;
