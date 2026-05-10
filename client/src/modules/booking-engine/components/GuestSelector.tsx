import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Remove, Add } from '../../../icons';
import type { ResolvedTokens } from '../types/bookingEngine';
import type { BookingI18n } from '../sdk/i18n';
import iconAdultsUrl from '../assets/default/icon-adults.svg';
import iconChildrenUrl from '../assets/default/icon-children.svg';
import iconBabyUrl from '../assets/default/icon-baby.svg';

interface GuestSelectorProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  adults: number;
  setAdults: (v: number) => void;
  children: number;
  setChildren: (v: number) => void;
  isCompact: boolean;
}

const Counter: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  tk: ResolvedTokens;
}> = ({ value, onChange, min = 0, max = 10, tk }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
    <IconButton size="small" disabled={value <= min} onClick={() => onChange(value - 1)}
      sx={{ bgcolor: tk.surfaceMuted, width: 24, height: 24, borderRadius: '2px', color: tk.text, border: 'none',
        '&:hover': { bgcolor: tk.border }, '&.Mui-disabled': { bgcolor: tk.surfaceMuted, opacity: 0.4 } }}>
      <Remove size={14} strokeWidth={1.75} />
    </IconButton>
    <Typography sx={{ minWidth: 24, textAlign: 'center', fontSize: 18, fontWeight: 500, color: tk.primary }}>{value}</Typography>
    <IconButton size="small" disabled={value >= max} onClick={() => onChange(value + 1)}
      sx={{ bgcolor: tk.surfaceMuted, width: 24, height: 24, borderRadius: '2px', color: tk.text, border: 'none',
        '&:hover': { bgcolor: tk.border }, '&.Mui-disabled': { bgcolor: tk.surfaceMuted, opacity: 0.4 } }}>
      <Add size={14} strokeWidth={1.75} />
    </IconButton>
  </Box>
);

const GuestSelector: React.FC<GuestSelectorProps> = ({
  tk, i18n, adults, setAdults, children, setChildren, isCompact,
}) => {
  const guests = [
    { key: 'adults', icon: iconAdultsUrl, age: i18n.t('guests.adultsAge'), val: adults, set: setAdults, min: 1 },
    { key: 'children', icon: iconChildrenUrl, age: i18n.t('guests.childrenAge'), val: children, set: setChildren, min: 0 },
    { key: 'babies', icon: iconBabyUrl, age: i18n.t('guests.babiesAge'), val: 0, set: () => {}, min: 0 },
  ];

  return (
    <Box sx={{
      display: 'flex', justifyContent: 'space-around',
      gap: isCompact ? '8px' : '16px',
      flexWrap: 'nowrap',
    }}>
      {guests.map(({ key, icon, age, val, set, min }) => (
        <Box key={key} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isCompact ? '6px' : '16px', flex: 1, minWidth: 0 }}>
          <Box sx={{
            width: isCompact ? 56 : 120, height: isCompact ? 56 : 120,
            borderRadius: '50%', bgcolor: tk.surfaceMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Box sx={{
              width: isCompact ? 28 : 56, height: isCompact ? 28 : 56,
              maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})`,
              maskSize: 'contain', WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center', WebkitMaskPosition: 'center',
              bgcolor: tk.primary,
            }} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: isCompact ? 11 : 14, fontWeight: 500, color: tk.text, lineHeight: 1.2 }}>{i18n.t(`guests.${key}`)}</Typography>
            <Typography sx={{ fontSize: isCompact ? 9 : 14, fontWeight: 400, color: tk.textLabel, lineHeight: 1.2 }}>( {age} )</Typography>
          </Box>
          <Counter value={val} onChange={set} min={min} tk={tk} />
        </Box>
      ))}
    </Box>
  );
};

export default GuestSelector;
