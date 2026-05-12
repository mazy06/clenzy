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
  CleaningServices,
  Person,
  CalendarMonth,
} from '../../icons';

// ─── Static map URL helper (Mapbox Static Images API) ───────────────────────

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

function buildStaticMapUrl(
  lat: number | undefined,
  lng: number | undefined,
  width: number,
  height: number,
  dark: boolean,
): string | null {
  if (!MAPBOX_TOKEN || lat == null || lng == null) return null;
  const style = dark ? 'dark-v11' : 'streets-v12';
  // Pin couleur ambrée pour être visible sur les deux fonds
  const marker = `pin-s+f59e0b(${lng},${lat})`;
  // Plafonner pour éviter de payer plus que nécessaire (Mapbox max 1280)
  const w = Math.min(1280, Math.max(60, Math.round(width)));
  const h = Math.min(1280, Math.max(60, Math.round(height)));
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${marker}/${lng},${lat},13,0/${w}x${h}@2x?access_token=${MAPBOX_TOKEN}`;
}

// ─── Rich tooltip content ────────────────────────────────────────────────────

function PropertyTooltipContent({ property }: { property: PlanningProperty }) {
  const theme = useTheme();
  const currency = property.currency || 'EUR';
  const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 });
  const photo = property.photoUrls?.[0];
  // Fallback : si pas de photo mais coords disponibles → carte statique Mapbox
  const mapUrl = !photo
    ? buildStaticMapUrl(property.latitude, property.longitude, 280, 110, theme.palette.mode === 'dark')
    : null;
  const hasHeader = Boolean(photo || mapUrl);

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
      {!photo && mapUrl && (
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: 110,
            backgroundImage: `url(${mapUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            mb: 1,
          }}
        >
          <Chip
            size="small"
            icon={<LocationOn size={11} strokeWidth={2} />}
            label="Localisation"
            sx={{
              position: 'absolute',
              top: 6,
              left: 6,
              height: 20,
              fontSize: '0.625rem',
              fontWeight: 600,
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'divider',
              '& .MuiChip-icon': { ml: 0.5, mr: -0.25, color: 'warning.main' },
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>
      )}
      <Box sx={{ px: 1.25, pb: 1.25, pt: hasHeader ? 0 : 1.25 }}>
        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.2, color: 'text.primary' }}>
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
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(107,138,154,0.12)',
              color: 'primary.main',
              textTransform: 'capitalize',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}

        {(property.address || property.city) && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, alignItems: 'flex-start' }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mt: 0.1 }}>
              <LocationOn size={12} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.35 }}>
              {[property.address, property.city].filter(Boolean).join(', ')}
            </Typography>
          </Box>
        )}

        {property.ownerName && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center' }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
              <Person size={12} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {property.ownerName}
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 1.25 }} />

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
                <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}>
                  <AccessTime size={11} strokeWidth={1.75} />
                </Box>
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                  Check-in <Box component="strong" sx={{ color: 'text.primary' }}>{property.defaultCheckInTime.slice(0, 5)}</Box>
                </Typography>
              </Box>
            )}
            {property.defaultCheckOutTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'warning.main' }}>
                  <AccessTime size={11} strokeWidth={1.75} />
                </Box>
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                  Check-out <Box component="strong" sx={{ color: 'text.primary' }}>{property.defaultCheckOutTime.slice(0, 5)}</Box>
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {property.cleaningFrequency && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
              <CalendarMonth size={11} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
              Fréquence ménage : <Box component="strong" sx={{ color: 'text.primary' }}>{property.cleaningFrequency}</Box>
            </Typography>
          </Box>
        )}

        <Typography sx={{ fontSize: '0.625rem', color: 'text.disabled', mt: 1.25, fontStyle: 'italic' }}>
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
        bgcolor: (theme) => {
          if (highlight) {
            return theme.palette.mode === 'dark'
              ? 'rgba(16,185,129,0.18)'
              : 'rgba(16,185,129,0.10)';
          }
          return theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(0,0,0,0.025)';
        },
        border: '1px solid',
        borderColor: highlight ? 'success.main' : 'divider',
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: highlight ? 'success.main' : 'text.secondary', mb: 0.25 }}>
        {icon}
        <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'inherit' }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: highlight ? 'success.main' : 'text.primary' }}>
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
        const nameHeight = density === 'compact' ? 12 : 16;
        const verticalPadding = 4;
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
                sx: (theme) => ({
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 0,
                  maxWidth: 'none',
                  boxShadow:
                    theme.palette.mode === 'dark'
                      ? '0 12px 32px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.35)'
                      : '0 12px 32px rgba(15,23,42,0.18), 0 2px 6px rgba(15,23,42,0.08)',
                  '& .MuiTooltip-arrow': {
                    color: theme.palette.background.paper,
                    '&::before': {
                      border: '1px solid',
                      borderColor: theme.palette.divider,
                      backgroundColor: theme.palette.background.paper,
                    },
                  },
                }),
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
              {showCarousel && (() => {
                const hasPhoto = (property.photoUrls?.length ?? 0) > 0;
                if (hasPhoto) {
                  return (
                    <PropertyImageCarousel
                      photoUrls={property.photoUrls}
                      alt={property.name}
                      width="100%"
                      height={carouselHeight}
                      sx={{ width: '100%' }}
                    />
                  );
                }
                // Pas de photo → on tente la carte statique
                const mapUrl = buildStaticMapUrl(
                  property.latitude,
                  property.longitude,
                  Math.max(60, colWidth),
                  carouselHeight,
                  theme.palette.mode === 'dark',
                );
                if (mapUrl) {
                  return (
                    <Box
                      sx={{
                        width: '100%',
                        height: carouselHeight,
                        backgroundImage: `url(${mapUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        flexShrink: 0,
                      }}
                    />
                  );
                }
                // Aucun fallback dispo → placeholder du carousel
                return (
                  <PropertyImageCarousel
                    photoUrls={property.photoUrls}
                    alt={property.name}
                    width="100%"
                    height={carouselHeight}
                    sx={{ width: '100%' }}
                  />
                );
              })()}
              <Typography
                sx={{
                  fontSize: density === 'compact' ? '0.5625rem' : '0.625rem',
                  fontWeight: 500,
                  color: 'text.secondary',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.01em',
                  px: 0.5,
                  pb: 0.25,
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
