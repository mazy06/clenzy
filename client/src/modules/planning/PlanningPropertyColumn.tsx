import React from 'react';
import { Box, Typography, Tooltip, useTheme, Chip, Divider } from '@mui/material';
import type { PlanningProperty, DensityMode } from './types';
import { ROW_CONFIG } from './constants';
import { PropertyImageCarousel } from '../../components/PropertyImageCarousel';
import {
  LocationOn,
  People,
  Bed,
  Euro,
  AccessTime,
  Hotel,
  CleaningServices,
  Person,
  CalendarMonth,
} from '../../icons';

// ─── Rich tooltip content ────────────────────────────────────────────────────

function PropertyTooltipContent({ property }: { property: PlanningProperty }) {
  const currency = property.currency || 'EUR';
  const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 });
  const photo = property.photoUrls?.[0];

  return (
    <Box sx={{ width: 280 }}>
      {photo && (
        <Box
          sx={{
            width: '100%',
            height: 110,
            backgroundImage: `url(${photo})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            mb: 1,
          }}
        />
      )}
      <Box sx={{ px: 1.25, pb: 1.25, pt: photo ? 0 : 1.25 }}>
        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.2, color: 'common.white' }}>
          {property.name}
        </Typography>
        {property.type && (
          <Chip
            label={property.type}
            size="small"
            sx={{
              mt: 0.5,
              height: 18,
              fontSize: '0.625rem',
              fontWeight: 600,
              bgcolor: 'rgba(255,255,255,0.15)',
              color: 'common.white',
              textTransform: 'capitalize',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}

        {(property.address || property.city) && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, alignItems: 'flex-start' }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'rgba(255,255,255,0.7)', mt: 0.1 }}>
              <LocationOn size={12} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.35 }}>
              {[property.address, property.city].filter(Boolean).join(', ')}
            </Typography>
          </Box>
        )}

        {property.ownerName && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center' }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'rgba(255,255,255,0.7)' }}>
              <Person size={12} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)' }}>
              {property.ownerName}
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 1.25, borderColor: 'rgba(255,255,255,0.15)' }} />

        {/* Stats grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
          <StatPill
            icon={<People size={12} strokeWidth={1.75} />}
            label="Voyageurs max"
            value={`${property.maxGuests}`}
          />
          {property.minimumNights != null && property.minimumNights > 0 && (
            <StatPill
              icon={<Bed size={12} strokeWidth={1.75} />}
              label="Nuits min."
              value={`${property.minimumNights}`}
            />
          )}
          {property.nightlyPrice != null && property.nightlyPrice > 0 && (
            <StatPill
              icon={<Euro size={12} strokeWidth={1.75} />}
              label="Prix / nuit"
              value={fmt.format(property.nightlyPrice)}
              highlight
            />
          )}
          {property.cleaningBasePrice != null && property.cleaningBasePrice > 0 && (
            <StatPill
              icon={<CleaningServices size={12} strokeWidth={1.75} />}
              label="Ménage"
              value={fmt.format(property.cleaningBasePrice)}
            />
          )}
        </Box>

        {/* Check-in / check-out times */}
        {(property.defaultCheckInTime || property.defaultCheckOutTime) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
            {property.defaultCheckInTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: '#4ade80' }}>
                  <AccessTime size={11} strokeWidth={1.75} />
                </Box>
                <Typography sx={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.85)' }}>
                  Check-in <strong>{property.defaultCheckInTime.slice(0, 5)}</strong>
                </Typography>
              </Box>
            )}
            {property.defaultCheckOutTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: '#fbbf24' }}>
                  <AccessTime size={11} strokeWidth={1.75} />
                </Box>
                <Typography sx={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.85)' }}>
                  Check-out <strong>{property.defaultCheckOutTime.slice(0, 5)}</strong>
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {property.cleaningFrequency && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'rgba(255,255,255,0.7)' }}>
              <CalendarMonth size={11} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.85)' }}>
              Fréquence ménage : <strong>{property.cleaningFrequency}</strong>
            </Typography>
          </Box>
        )}

        <Typography sx={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.5)', mt: 1.25, fontStyle: 'italic' }}>
          Cliquez pour ouvrir la fiche complète
        </Typography>
      </Box>
    </Box>
  );
}

function StatPill({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 0.75,
        borderRadius: 1,
        bgcolor: highlight ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.08)',
        border: '1px solid',
        borderColor: highlight ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.12)',
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: highlight ? '#4ade80' : 'rgba(255,255,255,0.7)', mb: 0.25 }}>
        {icon}
        <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'inherit' }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: highlight ? '#4ade80' : 'common.white' }}>
        {value}
      </Typography>
    </Box>
  );
}

interface PlanningPropertyColumnProps {
  properties: PlanningProperty[];
  density: DensityMode;
  selectedPropertyId?: number | null;
  colWidth: number;
  effectiveRowHeight: number;
  emptyRowCount?: number;
  onPropertyClick?: (propertyId: number) => void;
}

const PlanningPropertyColumn: React.FC<PlanningPropertyColumnProps> = React.memo(({
  properties,
  density,
  selectedPropertyId,
  colWidth,
  effectiveRowHeight,
  emptyRowCount = 0,
  onPropertyClick,
}) => {
  const theme = useTheme();
  const config = ROW_CONFIG[density];

  return (
    <Box
      sx={{
        position: 'sticky',
        left: 0,
        zIndex: 10,
        width: colWidth,
        minWidth: colWidth,
        flexShrink: 0,
        backgroundColor: 'background.paper',
        borderRight: '2px solid',
        borderColor: 'divider',
      }}
    >
      {properties.map((property, idx) => {
        const showCarousel = colWidth >= 100;
        const nameHeight = density === 'compact' ? 14 : 18;
        const verticalPadding = 6;
        const carouselHeight = Math.max(
          24,
          effectiveRowHeight - nameHeight - verticalPadding,
        );
        return (
          <Tooltip
            key={property.id}
            title={<PropertyTooltipContent property={property} />}
            placement="right"
            arrow
            enterDelay={350}
            enterNextDelay={200}
            leaveDelay={100}
            slotProps={{
              tooltip: {
                sx: {
                  bgcolor: 'rgba(17,24,39,0.97)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  p: 0,
                  maxWidth: 'none',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.2)',
                  '& .MuiTooltip-arrow': {
                    color: 'rgba(17,24,39,0.97)',
                  },
                },
              },
              popper: {
                modifiers: [{ name: 'offset', options: { offset: [0, 8] } }],
              },
            }}
          >
            <Box
              onClick={() => onPropertyClick?.(property.id)}
              sx={{
                height: effectiveRowHeight,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
                gap: 0.25,
                p: 0,
                borderBottom: '1px solid',
                borderColor: 'divider',
                cursor: onPropertyClick ? 'pointer' : 'default',
                backgroundColor: selectedPropertyId === property.id
                  ? theme.palette.mode === 'dark' ? 'rgba(107, 138, 154, 0.1)' : 'rgba(107, 138, 154, 0.05)'
                  : idx % 2 === 0
                    ? 'transparent'
                    : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
                transition: 'background-color 0.15s ease',
                '&:hover': onPropertyClick ? {
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(107, 138, 154, 0.15)' : 'rgba(107, 138, 154, 0.08)',
                } : {},
              }}
            >
              {showCarousel && (
                <PropertyImageCarousel
                  photoUrls={property.photoUrls}
                  alt={property.name}
                  width="100%"
                  height={carouselHeight}
                  sx={{ width: '100%' }}
                />
              )}
              <Typography
                sx={{
                  fontSize: density === 'compact' ? '0.6875rem' : '0.75rem',
                  fontWeight: 400,
                  color: 'text.secondary',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.01em',
                  px: 0.75,
                  pb: 0.5,
                }}
              >
                {property.name}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
      {/* Empty filler rows */}
      {Array.from({ length: emptyRowCount }, (_, i) => (
        <Box
          key={`empty-${i}`}
          sx={{
            height: effectiveRowHeight,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: (properties.length + i) % 2 === 0
              ? 'transparent'
              : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
          }}
        />
      ))}
    </Box>
  );
});

PlanningPropertyColumn.displayName = 'PlanningPropertyColumn';
export default PlanningPropertyColumn;
