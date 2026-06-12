import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { useTranslation } from '../../../hooks/useTranslation';

interface SectionPaperProps {
  icon: React.ReactNode;
  titleKey: string;
  children: React.ReactNode;
}

/**
 * Carte de section de configuration — pattern « Signature » : carte hairline
 * r14 + en-tête overline (icône inline discrète `--faint`).
 */
const SectionPaper: React.FC<SectionPaperProps> = React.memo(({ icon, titleKey, children }) => {
  const { t } = useTranslation();
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, height: '100%', borderRadius: '14px', borderColor: 'var(--line)', bgcolor: 'var(--card)' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'var(--faint)' }}>
        {icon}
        <Typography
          sx={{
            fontSize: '10.5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.06em',
            color: 'var(--faint)',
          }}
        >
          {t(titleKey)}
        </Typography>
      </Box>
      {children}
    </Paper>
  );
});

SectionPaper.displayName = 'SectionPaper';

export default SectionPaper;
