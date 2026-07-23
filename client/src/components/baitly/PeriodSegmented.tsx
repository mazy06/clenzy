import { ToggleGroup, ToggleGroupItem } from '../ui';

/**
 * Baitly — remaster de components/PeriodSegmented.tsx (MUI), construit sur
 * ToggleGroup. Sélection exclusive, jamais vide (re-clic = no-op).
 */
export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
}

export interface PeriodSegmentedProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel?: string;
}

export default function PeriodSegmented<T extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
}: PeriodSegmentedProps<T>) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
    >
      {options.map((opt) => (
        <ToggleGroupItem key={opt.value} value={opt.value}>
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
