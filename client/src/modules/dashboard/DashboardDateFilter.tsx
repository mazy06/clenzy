import React from 'react';
import { ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';

export type DashboardPeriod = 'week' | 'month' | 'quarter' | 'year';

interface DashboardDateFilterProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
}

const DashboardDateFilter: React.FC<DashboardDateFilterProps> = ({ period, onPeriodChange }) => {
  const { t } = useTranslation();

  const handleChange = (_event: React.MouseEvent<HTMLElement>, newPeriod: DashboardPeriod | null) => {
    if (newPeriod !== null) {
      onPeriodChange(newPeriod);
    }
  };

  return (
    <ToggleButtonGroup
      value={period}
      exclusive
      onChange={handleChange}
      size="small"
      sx={{
        '& .MuiToggleButton-root': {
          px: 1.5,
          py: 0.5,
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'none',
          borderColor: 'divider',
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          },
        },
      }}
    >
      <ToggleButton value="week">{t('dashboard.dateFilter.week')}</ToggleButton>
      <ToggleButton value="month">{t('dashboard.dateFilter.month')}</ToggleButton>
      <ToggleButton value="quarter">{t('dashboard.dateFilter.quarter')}</ToggleButton>
      <ToggleButton value="year">{t('dashboard.dateFilter.year')}</ToggleButton>
    </ToggleButtonGroup>
  );
};

export default DashboardDateFilter;
