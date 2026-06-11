import React, { useCallback, useRef, useState } from 'react';
import { Box, Typography, Tooltip, useTheme, Chip, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PropertyPopover from './PropertyPopover';
import type { PlanningProperty, DensityMode } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { getCleaningFrequencyLabel } from '../../utils/statusUtils';
import {
  LocationOn,
  People,
  Bed,
  Euro,
  AccessTime,
  CleaningServices,
  Person,
  CalendarMonth,
  ChevronRight,
  Label as TagIcon,
  Wifi as ChannelIcon,
} from '../../icons';
import type { ChannelSyncMap } from './hooks/usePlanningChannelSync';

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
//
// Echelle typo coherente (4 paliers uniquement) :
//   TITLE_FS  = 0.8125rem (13px) — nom de la propriete (h6 like)
//   BODY_FS   = 0.6875rem (11px) — texte body (adresse, owner, check-in, valeur stat)
//   LABEL_FS  = 0.5625rem  (9px) — label uppercase (stat label, chip type, footer)
//   ICON_SIZE = 11px              — toutes les icones (sauf header pin = 10)
//
// Spacing aéré (Phase 2) : padding outer 1.5, photo height 100, gap stat
// grid 1, divider my 1.25. Plus de respiration entre les sections sans
// alourdir le tooltip total.

const TITLE_FS = '0.8125rem';
const BODY_FS  = '0.6875rem';
const LABEL_FS = '0.5625rem';
const ICON_SIZE = 11;
const TOOLTIP_WIDTH = 264;
const HEADER_HEIGHT = 100;

function PropertyTooltipContent({ property }: { property: PlanningProperty }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currency = property.currency || 'EUR';
  const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 });
  const rawPhoto = property.photoUrls?.[0];
  const photo = rawPhoto && rawPhoto.trim().length > 0 ? rawPhoto : undefined;
  // Pre-build map URL si coords + token dispo (fallback OU header alternatif)
  const mapUrl = buildStaticMapUrl(
    property.latitude,
    property.longitude,
    TOOLTIP_WIDTH,
    HEADER_HEIGHT,
    theme.palette.mode === 'dark',
  );
  // Si la photo echoue (URL cassée, 404, CORS), on bascule sur la carte
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = photo && !photoFailed;
  const showMap = !showPhoto && Boolean(mapUrl);
  const hasHeader = Boolean(showPhoto || showMap);

  return (
    <Box sx={{ width: TOOLTIP_WIDTH }}>
      {showPhoto && (
        <Box
          sx={{
            width: '100%',
            height: HEADER_HEIGHT,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            overflow: 'hidden',
            mb: 1.25,
            bgcolor: 'action.hover',
          }}
        >
          <Box
            component="img"
            src={photo}
            alt={property.name}
            onError={() => setPhotoFailed(true)}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
            }}
          />
        </Box>
      )}
      {showMap && (
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: HEADER_HEIGHT,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            overflow: 'hidden',
            mb: 1.25,
            bgcolor: 'action.hover',
          }}
        >
          <Box
            component="img"
            src={mapUrl ?? undefined}
            alt={`Carte ${property.city || property.name}`}
            loading="lazy"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
            }}
          />
          <Chip
            size="small"
            icon={<LocationOn size={10} strokeWidth={2} />}
            label="Localisation"
            sx={{
              position: 'absolute',
              top: 5,
              left: 5,
              height: 16,
              fontSize: LABEL_FS,
              fontWeight: 600,
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'divider',
              '& .MuiChip-icon': { ml: 0.5, mr: -0.25, color: 'warning.main' },
              '& .MuiChip-label': { px: 0.5 },
            }}
          />
        </Box>
      )}
      <Box sx={{ px: 1.5, pb: 1.5, pt: hasHeader ? 0.25 : 1.5 }}>
        <Typography sx={{ fontSize: TITLE_FS, fontWeight: 600, lineHeight: 1.3, color: 'text.primary' }}>
          {property.name}
        </Typography>
        {property.type && (
          <Chip
            label={property.type}
            size="small"
            sx={{
              mt: 0.75,
              height: 18,
              fontSize: LABEL_FS,
              fontWeight: 600,
              bgcolor: 'var(--accent-soft)',
              color: 'var(--accent)',
              textTransform: 'capitalize',
              '& .MuiChip-label': { px: 0.625 },
            }}
          />
        )}

        {(property.address || property.city) && (
          <Box sx={{ display: 'flex', gap: 0.625, mt: 1, alignItems: 'flex-start' }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mt: 0.15 }}>
              <LocationOn size={ICON_SIZE} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: BODY_FS, color: 'text.secondary', lineHeight: 1.4 }}>
              {[property.address, property.city].filter(Boolean).join(', ')}
            </Typography>
          </Box>
        )}

        {property.ownerName && (
          <Box sx={{ display: 'flex', gap: 0.625, mt: 0.625, alignItems: 'center' }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
              <Person size={ICON_SIZE} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: BODY_FS, color: 'text.secondary' }}>
              {property.ownerName}
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 1.25 }} />

        {/* Stats grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
          <StatPill
            icon={<People size={ICON_SIZE} strokeWidth={1.75} />}
            label="Voyageurs max"
            value={`${property.maxGuests}`}
          />
          {property.minimumNights != null && property.minimumNights > 0 && (
            <StatPill
              icon={<Bed size={ICON_SIZE} strokeWidth={1.75} />}
              label="Nuits min."
              value={`${property.minimumNights}`}
            />
          )}
          {property.nightlyPrice != null && property.nightlyPrice > 0 && (
            <StatPill
              icon={<Euro size={ICON_SIZE} strokeWidth={1.75} />}
              label="Prix / nuit"
              value={fmt.format(property.nightlyPrice)}
              highlight
            />
          )}
          {property.cleaningBasePrice != null && property.cleaningBasePrice > 0 && (
            <StatPill
              icon={<CleaningServices size={ICON_SIZE} strokeWidth={1.75} />}
              label="Ménage"
              value={fmt.format(property.cleaningBasePrice)}
            />
          )}
        </Box>

        {/* Check-in / check-out times */}
        {(property.defaultCheckInTime || property.defaultCheckOutTime) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.75, flexWrap: 'wrap' }}>
            {property.defaultCheckInTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}>
                  <AccessTime size={ICON_SIZE} strokeWidth={1.75} />
                </Box>
                <Typography sx={{ fontSize: BODY_FS, color: 'text.secondary' }}>
                  Check-in <Box component="strong" sx={{ color: 'text.primary' }}>{property.defaultCheckInTime.slice(0, 5)}</Box>
                </Typography>
              </Box>
            )}
            {property.defaultCheckOutTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'warning.main' }}>
                  <AccessTime size={ICON_SIZE} strokeWidth={1.75} />
                </Box>
                <Typography sx={{ fontSize: BODY_FS, color: 'text.secondary' }}>
                  Check-out <Box component="strong" sx={{ color: 'text.primary' }}>{property.defaultCheckOutTime.slice(0, 5)}</Box>
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {property.cleaningFrequency && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mt: 0.75 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
              <CalendarMonth size={ICON_SIZE} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: BODY_FS, color: 'text.secondary' }}>
              Fréquence ménage : <Box component="strong" sx={{ color: 'text.primary' }}>{getCleaningFrequencyLabel(property.cleaningFrequency, t)}</Box>
            </Typography>
          </Box>
        )}

        {/* CTA navigable vers la fiche complète. Tooltip rendu dans un portail
            → cet element est cliquable directement (les clicks ne bubblent pas
            au Box parent dans le planning, donc on declenche la nav ici). */}
        <Box
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/properties/${property.id}`);
          }}
          sx={{
            mt: 1.25,
            pt: 1,
            borderTop: '1px dashed',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            color: 'primary.main',
            transition: 'color 150ms',
            '&:hover': { color: 'primary.dark' },
          }}
        >
          <Typography sx={{ fontSize: LABEL_FS, fontWeight: 600, color: 'inherit' }}>
            Ouvrir la fiche complète
          </Typography>
          <ChevronRight size={ICON_SIZE} strokeWidth={2} />
        </Box>
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
        p: 0.875,
        borderRadius: 1,
        bgcolor: highlight
          ? 'var(--ok-soft)'
          : 'color-mix(in srgb, var(--ink) 2.5%, transparent)',
        border: '1px solid',
        borderColor: highlight ? 'var(--ok)' : 'var(--line)',
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, color: highlight ? 'var(--ok)' : 'var(--muted)', mb: 0.375 }}>
        {icon}
        <Typography sx={{ fontSize: LABEL_FS, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'inherit', lineHeight: 1 }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: highlight ? 'var(--ok)' : 'var(--ink)', lineHeight: 1.2 }}>
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
  /** Si fourni, affiche un drag handle sur le bord droit pour redimensionner. */
  onColWidthChange?: (width: number) => void;
  effectiveRowHeight: number;
  emptyRowCount?: number;
  reservationCountByProperty?: Map<number, number>;
  channelSyncMap?: ChannelSyncMap;
}

const PlanningPropertyColumn: React.FC<PlanningPropertyColumnProps> = React.memo(({
  properties,
  density,
  selectedPropertyId,
  colWidth,
  onColWidthChange,
  effectiveRowHeight,
  emptyRowCount = 0,
  reservationCountByProperty,
  channelSyncMap,
}) => {
  // ── Popover logement (maquette) : ouvert au clic sur le nom ──────────────
  // Le tooltip hover riche reste en place (info au survol) ; il est suspendu
  // pour la ligne dont le popover est ouvert afin d'éviter le chevauchement.
  const [popover, setPopover] = useState<{ anchorEl: HTMLElement; propertyId: number } | null>(null);
  const popoverProperty = popover
    ? properties.find((p) => p.id === popover.propertyId) ?? null
    : null;
  // ── Drag handle pour redimensionner la colonne ───────────────────────────
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onColWidthChange) return;
    e.preventDefault();
    e.stopPropagation();
    resizeStartRef.current = { startX: e.clientX, startWidth: colWidth };
    setIsResizing(true);

    const handleMove = (ev: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const delta = ev.clientX - start.startX;
      onColWidthChange(start.startWidth + delta);
    };

    const handleUp = () => {
      resizeStartRef.current = null;
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidth, onColWidthChange]);


  return (
    <Box
      sx={{
        position: 'sticky',
        left: 0,
        zIndex: 10,
        width: colWidth,
        minWidth: colWidth,
        flexShrink: 0,
        backgroundColor: 'var(--card)',
        borderRight: '1px solid var(--line)',
      }}
    >
      {/* Drag handle pour redimensionner la colonne (bord droit).
          Hit-area de 6px, visuel discret sauf au hover/drag. */}
      {onColWidthChange && (
        <Box
          onMouseDown={handleResizeMouseDown}
          role="separator"
          aria-label="Redimensionner la colonne logements"
          aria-orientation="vertical"
          sx={{
            position: 'absolute',
            top: 0,
            right: -3, // chevauche legerement la grille pour faciliter la prise
            width: 6,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 11,
            // Ligne verticale visible uniquement au hover ou pendant le drag.
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 2,
              width: 2,
              height: '100%',
              backgroundColor: isResizing
                ? 'var(--accent)'
                : 'transparent',
              transition: 'background-color 150ms ease',
            },
            '&:hover::after': {
              backgroundColor: isResizing
                ? 'var(--accent)'
                : 'color-mix(in srgb, var(--accent) 55%, transparent)',
            },
          }}
        />
      )}
      {properties.map((property, idx) => {
        const reservationCount = reservationCountByProperty?.get(property.id) ?? 0;
        const subtitle = property.city || property.address || '';
        const sync = channelSyncMap?.get(property.id);
        // Color du wifi : vert si tout sync, ambre si partiel, rouge si zero
        const syncColor = sync && sync.total > 0
          ? sync.synced === sync.total
            ? 'var(--ok)'
            : sync.synced > 0 ? 'var(--warn)' : 'var(--err)'
          : 'var(--faint)';
        return (
          <Tooltip
            key={property.id}
            title={popover?.propertyId === property.id ? '' : <PropertyTooltipContent property={property} />}
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
              onClick={(e) => setPopover({ anchorEl: e.currentTarget, propertyId: property.id })}
              sx={{
                position: 'relative',
                height: effectiveRowHeight,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 0,
                px: 0,
                py: '6px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--line)',
                backgroundColor: selectedPropertyId === property.id || popover?.propertyId === property.id
                  ? 'var(--accent-soft)'
                  : idx % 2 === 0
                    ? 'transparent'
                    : 'color-mix(in srgb, var(--ink) 1.5%, transparent)',
                transition: 'background-color 0.15s ease',
                '&:hover': {
                  backgroundColor: 'var(--hover)',
                },
              }}
            >
              {/* Bloc texte (maquette) : nom + ville/arrondissement dessous,
                  centre verticalement. Le count de reservations en cours reste
                  visible en pastille discrete inline a cote du nom. */}
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.125,
                  pl: 1.25,
                  pr: 0.75,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, minWidth: 0 }}>
                  {/* Box component=span : evite l'heritage du variant body1 du
                      Typography (le theme MUI a des fontSize responsive en
                      media-query qui peuvent surcharger sx en breakpoint large). */}
                  <Box
                    component="span"
                    sx={{
                      fontSize: density === 'compact' ? '0.6875rem' : '0.75rem',
                      fontWeight: 600,
                      color: 'var(--ink)',
                      lineHeight: 1.25,
                      letterSpacing: '-0.01em',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                      minWidth: 0,
                    }}
                  >
                    {property.name}
                  </Box>
                  {/* Reservations en cours / a venir : pastille inline discrete */}
                  {reservationCount > 0 && (
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.25,
                        flexShrink: 0,
                        color: 'var(--faint)',
                      }}
                    >
                      <TagIcon size={10} strokeWidth={1.75} />
                      <Box
                        component="span"
                        sx={{
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {reservationCount}
                      </Box>
                    </Box>
                  )}
                </Box>
                {subtitle && (
                  <Box
                    component="span"
                    sx={{
                      fontSize: density === 'compact' ? '0.5625rem' : '0.625rem',
                      fontWeight: 400,
                      color: 'var(--muted)',
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                  >
                    {subtitle}
                  </Box>
                )}
              </Box>
              {/* Indicateur en bas-droite : sync canaux (wifi) */}
              {sync && sync.total > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    right: 6,
                    bottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    pointerEvents: 'none',
                  }}
                >
                  <Tooltip
                    title={`${sync.synced} sur ${sync.total} canaux synchronises (sync < 24h)`}
                    placement="top"
                    arrow
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.25,
                        color: syncColor,
                        pointerEvents: 'auto',
                      }}
                    >
                      <ChannelIcon size={11} strokeWidth={1.75} />
                      <Box
                        component="span"
                        sx={{
                          fontSize: '0.5625rem',
                          fontWeight: 600,
                          color: 'inherit',
                          lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {sync.synced}/{sync.total}
                      </Box>
                    </Box>
                  </Tooltip>
                </Box>
              )}
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
            backgroundColor: (properties.length + i) % 2 === 0
              ? 'transparent'
              : 'color-mix(in srgb, var(--ink) 1.5%, transparent)',
          }}
        />
      ))}

      {/* Popover logement (clic sur le nom) */}
      {popover && popoverProperty && (
        <PropertyPopover
          anchorEl={popover.anchorEl}
          property={popoverProperty}
          onClose={() => setPopover(null)}
        />
      )}
    </Box>
  );
});

PlanningPropertyColumn.displayName = 'PlanningPropertyColumn';
export default PlanningPropertyColumn;
