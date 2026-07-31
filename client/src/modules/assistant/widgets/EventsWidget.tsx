import React from 'react';
import { Chip } from '@mui/material';

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
      <div className="mt-1.5 mb-2">
        <div className="p-3 rounded-[12px] bg-[var(--field)] text-center">
          <p className="cn-text-body1 text-[12.5px] text-[var(--muted)]">
            Aucun evenement detecte sur cette periode{data.city ? ` a ${data.city}` : ''}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 mb-2">
      {data.title && (
        <p className="cn-text-body1 block mb-1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
          {data.title}
        </p>
      )}

      <div className="flex flex-col gap-1">
        {items.map((item, idx) => (
          <EventRow key={item.id ?? `${item.date}-${idx}`} item={item} />
        ))}
      </div>

      {data.truncated && (
        <p className="cn-text-body1 block mt-1 text-[11.5px] text-[var(--faint)] text-end tabular-nums">
          {items.length}/{data.totalElements} affiches — affine les dates pour voir le reste
        </p>
      )}
    </div>
  );
};

const EventRow: React.FC<{ item: EventItem }> = ({ item }) => {
  const [typeColor, typeSoft] = typeToColors(item.type);

  return (
    <div className="px-2 py-1.5 rounded-[10px] bg-[var(--card)] border border-[var(--line)] flex gap-1.5 items-start">
      <div className="min-w-[64px] flex flex-col items-center pt-0.5">
        <p className="cn-text-body1 font-[var(--font-display)] text-[1rem] font-semibold leading-[1.1] text-[var(--ink)] tabular-nums">
          {formatDay(item.date)}
        </p>
        <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
          {formatMonth(item.date)}
        </p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5 flex-wrap">
          <p className="cn-text-body1 text-[13.5px] font-semibold text-[var(--ink)]">
            {item.title}
          </p>
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
            <p className="cn-text-body1 text-[11.5px] text-[var(--faint)]">
              {item.city}
            </p>
          )}
        </div>
        {item.description && (
          <p className="cn-text-body1 block text-[11.5px] text-[var(--muted)] leading-[1.4]">
            {item.description}
          </p>
        )}
      </div>
    </div>
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
