import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { useTranslation } from '../../../hooks/useTranslation';

interface SectionPaperProps {
  icon: React.ReactNode;
  titleKey: string;
  children: React.ReactNode;
}

const SectionPaper: React.FC<SectionPaperProps> = React.memo(({ icon, titleKey, children }) => {
  const { t } = useTranslation();
  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%', borderRadius: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {icon}
        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.875rem' }}>
          {t(titleKey)}
        </Typography>
      </Box>
      {children}
    </Paper>
  );
});

SectionPaper.displayName = 'SectionPaper';

export default SectionPaper;
