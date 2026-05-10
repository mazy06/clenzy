import React from 'react';
import { Box, Typography } from '@mui/material';
import { PhotoLibrary } from '../../../icons';
import type { ResolvedTokens, PreviewPropertyType } from '../types/bookingEngine';
import type { BookingI18n } from '../sdk/i18n';
import BookingToggle from './BookingToggle';

interface PropertyTypeFilterProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  propertyTypes: PreviewPropertyType[];
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
  isCompact: boolean;
}

const PropertyTypeFilter: React.FC<PropertyTypeFilterProps> = ({
  tk, i18n, propertyTypes, selectedTypes, setSelectedTypes, isCompact,
}) => {
  if (propertyTypes.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: isCompact ? 1.5 : 2 }}>
      {propertyTypes.map(pt => {
        const active = selectedTypes.includes(pt.type);
        return (
          <Box key={pt.type} sx={{ display: 'flex', alignItems: 'center', gap: isCompact ? 1.5 : 2, minWidth: 0 }}>
            <Box sx={{ width: isCompact ? 44 : 56, height: isCompact ? 44 : 56, borderRadius: tk.radiusSm, bgcolor: tk.secondary, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'rgba(255,255,255,0.3)' }}><PhotoLibrary size={isCompact ? 16 : 18} strokeWidth={1.75} /></Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: isCompact ? 13 : 14, fontWeight: 600, color: tk.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i18n.tObject('propertyTypes')[pt.type] || pt.label}
              </Typography>
              {!isCompact && (
                <Typography sx={{ fontSize: 11, color: tk.textLabel, border: `1px solid ${tk.border}`, display: 'inline-block', px: 1, py: 0.25, borderRadius: tk.radiusSm, mt: 0.5, cursor: 'pointer' }}>
                  + INFOS
                </Typography>
              )}
            </Box>
            <BookingToggle
              checked={active}
              onChange={() => setSelectedTypes(active ? selectedTypes.filter(t => t !== pt.type) : [...selectedTypes, pt.type])}
              primaryColor={tk.primary}
              surfaceMutedColor={tk.surfaceMuted}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default PropertyTypeFilter;
