import React from 'react';
import { Box, Typography } from '@mui/material';
import type { ResolvedTokens, PreviewPage } from '../types/bookingEngine';
import type { BookingI18n } from '../sdk/i18n';

interface BookingStepIndicatorProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  activeStep: number;
  setPage?: (page: PreviewPage) => void;
}

/** Step pages mapped by index */
const STEP_PAGES: PreviewPage[] = ['cart', 'identification', 'validation', 'confirmation'];

const BookingStepIndicator: React.FC<BookingStepIndicatorProps> = ({ tk, i18n, activeStep, setPage }) => {
  const steps = [
    i18n.t('cart.stepOptions'),
    i18n.t('cart.stepIdentification'),
    i18n.t('cart.stepValidation'),
    i18n.t('cart.stepConfirmation'),
  ];

  return (
    <Box sx={{ display: 'flex', gap: 0, px: 3, mb: 3, maxWidth: 1100, mx: 'auto', width: '100%', boxSizing: 'border-box' }}>
      {steps.map((label, idx) => {
        const isActive = idx === activeStep;
        const isPast = idx < activeStep;
        const isClickable = isPast && setPage;

        return (
          <Box
            key={idx}
            onClick={isClickable ? () => setPage(STEP_PAGES[idx]) : undefined}
            sx={{
              flex: 1, textAlign: 'center',
              cursor: isClickable ? 'pointer' : 'default',
              '&:hover': isClickable ? { '& .step-label': { color: tk.primary } } : {},
            }}
          >
            <Typography
              className="step-label"
              sx={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
                color: isActive ? tk.primary : isPast ? tk.text : `${tk.textLabel}80`,
                pb: 1,
                borderBottom: isActive ? `2px solid ${tk.primary}` : `1px solid ${tk.border}`,
                transition: 'color 0.15s ease',
              }}
            >
              {idx + 1}. {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default BookingStepIndicator;
