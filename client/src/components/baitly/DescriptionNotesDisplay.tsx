import { CheckSquareIcon, EllipsisIcon, ListChecksIcon, WrenchIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/DescriptionNotesDisplay.tsx (MUI).
 * Description du logement + consignes (lignes préfixées `*` = checklist),
 * tuile accentuée selon le type d'intervention.
 */
export type ConsigneVariant = 'cleaning' | 'maintenance' | 'other';

export interface DescriptionNotesDisplayProps {
  description?: string;
  /** Notes ligne à ligne — préfixe `*` = item de checklist. */
  notes?: string;
  variant?: ConsigneVariant;
}

const VARIANT_CONFIG: Record<
  ConsigneVariant,
  { title: string; icon: React.ReactNode; tile: string; accent: string }
> = {
  cleaning: {
    title: 'Consignes de ménage',
    icon: <ListChecksIcon />,
    tile: 'bg-primary-soft border-primary/25',
    accent: 'text-primary',
  },
  maintenance: {
    title: 'Consignes de travaux',
    icon: <WrenchIcon />,
    tile: 'bg-warning-soft border-warning/25',
    accent: 'text-warning',
  },
  other: {
    title: 'Consignes diverses',
    icon: <EllipsisIcon />,
    tile: 'bg-muted border-border',
    accent: 'text-muted-foreground',
  },
};

export default function DescriptionNotesDisplay({
  description,
  notes,
  variant = 'other',
}: DescriptionNotesDisplayProps) {
  const config = VARIANT_CONFIG[variant];
  const lines = (notes ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!description && lines.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {description && (
        <p className="m-0 text-sm leading-relaxed text-foreground">{description}</p>
      )}
      {lines.length > 0 && (
        <section className={cn('rounded-lg border p-3', config.tile)}>
          <h4
            className={cn(
              'm-0 flex items-center gap-1.5 text-xs font-semibold [&>svg]:size-4',
              config.accent
            )}
          >
            {config.icon}
            {config.title}
          </h4>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {lines.map((line, index) => {
              const isChecklist = line.startsWith('*');
              const text = isChecklist ? line.slice(1).trim() : line;
              return (
                <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                  {isChecklist ? (
                    <CheckSquareIcon className={cn('mt-0.5 size-3.5 shrink-0', config.accent)} />
                  ) : (
                    <span className={cn('mt-2 size-1 shrink-0 rounded-full bg-current', config.accent)} />
                  )}
                  {text}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
