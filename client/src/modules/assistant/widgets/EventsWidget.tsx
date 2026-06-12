import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

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
 * Pattern « Signature » : tokens var(--…), date en display tabular-nums,
 * chips statut texte couleur + fond {@code -soft}.</p>
 */
export const EventsWidget: React.FC<EventsWidgetProps> = ({ data }) => {
  const items = data.items ?? [];

  if (items.length === 0) {
    return (
      <Box sx={{ mt: 1, mb: 1.5 }}>
        <Box sx={{
          p: 2, borderRadius: '12px',
          bgcolor: 'var(--field)',
          textAlign: 'center',
        }}>
          <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)' }}>
            Aucun evenement detecte sur cette periode{data.city ? ` a ${data.city}` : ''}.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {data.title && (
        <Typography sx={{
          display: 'block', mb: 0.75, fontSize: '10.5px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.05em',
          color: 'var(--faint)',
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
        <Typography sx={{
          display: 'block', mt: 0.75, fontSize: '11.5px',
          color: 'var(--faint)', textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {items.length}/{data.totalElements} affiches — affine les dates pour voir le reste
        </Typography>
      )}
    </Box>
  );
};

const EventRow: React.FC<{ item: EventItem }> = ({ item }) => {
  const [typeColor, typeSoft] = typeToColors(item.type);

  return (
    <Box
      sx={{
        px: 1.25, py: 1,
        borderRadius: '10px',
        bgcolor: 'var(--card)',
        border: '1px solid var(--line)',
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
          fontFamily: 'var(--font-display)',
          fontSize: '1rem', fontWeight: 600,
          lineHeight: 1.1,
          color: 'var(--ink)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatDay(item.date)}
        </Typography>
        <Typography sx={{
          fontSize: '10.5px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.05em',
          color: 'var(--faint)',
        }}>
          {formatMonth(item.date)}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25, flexWrap: 'wrap' }}>
          <Typography sx={{
            fontSize: '13.5px', fontWeight: 600,
            color: 'var(--ink)',
          }}>
            {item.title}
          </Typography>
          {item.type && (
            <Chip
              label={typeLabel(item.type)}
              size="small"
              sx={{
                height: 18, fontSize: '10.5px', fontWeight: 700,
                letterSpacing: '.04em', textTransform: 'uppercase',
                bgcolor: typeSoft,
                color: typeColor,
                border: 'none',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
          {item.city && item.city !== '*' && (
            <Typography sx={{
              fontSize: '11.5px', color: 'var(--faint)',
            }}>
              {item.city}
            </Typography>
          )}
        </Box>
        {item.description && (
          <Typography sx={{
            display: 'block', fontSize: '11.5px',
            color: 'var(--muted)',
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

/**
 * Couleur du chip type → paires sémantiques [texte, fond soft].
 * FESTIVAL = warn (ambre désaturé) ; neutre = --muted/--hover (pas de token
 * « chip neutre » dédié — voir baseline §7).
 */
function typeToColors(type: string | undefined): [string, string] {
  switch (type?.toUpperCase()) {
    case 'PUBLIC_HOLIDAY': return ['var(--err)', 'var(--err-soft)'];
    case 'FESTIVAL':       return ['var(--warn)', 'var(--warn-soft)'];
    case 'SPORT':          return ['var(--ok)', 'var(--ok-soft)'];
    case 'FAIR':           return ['var(--info)', 'var(--info-soft)'];
    default:               return ['var(--muted)', 'var(--hover)'];
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
