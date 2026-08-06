import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/FilterChipRow.tsx (MUI).
 * Rangée de chips-filtres exclusifs : re-clic sur l'actif = désélection ('').
 * La couleur de marque de chaque option teinte le chip actif (color-mix).
 */
export interface FilterChipOption<T extends string = string> {
  value: T;
  label: string;
  /** Couleur de marque (hex) — fond pastel + texte teintés quand actif. */
  color: string;
  count?: number;
}

export interface FilterChipRowProps<T extends string> {
  options: FilterChipOption<T>[];
  value: T | '';
  onChange: (value: T | '') => void;
  allLabel?: string;
  allCount?: number;
  size?: 'compact' | 'comfortable';
  className?: string;
}

function Chip({
  label,
  count,
  color,
  active,
  compact,
  onClick,
}: {
  label: string;
  count?: number;
  color?: string;
  active: boolean;
  compact: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={
        active && color
          ? {
              backgroundColor: `color-mix(in srgb, ${color} var(--bui-tint-bg, 14%), transparent)`,
              color: `color-mix(in srgb, ${color} var(--bui-tint-text, 80%), var(--bui-ink))`,
              borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
            }
          : undefined
      }
      className={cn(
        'relative inline-flex cursor-pointer items-center gap-1 rounded-full border font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        compact ? 'h-[22px] px-2 text-xs' : 'h-[26px] px-2.5 text-xs',
        // Zone tactile élargie SANS toucher au dessin : au doigt, la puce passe
        // de 26 à 32 px de haut via un pseudo-élément transparent. 4 px et pas
        // plus : la rangée a 6 px d'interligne, au-delà les zones de deux
        // rangées se chevaucheraient franchement et on toucherait la mauvaise.
        // (4 et non 3 : le bloc conteneur d'un absolu est la boîte de
        // REMPLISSAGE, le filet de 1 px mange un pixel de chaque côté.)
        // Sans effet à la souris, où 26 px se visent très bien.
        // Variante NATIVE `pointer-coarse:` : la forme arbitraire
        // `[@media(pointer:coarse)]:` marchait en dev (JIT) mais n'était pas
        // émise dans le CSS bâti — vérifié dans dist/assets.
        'pointer-coarse:after:absolute pointer-coarse:after:inset-x-0',
        "pointer-coarse:after:-top-[4px] pointer-coarse:after:-bottom-[4px] pointer-coarse:after:content-['']",
        active
          ? 'border-primary/35 bg-primary-soft text-primary'
          : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {label}
      {count !== undefined && <span className="opacity-70 tabular-nums">{count}</span>}
    </button>
  );
}

export default function FilterChipRow<T extends string>({
  options,
  value,
  onChange,
  allLabel,
  allCount,
  size = 'comfortable',
  className,
}: FilterChipRowProps<T>) {
  const compact = size === 'compact';
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {allLabel && (
        <Chip
          label={allLabel}
          count={allCount}
          active={value === ''}
          compact={compact}
          onClick={() => onChange('')}
        />
      )}
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          count={opt.count}
          color={opt.color}
          active={value === opt.value}
          compact={compact}
          onClick={() => onChange(value === opt.value ? '' : opt.value)}
        />
      ))}
    </div>
  );
}
