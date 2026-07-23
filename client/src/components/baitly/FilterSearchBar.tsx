import * as React from 'react';
import { LayoutGridIcon, ListIcon, MapIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from '../ui';
import HeaderSearchField from './HeaderSearchField';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/FilterSearchBar.tsx (MUI).
 * Barre recherche + selects de filtres + compteur + bascule de vue,
 * construite sur les composants du kit (InputGroup, Select, ToggleGroup).
 */
export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface FilterConfig {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  label?: string;
}

export interface ViewToggleConfig {
  mode: 'grid' | 'list' | 'map';
  onChange: (mode: 'grid' | 'list' | 'map') => void;
  modes?: Array<'grid' | 'list' | 'map'>;
}

export interface FilterSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: Partial<
    Record<
      'type' | 'status' | 'priority' | 'category' | 'location' | 'assignedTo' | 'host' | 'source',
      FilterConfig
    >
  >;
  counter: {
    label: string;
    count: number;
    singular?: string;
    plural?: string;
  };
  viewToggle?: ViewToggleConfig;
  /** Sans carte englobante (intégré dans un header existant). */
  bare?: boolean;
  className?: string;
}

const VIEW_ICONS = {
  grid: <LayoutGridIcon />,
  list: <ListIcon />,
  map: <MapIcon />,
} as const;

export default function FilterSearchBar({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Rechercher…',
  filters,
  counter,
  viewToggle,
  bare = false,
  className,
}: FilterSearchBarProps) {
  const configs = Object.values(filters).filter(Boolean) as FilterConfig[];
  const countLabel =
    counter.count > 1 ? (counter.plural ?? counter.label) : (counter.singular ?? counter.label);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        !bare && 'rounded-xl border border-border bg-card p-3',
        className
      )}
    >
      <HeaderSearchField
        value={searchTerm}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        className="w-56"
      />
      {configs.map((config, index) => (
        <Select key={index} value={config.value} onValueChange={config.onChange}>
          <SelectTrigger size="sm" className="min-w-32">
            <SelectValue placeholder={config.label} />
          </SelectTrigger>
          <SelectContent>
            {config.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.icon}
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      <span className="ms-auto text-sm text-muted-foreground tabular-nums">
        {counter.count} {countLabel}
      </span>
      {viewToggle && (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={viewToggle.mode}
          onValueChange={(next) => {
            if (next) viewToggle.onChange(next as ViewToggleConfig['mode']);
          }}
        >
          {(viewToggle.modes ?? ['grid', 'list']).map((mode) => (
            <ToggleGroupItem key={mode} value={mode} aria-label={mode}>
              {VIEW_ICONS[mode]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  );
}
