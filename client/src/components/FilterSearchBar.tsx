import React, { useMemo, useState } from 'react';
import {
  GridView,
  ViewList,
  MapIcon,
  FilterList as FilterListIcon,
  Close as CloseIcon,
} from '../icons';
import {
  Button,
  Card,
  Field,
  FieldLabel,
  NativeSelect,
  NativeSelectOption,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  ToggleGroup,
  ToggleGroupItem,
} from './ui';
import NavCountBadge from './NavCountBadge';
import { useScreenSearch } from './ScreenChrome';
import { cn } from '../utils/cn';

const VIEW_ICON: Record<'grid' | 'list' | 'map', React.ReactNode> = {
  grid: <GridView size={16} strokeWidth={1.75} />,
  list: <ViewList size={16} strokeWidth={1.75} />,
  map: <MapIcon size={16} strokeWidth={1.75} />,
};

const VIEW_LABEL: Record<'grid' | 'list' | 'map', string> = {
  grid: 'Grille',
  list: 'Liste',
  map: 'Carte',
};

export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface FilterConfig {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  label?: string;
}

export interface ViewToggleConfig {
  mode: 'grid' | 'list' | 'map';
  onChange: (mode: 'grid' | 'list' | 'map') => void;
  /** Boutons de vue à afficher. Défaut : les 3 (grid/list/map). */
  modes?: Array<'grid' | 'list' | 'map'>;
}

export interface FilterSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: {
    type?: FilterConfig;
    status?: FilterConfig;
    priority?: FilterConfig;
    category?: FilterConfig;
    location?: FilterConfig;
    assignedTo?: FilterConfig;
    host?: FilterConfig;
    source?: FilterConfig;
  };
  counter: {
    label: string;
    count: number;
    singular?: string;
    plural?: string;
  };
  viewToggle?: ViewToggleConfig;
  /**
   * Commandes propres à l'écran (export, réglages…) rangées dans le panneau
   * plutôt que posées en icônes supplémentaires dans la barre de titre.
   */
  extraActions?: React.ReactNode;
  /** Rendu sans carte englobante (usage inline dans le PageHeader). */
  bare?: boolean;
  /**
   * Vestige de l'ancienne barre MUI : la valeur n'est plus lue depuis que la
   * barre est en Tailwind. Le prop reste declare — et volontairement non type —
   * pour que les appelants qui le passent encore continuent de compiler.
   */
  sx?: unknown;
}

/**
 * Réglages d'affichage d'un écran de liste, réunis derrière UN bouton.
 *
 * <p>La barre de titre portait jusqu'ici une icône par réglage : trois pour le
 * mode d'affichage, une par filtre, une pour l'export. Six pastilles muettes
 * alignées, qu'il fallait survoler une à une pour savoir ce qu'elles font, et
 * qui laissaient au titre la portion congrue. Tout est désormais replié dans un
 * panneau ouvert par l'icône filtre — les modes d'affichage y retrouvent leur
 * LIBELLÉ, que le format icône seule leur interdisait.</p>
 *
 * <p>Ce qui reste visible dans la barre : le nombre de résultats (une donnée,
 * pas une commande) et les filtres actifs sous forme de puces — sans elles,
 * une liste filtrée ne se distinguerait plus d'une liste vide.</p>
 */
export const FilterSearchBar: React.FC<FilterSearchBarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  filters,
  counter,
  viewToggle,
  extraActions,
  bare = false,
  sx: _sx,
}) => {
  const [open, setOpen] = useState(false);

  // La recherche de l'écran est déléguée au champ UNIQUE du PageHeader : la
  // barre ne dessine plus de champ, elle publie juste son état (cf. ScreenChrome).
  useScreenSearch(searchTerm, onSearchChange, searchPlaceholder);

  const counterText = (() => {
    const { count, singular, plural, label } = counter;
    const suffix = count > 1 ? plural || 's' : singular || '';
    return `${count} ${label}${suffix}`;
  })();

  // Un filtre est « actif » quand sa valeur n'est ni vide ni l'option « tout ».
  const activeFilters = useMemo(() => {
    const result: { key: string; label: string; displayValue: string; onClear: () => void }[] = [];
    Object.entries(filters).forEach(([key, filter]) => {
      if (!filter || !filter.value || filter.value === 'all') return;
      const selected = filter.options.find((o) => o.value === filter.value);
      if (selected) {
        result.push({
          key,
          label: filter.label || key,
          displayValue: selected.label,
          onClear: () => filter.onChange(''),
        });
      }
    });
    return result;
  }, [filters]);

  const definedFilters = Object.entries(filters).filter(([, f]) => Boolean(f)) as [string, FilterConfig][];
  const modes = viewToggle?.modes ?? ['grid', 'list', 'map'];

  const content = (
    <>
      {/* Puces des filtres actifs : conditionnelles, donc sans coût quand la
          liste n'est pas filtrée. */}
      {activeFilters.length > 0 && (
        <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {activeFilters.map((af) => (
            <span
              key={af.key}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]"
            >
              {af.label} : {af.displayValue}
              <button
                type="button"
                onClick={af.onClear}
                aria-label={`Retirer le filtre ${af.label}`}
                className="cursor-pointer rounded-full text-[var(--accent)] transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CloseIcon size={12} strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="ms-auto flex shrink-0 items-center gap-2">
        <span className="whitespace-nowrap text-[11.5px] font-semibold tabular-nums text-muted-foreground">
          {counterText}
        </span>

        <Popover open={open} onOpenChange={setOpen}>
          {/* Le trigger enveloppe un <span> : Radix y pose sa ref d'ancrage, que
              le Button du kit (composant fonction) ne peut pas recevoir. Sans
              cet hote, le panneau s'ouvrait hors ecran, ancre a l'origine. */}
          <PopoverTrigger asChild>
            <span className="relative inline-flex">
              <Button variant="outline" size="icon" aria-label="Affichage et filtres">
                <FilterListIcon size={16} strokeWidth={1.75} />
              </Button>
              <NavCountBadge
                count={activeFilters.length}
                tone="primary"
                className="pointer-events-none absolute -top-1.5 -end-1.5 h-4 min-w-4 px-1 text-[10px] ring-2 ring-background"
              />
            </span>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                Affichage et filtres
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
              >
                <CloseIcon size={14} strokeWidth={2} />
              </Button>
            </div>
            <Separator />

            <div className="flex flex-col gap-3 p-3">
              {viewToggle && (
                <Field>
                  <FieldLabel htmlFor="filterbar-view">Vue</FieldLabel>
                  {/* Le libellé revient : trois icônes nues obligeaient à les
                      survoler une par une pour deviner ce qu'elles font. */}
                  <ToggleGroup
                    id="filterbar-view"
                    type="single"
                    variant="outline"
                    size="sm"
                    spacing={0}
                    value={viewToggle.mode}
                    onValueChange={(next) => {
                      if (next) viewToggle.onChange(next as ViewToggleConfig['mode']);
                    }}
                    className="w-full [&>*]:flex-1"
                  >
                    {modes.map((mode) => (
                      <ToggleGroupItem key={mode} value={mode} className="gap-1.5 text-xs">
                        {VIEW_ICON[mode]}
                        {VIEW_LABEL[mode]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
              )}

              {definedFilters.map(([key, filter]) => (
                <Field key={key}>
                  <FieldLabel htmlFor={`filterbar-${key}`}>{filter.label || key}</FieldLabel>
                  <NativeSelect
                    id={`filterbar-${key}`}
                    className="w-full"
                    value={filter.value}
                    onChange={(e) => filter.onChange(e.target.value)}
                  >
                    {filter.options.map((option) => (
                      <NativeSelectOption key={option.value} value={option.value}>
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ))}

              {extraActions && (
                <>
                  <Separator />
                  <div className="flex flex-wrap items-center gap-2">{extraActions}</div>
                </>
              )}
            </div>

            {activeFilters.length > 0 && (
              <>
                <Separator />
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[11px] tabular-nums text-muted-foreground">{counterText}</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[12px] font-semibold"
                    onClick={() => Object.values(filters).forEach((f) => f?.onChange(''))}
                  >
                    Tout effacer
                  </Button>
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </>
  );

  if (bare) {
    return <div className="flex w-full flex-nowrap items-center gap-2 overflow-hidden">{content}</div>;
  }

  return (
    <Card className={cn('mb-2 gap-0 py-0')}>
      <div className="flex flex-nowrap items-center gap-2 overflow-hidden p-2">{content}</div>
    </Card>
  );
};

export default FilterSearchBar;
