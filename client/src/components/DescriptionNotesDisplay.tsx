import React from 'react';
import { cn } from '../utils/cn';
import { Checkbox } from './ui';
import {
  Description,
  Checklist,
  Build,
  MoreHoriz,
} from '../icons';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConsigneVariant = 'cleaning' | 'maintenance' | 'other';

export interface DescriptionNotesDisplayProps {
  /** Property description text */
  description?: string;
  /** Cleaning/maintenance notes text (line-separated, * prefix = checklist item) */
  notes?: string;
  /** Controls the consigne title & accent color */
  variant?: ConsigneVariant;
}

// ─── Variant config ─────────────────────────────────────────────────────────

interface VariantConfig {
  title: string;
  icon: React.ReactElement;
  bgColor: string;
  borderColor: string;
  accentColor: string;
}

// Tuiles sémantiques Baitly UI : fond `-soft` + filet color-mix + titre `-ink`.
// Les couleurs sont choisies à l'exécution (via `style`), donc portées par les
// variables `--bui-*` et non par des utilities Tailwind, qui ne peuvent pas
// être générées pour une valeur calculée.
const VARIANT_CONFIG: Record<ConsigneVariant, VariantConfig> = {
  cleaning: {
    title: 'Consignes de ménage',
    icon: <span className="inline-flex text-primary mt-0 shrink-0"><Checklist size={16} strokeWidth={1.75} /></span>,
    bgColor: 'var(--bui-primary-soft)',
    borderColor: 'color-mix(in srgb, var(--bui-primary) 25%, transparent)',
    accentColor: 'var(--bui-primary)',
  },
  maintenance: {
    title: 'Consignes de travaux',
    icon: <span className="inline-flex text-warning mt-0 shrink-0"><Build size={16} strokeWidth={1.75} /></span>,
    bgColor: 'var(--bui-warning-soft)',
    borderColor: 'color-mix(in srgb, var(--bui-warning) 25%, transparent)',
    accentColor: 'var(--bui-warning-ink)',
  },
  other: {
    title: 'Consignes diverses',
    icon: <span className="inline-flex text-muted-foreground mt-0 shrink-0"><MoreHoriz size={16} strokeWidth={1.75} /></span>,
    bgColor: 'var(--bui-card)',
    borderColor: 'var(--bui-border)',
    accentColor: 'var(--bui-muted-foreground)',
  },
};

// ─── Parse notes into checklist items ───────────────────────────────────────

interface ChecklistItem {
  text: string;
  isTitle: boolean;
}

function parseNotes(notes: string): ChecklistItem[] {
  return notes
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const isTitle = line.startsWith('**') && line.endsWith('**');
      const text = line
        .replace(/^\s*\*\s*/, '')     // Remove leading * bullet
        .replace(/^\*\*|\*\*$/g, '') // Remove bold markers
        .trim();
      return { text, isTitle };
    })
    .filter(item => item.text.length > 0);
}

// ─── Shared box classes ─────────────────────────────────────────────────────

// `min-w-0` : sans lui, un mot long (une URL, un nom de residence) impose sa
// largeur a la boite, qui refuse alors de retrecir et pousse sa voisine dehors.
const BOX_BASE_CLASS =
  'flex min-w-0 gap-1.5 py-[7.5px] px-[9px] rounded-xl border border-solid min-h-[80px] min-[900px]:flex-1';

const TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  mb: 0.5,
} as const;

/** Report en classes de `TITLE_SX`, sur l'échelle « overline » de Baitly UI. */
const TITLE_CLASS = 'text-2xs font-semibold uppercase tracking-wide mb-[3px]';

const TEXT_SX = {
  fontSize: '11.5px',
  color: 'var(--bui-muted-foreground)',
  lineHeight: 1.4,
  whiteSpace: 'pre-line',
} as const;

/** Report en classes de `TEXT_SX`. */
const TEXT_CLASS = 'text-xs text-muted-foreground leading-[1.4] whitespace-pre-line';

// ─── Component ──────────────────────────────────────────────────────────────

const DescriptionNotesDisplay: React.FC<DescriptionNotesDisplayProps> = React.memo(
  ({ description, notes, variant = 'cleaning' }) => {
    const config = VARIANT_CONFIG[variant];
    const items = notes ? parseNotes(notes) : [];

    const hasDescription = !!description;
    const hasNotes = items.length > 0;

    // Empilees sous 900 px : deux colonnes de texte long a 180 px de large se
    // lisent un mot par ligne, et la carte devient plus haute que l'ecran.
    return (
      <div className="flex flex-col gap-2 min-[900px]:flex-row">
        {/* Description du logement */}
        <div className={`${BOX_BASE_CLASS} bg-card border-border`}>
          <span className="inline-flex text-faint mt-0 shrink-0"><Description size={16} strokeWidth={1.75} /></span>
          <div className="flex-1">
            <p className={cn(TITLE_CLASS, 'text-faint')}>
              Description du logement
            </p>
            {hasDescription ? (
              <p className={TEXT_CLASS}>
                {description}
              </p>
            ) : (
              <p className={cn(TEXT_CLASS, 'italic text-faint')}>
                Aucune description renseignée
              </p>
            )}
          </div>
        </div>

        {/* Consignes — variant-driven : couleurs choisies a l'execution, donc via style. */}
        <div
          className={BOX_BASE_CLASS}
          style={{ backgroundColor: config.bgColor, borderColor: config.borderColor }}
        >
          {config.icon}
          <div className="flex-1">
            <p className={TITLE_CLASS} style={{ color: config.accentColor }}>
              {config.title}
            </p>

            {hasNotes ? (
              <div className="flex flex-col gap-0">
                {items.map((item, i) => {
                  if (item.isTitle) {
                    return (
                      <p className={cn('text-xs font-semibold text-foreground mb-[1.5px]', i > 0 ? 'mt-[4.5px]' : 'mt-0')} key={i}>
                        {item.text}
                      </p>
                    );
                  }

                  return (
                    <div className="flex items-start gap-0.5 py-0" key={i}>
                      {/* Puce purement decorative (liste en lecture seule) :
                          retiree de l'ordre de tabulation et de l'arbre a11y. */}
                      <Checkbox
                        checked={false}
                        disabled
                        aria-hidden
                        tabIndex={-1}
                        className="mt-[3px] shrink-0 border-field-line"
                      />
                      <p className="text-xs text-muted-foreground leading-[1.4] flex-1 pt-0.5">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={cn(TEXT_CLASS, 'italic text-faint')}>
                Aucune consigne renseignée
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

DescriptionNotesDisplay.displayName = 'DescriptionNotesDisplay';

export default DescriptionNotesDisplay;
