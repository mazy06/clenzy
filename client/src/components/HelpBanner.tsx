import React, { useState, useCallback } from 'react';
import { Box, Paper, Typography, IconButton } from '@mui/material';
import { InfoOutlined as InfoIcon, Close as CloseIcon } from '../icons';

export interface HelpStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface HelpBannerProps {
  storageKey: string;
  title: string;
  description: string;
  steps: HelpStep[];
  dismissLabel?: string;
}

const HelpBanner: React.FC<HelpBannerProps> = ({
  storageKey,
  title,
  description,
  steps,
  dismissLabel = 'Ne plus afficher',
}) => {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(storageKey) === '1',
  );

  const handleDismiss = useCallback(() => {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <Paper
      sx={{
        border: '1px solid',
        borderColor: 'info.200',
        boxShadow: 'none',
        borderRadius: 1.5,
        mb: 1.5,
        p: 2,
        bgcolor: 'info.50',
        position: 'relative',
      }}
    >
      <IconButton
        size="small"
        onClick={handleDismiss}
        sx={{ position: 'absolute', top: 6, right: 6, color: 'info.main' }}
        aria-label={dismissLabel}
      >
        <CloseIcon size={16} strokeWidth={1.75} />
      </IconButton>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'info.main' }}><InfoIcon size={20} strokeWidth={1.75} /></Box>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'info.main' }}>
          {title}
        </Typography>
      </Box>

      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 2 }}>
        {description}
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {steps.map((step, i) => (
          <Box key={i} sx={{ flex: 1, minWidth: 180, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: 'info.main',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {step.icon}
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                {step.title}
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                {step.description}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default HelpBanner;
