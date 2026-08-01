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

// Tuiles sémantiques Signature : fond -soft + hairline color-mix + texte couleur
const VARIANT_CONFIG: Record<ConsigneVariant, VariantConfig> = {
  cleaning: {
    title: 'Consignes de ménage',
    icon: <span className="inline-flex text-[var(--accent)] mt-0 shrink-0"><Checklist size={16} strokeWidth={1.75} /></span>,
    bgColor: 'var(--accent-soft)',
    borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
    accentColor: 'var(--accent)',
  },
  maintenance: {
    title: 'Consignes de travaux',
    icon: <span className="inline-flex text-[var(--warn)] mt-0 shrink-0"><Build size={16} strokeWidth={1.75} /></span>,
    bgColor: 'var(--warn-soft)',
    borderColor: 'color-mix(in srgb, var(--warn) 25%, transparent)',
    accentColor: 'var(--warn)',
  },
  other: {
    title: 'Consignes diverses',
    icon: <span className="inline-flex text-[var(--muted)] mt-0 shrink-0"><MoreHoriz size={16} strokeWidth={1.75} /></span>,
    bgColor: 'var(--surface-2)',
    borderColor: 'var(--line)',
    accentColor: 'var(--muted)',
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

const BOX_BASE_CLASS =
  'flex-1 flex gap-1.5 py-[7.5px] px-[9px] rounded-[12px] border border-solid min-h-[80px]';

const TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  mb: 0.5,
} as const;

/** Report en classes de `TITLE_SX`. */
const TITLE_CLASS = 'text-[10.5px] font-bold uppercase tracking-[.06em] mb-[3px]';

const TEXT_SX = {
  fontSize: '11.5px',
  color: 'var(--muted)',
  lineHeight: 1.4,
  whiteSpace: 'pre-line',
} as const;

/** Report en classes de `TEXT_SX`. */
const TEXT_CLASS = 'text-[11.5px] text-[var(--muted)] leading-[1.4] whitespace-pre-line';

// ─── Component ──────────────────────────────────────────────────────────────

const DescriptionNotesDisplay: React.FC<DescriptionNotesDisplayProps> = React.memo(
  ({ description, notes, variant = 'cleaning' }) => {
    const config = VARIANT_CONFIG[variant];
    const items = notes ? parseNotes(notes) : [];

    const hasDescription = !!description;
    const hasNotes = items.length > 0;

    return (
      <div className="flex gap-2">
        {/* Description du logement */}
        <div className={`${BOX_BASE_CLASS} bg-[var(--surface-2)] border-[var(--line)]`}>
          <span className="inline-flex text-[var(--faint)] mt-0 shrink-0"><Description size={16} strokeWidth={1.75} /></span>
          <div className="flex-1">
            <p className={cn(TITLE_CLASS, 'cn-text-body1 text-[var(--faint)]')}>
              Description du logement
            </p>
            {hasDescription ? (
              <p className={cn(TEXT_CLASS, 'cn-text-body1')}>
                {description}
              </p>
            ) : (
              <p className={cn(TEXT_CLASS, 'cn-text-body1 italic text-[var(--faint)]')}>
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
            <p className={cn(TITLE_CLASS, 'cn-text-body1')} style={{ color: config.accentColor }}>
              {config.title}
            </p>

            {hasNotes ? (
              <div className="flex flex-col gap-0">
                {items.map((item, i) => {
                  if (item.isTitle) {
                    return (
                      <p className={cn('cn-text-body1 text-[11.5px] font-bold text-[var(--body)] mb-[1.5px]', i > 0 ? 'mt-[4.5px]' : 'mt-0')} key={i}>
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
                        className="mt-[3px] shrink-0 border-[var(--line-2)]"
                      />
                      <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] leading-[1.4] flex-1 pt-0.5">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={cn(TEXT_CLASS, 'cn-text-body1 italic text-[var(--faint)]')}>
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
