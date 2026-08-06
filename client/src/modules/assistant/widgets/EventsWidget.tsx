import React from 'react';
import StatusChip from '../../../components/StatusChip';


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
 * Habillage Baitly UI : date en {@code tabular-nums}, pastilles de statut en
 * texte coloré sur fond {@code -soft}.</p>
 */
export const EventsWidget: React.FC<EventsWidgetProps> = ({ data }) => {
  const items = data.items ?? [];

  if (items.length === 0) {
    return (
      <div className="mt-1.5 mb-2">
        <div className="p-3 rounded-xl bg-muted text-center">
          <p className="text-xs text-muted-foreground">
            Aucun evenement detecte sur cette periode{data.city ? ` a ${data.city}` : ''}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 mb-2">
      {data.title && (
        <p className="block mb-1 text-2xs font-bold uppercase tracking-[.05em] text-faint">
          {data.title}
        </p>
      )}

      <div className="flex flex-col gap-1">
        {items.map((item, idx) => (
          <EventRow key={item.id ?? `${item.date}-${idx}`} item={item} />
        ))}
      </div>

      {data.truncated && (
        <p className="block mt-1 text-xs text-faint text-end tabular-nums">
          {items.length}/{data.totalElements} affiches — affine les dates pour voir le reste
        </p>
      )}
    </div>
  );
};

const EventRow: React.FC<{ item: EventItem }> = ({ item }) => {
  const [typeColor, typeSoft] = typeToColors(item.type);

  return (
    <div className="px-2 py-1.5 rounded-lg bg-card border border-border flex gap-1.5 items-start">
      <div className="min-w-[64px] flex flex-col items-center pt-0.5">
        <p className="text-[1rem] font-semibold leading-[1.1] text-foreground tabular-nums">
          {formatDay(item.date)}
        </p>
        <p className="text-2xs font-bold uppercase tracking-[.05em] text-faint">
          {formatMonth(item.date)}
        </p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5 flex-wrap">
          <p className="text-[13.5px] font-semibold text-foreground">
            {item.title}
          </p>
          {item.type && (
            <StatusChip size="sm" tokens={{ color: typeColor, bg: typeSoft }} label={typeLabel(item.type)} className="text-2xs tracking-[.04em] uppercase" />
          )}
          {item.city && item.city !== '*' && (
            <p className="text-xs text-faint">
              {item.city}
            </p>
          )}
        </div>
        {item.description && (
          <p className="block text-xs text-muted-foreground leading-[1.4]">
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
    case 'PUBLIC_HOLIDAY': return ['var(--color-destructive-ink)', 'var(--color-destructive-soft)'];
    case 'FESTIVAL':       return ['var(--color-warning-ink)', 'var(--color-warning-soft)'];
    case 'SPORT':          return ['var(--color-success-ink)', 'var(--color-success-soft)'];
    case 'FAIR':           return ['var(--color-info-ink)', 'var(--color-info-soft)'];
    default:               return ['var(--color-muted-foreground)', 'var(--color-accent)'];
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
