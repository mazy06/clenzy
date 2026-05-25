import React from 'react';
import { Box, Typography, useTheme, alpha, Chip } from '@mui/material';
import type { Theme } from '@mui/material/styles';

interface EventItem {
  id?: string;
  title: string;
  type?: string;
  date: string;
  city?: string;
  country?: string;
  description?: string;
}

interface EventsData {
  title?: string;
  city?: string;
  from?: string;
  to?: string;
  items?: EventItem[];
  count?: number;
  totalElements?: number;
  truncated?: boolean;
}

interface EventsWidgetProps {
  data: EventsData;
}

/**
 * Widget de rendu pour {@code displayHint="events"} — liste verticale
 * d'evenements locaux retournes par {@code get_local_events}.
 *
 * <p>Chaque event = ligne compacte : date + chip type + titre + description.
 * Borderless, bg tonal, design aligne aux autres widgets.</p>
 */
export const EventsWidget: React.FC<EventsWidgetProps> = ({ data }) => {
  const theme = useTheme();
  const items = data.items ?? [];

  if (items.length === 0) {
    return (
      <Box sx={{ mt: 1, mb: 1.5 }}>
        <Box sx={{
          p: 2, borderRadius: 2,
          bgcolor: alpha(theme.palette.text.primary, 0.04),
          textAlign: 'center',
        }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Aucun evenement detecte sur cette periode{data.city ? ` a ${data.city}` : ''}.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {data.title && (
        <Typography variant="caption" sx={{
          display: 'block', mb: 0.75, fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: theme.palette.text.secondary,
        }}>
          {data.title}
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {items.map((item, idx) => (
          <EventRow key={item.id ?? `${item.date}-${idx}`} item={item} />
        ))}
      </Box>

      {data.truncated && (
        <Typography variant="caption" sx={{
          display: 'block', mt: 0.75, fontSize: '0.7rem',
          color: theme.palette.text.disabled, textAlign: 'right',
        }}>
          {items.length}/{data.totalElements} affiches — affine les dates pour voir le reste
        </Typography>
      )}
    </Box>
  );
};

const EventRow: React.FC<{ item: EventItem }> = ({ item }) => {
  const theme = useTheme();
  const typeColor = typeToColor(item.type, theme);

  return (
    <Box
      sx={{
        px: 1.25, py: 1,
        borderRadius: 1.5,
        bgcolor: alpha(theme.palette.text.primary, 0.035),
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
      }}
    >
      <Box
        sx={{
          minWidth: 64,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 0.25,
        }}
      >
        <Typography sx={{
          fontSize: '1rem', fontWeight: 700,
          lineHeight: 1.1,
          color: theme.palette.text.primary,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatDay(item.date)}
        </Typography>
        <Typography variant="caption" sx={{
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: theme.palette.text.secondary,
        }}>
          {formatMonth(item.date)}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25, flexWrap: 'wrap' }}>
          <Typography sx={{
            fontSize: '0.8125rem', fontWeight: 600,
            color: theme.palette.text.primary,
          }}>
            {item.title}
          </Typography>
          {item.type && (
            <Chip
              label={typeLabel(item.type)}
              size="small"
              sx={{
                height: 18, fontSize: '0.65rem', fontWeight: 600,
                bgcolor: alpha(typeColor, 0.14),
                color: typeColor,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
          {item.city && item.city !== '*' && (
            <Typography variant="caption" sx={{
              fontSize: '0.7rem', color: theme.palette.text.disabled,
            }}>
              {item.city}
            </Typography>
          )}
        </Box>
        {item.description && (
          <Typography variant="caption" sx={{
            display: 'block', fontSize: '0.72rem',
            color: theme.palette.text.secondary,
            lineHeight: 1.4,
          }}>
            {item.description}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function typeToColor(type: string | undefined, theme: Theme): string {
  switch (type?.toUpperCase()) {
    case 'PUBLIC_HOLIDAY': return theme.palette.error.main;
    case 'FESTIVAL':       return '#D4A574'; // ambre Clenzy
    case 'SPORT':          return theme.palette.success.main;
    case 'FAIR':           return theme.palette.info.main;
    default:               return theme.palette.text.secondary;
  }
}

function typeLabel(type: string): string {
  switch (type.toUpperCase()) {
    case 'PUBLIC_HOLIDAY': return 'Jour ferie';
    case 'FESTIVAL':       return 'Festival';
    case 'SPORT':          return 'Sport';
    case 'FAIR':           return 'Salon';
    default:               return type;
  }
}

function formatDay(iso: string): string {
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit' }); }
  catch { return ''; }
}

function formatMonth(iso: string): string {
  try {
    return new Date(iso)
      .toLocaleDateString('fr-FR', { month: 'short' })
      .replace('.', '');
  } catch { return ''; }
}
