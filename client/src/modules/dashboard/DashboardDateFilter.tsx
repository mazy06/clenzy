import React from 'react';
import { Box, Chip } from '@mui/material';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DashboardPeriod = 'week' | 'month' | 'quarter' | 'year';

export interface DateFilterOption<T extends string = string> {
  value: T;
  label: string;
}

interface DashboardDateFilterProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: DateFilterOption<T>[];
}

// ─── Component ──────────────────────────────────────────────────────────────

function DashboardDateFilterInner<T extends string>({
  value,
  onChange,
  options,
}: DashboardDateFilterProps<T>) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <Chip
            key={opt.value}
            label={opt.label}
            size="small"
            variant={isSelected ? 'filled' : 'outlined'}
            color={isSelected ? 'primary' : 'default'}
            onClick={() => onChange(opt.value)}
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              height: 28,
              cursor: 'pointer',
              ...(!isSelected && {
                borderColor: 'divider',
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'action.hover',
                  borderColor: 'text.secondary',
                },
              }),
            }}
          />
        );
      })}
    </Box>
  );
}

const DashboardDateFilter = React.memo(DashboardDateFilterInner) as typeof DashboardDateFilterInner;

export default DashboardDateFilter;
