import React from 'react';
import { Box, Grid, Switch, Typography } from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ComponentVisibility {
  searchBar: boolean;
  propertyList: boolean;
  propertyGallery: boolean;
  availabilityCalendar: boolean;
  priceBreakdown: boolean;
  guestForm: boolean;
  paymentSection: boolean;
  reviewsSection: boolean;
  mapSection: boolean;
  cancellationPolicy: boolean;
  contactSection: boolean;
}

export const DEFAULT_COMPONENT_VISIBILITY: ComponentVisibility = {
  searchBar: true,
  propertyList: true,
  propertyGallery: true,
  availabilityCalendar: true,
  priceBreakdown: true,
  guestForm: true,
  paymentSection: true,
  reviewsSection: true,
  mapSection: true,
  cancellationPolicy: true,
  contactSection: true,
};

const COMPONENT_KEYS: (keyof ComponentVisibility)[] = [
  'searchBar',
  'propertyList',
  'propertyGallery',
  'availabilityCalendar',
  'priceBreakdown',
  'guestForm',
  'paymentSection',
  'reviewsSection',
  'mapSection',
  'cancellationPolicy',
  'contactSection',
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface ComponentVisibilityConfigProps {
  value: ComponentVisibility;
  onChange: (value: ComponentVisibility) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const ComponentVisibilityConfig: React.FC<ComponentVisibilityConfigProps> = React.memo(
  ({ value, onChange }) => {
    const { t } = useTranslation();

    const handleToggle = (key: keyof ComponentVisibility) => {
      onChange({ ...value, [key]: !value[key] });
    };

    return (
      <Grid container spacing={0.5}>
        {COMPONENT_KEYS.map((key) => (
          <Grid item xs={12} sm={6} key={key}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 0.5,
                px: 1,
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' },
                transition: 'background-color 0.15s ease',
              }}
            >
              <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                {t(`bookingEngine.components.${key}`)}
              </Typography>
              <Switch
                checked={value[key]}
                onChange={() => handleToggle(key)}
                size="small"
              />
            </Box>
          </Grid>
        ))}
      </Grid>
    );
  }
);

ComponentVisibilityConfig.displayName = 'ComponentVisibilityConfig';

export default ComponentVisibilityConfig;
