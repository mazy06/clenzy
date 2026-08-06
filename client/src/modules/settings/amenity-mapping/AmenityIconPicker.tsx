import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { ICON_CATALOG, ICON_REGISTRY, type IconGroup } from './amenityIcons';
import { useTranslation } from '../../../hooks/useTranslation';

interface AmenityIconPickerProps {
  open: boolean;
  amenityLabel: string;
  amenityCode: string;
  currentIcon: string;
  /** True si la valeur courante est un override (≠ defaut) — permet d'afficher Reset */
  isOverridden: boolean;
  onClose: () => void;
  onSelect: (iconName: string) => void;
  onReset: () => void;
}

/**
 * Dialog de selection d'icone pour une commodite.
 *
 * - Header : nom + code de la commodite + chip de l'icone actuelle
 * - Barre de recherche live (filtre par nom case-insensitive)
 * - Grille d'icones groupees par theme (Confort, Cuisine, Exterieur...)
 * - Click sur une icone = select + close immediat
 * - Bouton "Reinitialiser" si override actif (revient au defaut Baitly)
 */
export default function AmenityIconPicker({
  open,
  amenityLabel,
  amenityCode,
  currentIcon,
  isOverridden,
  onClose,
  onSelect,
  onReset,
}: AmenityIconPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo<IconGroup[]>(() => {
    if (!query.trim()) return ICON_CATALOG;
    const q = query.toLowerCase();
    return ICON_CATALOG.flatMap((g) => {
      const icons = g.icons.filter((name) => name.toLowerCase().includes(q));
      return icons.length > 0 ? [{ ...g, icons }] : [];
    });
  }, [query]);

  // Liste plate (cross-groupes) des icones actuellement visibles — base pour
  // la navigation clavier (ArrowUp/Down/Left/Right/Home/End).
  const flatIcons = useMemo<string[]>(
    () => filteredGroups.flatMap((g) => g.icons),
    [filteredGroups],
  );

  // Index focus dans flatIcons. Reset a 0 (ou index de currentIcon) a chaque
  // ouverture / changement de query.
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const currentIdx = flatIcons.indexOf(currentIcon);
    setFocusedIndex(currentIdx >= 0 ? currentIdx : 0);
  }, [open, flatIcons, currentIcon]);

  // Apres changement de focus (via keyboard), focus reellement le bouton.
  useEffect(() => {
    if (!open) return;
    const el = buttonRefs.current[focusedIndex];
    if (el) el.focus();
  }, [focusedIndex, open]);

  // Approximation du nombre de colonnes (grid auto-fill minmax(48px, 1fr))
  // sur un Dialog maxWidth=md (~700px utile, gap 6, padding) → ~12 cols
  // desktop. Nav clavier ArrowUp/Down saute de COLS positions, ce qui colle
  // visuellement au layout.
  const COLS_PER_ROW = 12;

  const handleSelect = useCallback((iconName: string) => {
    onSelect(iconName);
    onClose();
    setQuery('');
  }, [onSelect, onClose]);

  const handleClose = () => {
    onClose();
    setQuery('');
  };

  // Navigation clavier dans la grille d'icones — accessibilite WCAG AA pour
  // les utilisateurs au clavier (et lecteurs d'ecran). Stop propagation pour
  // que le Dialog ne ferme pas sur Esc avant qu'on l'ait gere.
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (flatIcons.length === 0) return;
    let nextIndex = focusedIndex;
    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (focusedIndex + 1) % flatIcons.length;
        break;
      case 'ArrowLeft':
        nextIndex = (focusedIndex - 1 + flatIcons.length) % flatIcons.length;
        break;
      case 'ArrowDown':
        nextIndex = Math.min(focusedIndex + COLS_PER_ROW, flatIcons.length - 1);
        break;
      case 'ArrowUp':
        nextIndex = Math.max(focusedIndex - COLS_PER_ROW, 0);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = flatIcons.length - 1;
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const name = flatIcons[focusedIndex];
        if (name) handleSelect(name);
        return;
      }
      default:
        return; // laisse les autres touches (typing dans search) bubbler
    }
    e.preventDefault();
    setFocusedIndex(nextIndex);
  }, [flatIcons, focusedIndex, handleSelect]);

  const CurrentIcon = ICON_REGISTRY[currentIcon];

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      {/* Le bouton Fermer en haut a droite est celui du primitif DialogContent. */}
      <DialogContent className="max-w-[900px] shadow-lg">
        <DialogHeader>
          <div className="flex flex-row items-center gap-[9px] pe-8">
            {/* Preview de l'icone courante */}
            {CurrentIcon && (
              <div className="size-9 rounded-md inline-flex items-center justify-center bg-primary-soft text-primary shrink-0">
                <CurrentIcon size={20} strokeWidth={1.75} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-[0.95rem] font-semibold leading-[1.3]">
                {t('settings.amenities.iconPicker.title', 'Choisir une icône')}
              </DialogTitle>
              <DialogDescription className="text-[0.72rem]">
                {amenityLabel} ·{' '}
                <span className="font-mono">{amenityCode}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search */}
        {/* Champ sans libelle visible (le titre du dialog le couvre) :
            l'aria-label reste la seule etiquette. */}
        <InputGroup className="mb-3">
          <InputGroupAddon align="inline-start">
            <Search size={16} className="text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            id="amenity-icon-search"
            aria-label={t('settings.amenities.iconPicker.searchPlaceholder', 'Rechercher une icône (ex: wifi, flame, lock)…')}
            placeholder={t('settings.amenities.iconPicker.searchPlaceholder', 'Rechercher une icône (ex: wifi, flame, lock)…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                onClick={() => setQuery('')}
                aria-label={t('settings.amenities.iconPicker.clearSearch', 'Effacer la recherche')}
              >
                <X size={14} />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>

        {/* Grouped icon grid */}
        {filteredGroups.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground">
              {t('settings.amenities.iconPicker.noMatch', 'Aucune icône ne correspond à « {{query}} ».', { query })}
            </p>
          </div>
        ) : (
          // Grid wrapper avec onKeyDown pour la navigation flechee
          // (role=grid + aria-rowcount/colcount serait plus strict mais le
          // layout est dynamique — on garde role implicite).
          <div role="listbox" aria-label={t('settings.amenities.iconPicker.title', 'Choisir une icône')} onKeyDown={handleGridKeyDown}>
            <div className="flex flex-col gap-3">
              {filteredGroups.map((group, groupIdx) => {
                // Calcule l'offset de ce groupe dans flatIcons pour matcher
                // l'index global avec la position visuelle.
                const offset = filteredGroups.slice(0, groupIdx).reduce((sum, g) => sum + g.icons.length, 0);
                return (
                  <div key={group.id}>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-[repeat(auto-fill,_minmax(48px,_1fr))] gap-[4.5px]">
                      {group.icons.map((iconName, localIdx) => {
                        const Icon = ICON_REGISTRY[iconName];
                        if (!Icon) return null;
                        const globalIdx = offset + localIdx;
                        const isSelected = iconName === currentIcon;
                        const isFocused = focusedIndex === globalIdx;
                        return (
                          // <button> natif et non le Button du kit : la ref porte
                          // ici le comportement (focus pilote au clavier).
                          <Tooltip key={iconName}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                ref={(el) => { buttonRefs.current[globalIdx] = el; }}
                                role="option"
                                aria-selected={isSelected}
                                tabIndex={isFocused ? 0 : -1}
                                onClick={() => handleSelect(iconName)}
                                onFocus={() => setFocusedIndex(globalIdx)}
                                aria-label={t('settings.amenities.iconPicker.pickIcon', 'Choisir {{name}}', { name: iconName })}
                                className={cn(
                                  'inline-flex items-center justify-center size-11 rounded-md border border-solid cursor-pointer',
                                  'transition-colors duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                                  'hover:border-primary hover:bg-primary-soft hover:text-primary',
                                  'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                                  isSelected
                                    ? 'border-primary bg-primary-soft text-primary'
                                    : 'border-border bg-card text-muted-foreground',
                                )}
                              >
                                <Icon size={18} strokeWidth={1.75} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">{iconName}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-solid border-border pt-[9px] sm:justify-between">
          <div className="flex items-center gap-1.5">
            {isOverridden && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onReset(); onClose(); }}
              >
                <RotateCcw size={13} />
                {t('settings.amenities.iconPicker.resetToDefault', "Revenir à l'icône par défaut")}
              </Button>
            )}
          </div>
          {/* Le choix se fait au clic sur une icone (qui ferme le dialog) : ce
              bouton n'est que le congediement de la modale, d'ou outline. */}
          <Button
            variant="outline"
            onClick={handleClose}
            size="sm"
          >
            {t('common.close', 'Fermer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
