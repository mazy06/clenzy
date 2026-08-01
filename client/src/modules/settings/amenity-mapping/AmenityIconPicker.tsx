import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputAdornment, IconButton, Tooltip, Stack } from '@mui/material';
import { Search, X, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui';
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

const ACCENT = 'var(--accent)';
const PRIMARY = 'var(--accent)';
const NEUTRAL = 'var(--muted)';

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
  // que MUI Dialog ne ferme pas sur Esc avant qu'on l'ait gere.
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
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { boxShadow: 'var(--shadow-pop)' } }}
    >
      <DialogTitle sx={{ pb: 1, pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {/* Preview de l'icone courante */}
          {CurrentIcon && (
            <div className="w-[36px] h-[36px] rounded-[8px] inline-flex items-center justify-center bg-[var(--accent-soft)] shrink-0" style={{ color: ACCENT }}>
              <CurrentIcon size={20} strokeWidth={1.75} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="cn-text-body1 text-[0.95rem] font-semibold leading-[1.3]">
              {t('settings.amenities.iconPicker.title', 'Choisir une icône')}
            </p>
            <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
              {amenityLabel} ·{' '}
              <span style={{ fontFamily: '"SF Mono", Menlo, Consolas, monospace' }}>
                {amenityCode}
              </span>
            </span>
          </div>
        </Stack>
        <IconButton
          onClick={handleClose}
          aria-label={t('common.close', 'Fermer')}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            cursor: 'pointer',
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 2 }}>
        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder={t('settings.amenities.iconPicker.searchPlaceholder', 'Rechercher une icône (ex: wifi, flame, lock)…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} color={NEUTRAL} />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setQuery('')} aria-label={t('settings.amenities.iconPicker.clearSearch', 'Effacer la recherche')} sx={{ cursor: 'pointer' }}>
                  <X size={14} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: PRIMARY },
          }}
        />

        {/* Grouped icon grid */}
        {filteredGroups.length === 0 ? (
          <div className="py-6 text-center">
            <p className="cn-text-body2 text-muted-foreground">
              {t('settings.amenities.iconPicker.noMatch', 'Aucune icône ne correspond à « {{query}} ».', { query })}
            </p>
          </div>
        ) : (
          // Grid wrapper avec onKeyDown pour la navigation flechee
          // (role=grid + aria-rowcount/colcount serait plus strict mais le
          // layout est dynamique — on garde role implicite).
          <div role="listbox" aria-label={t('settings.amenities.iconPicker.title', 'Choisir une icône')} onKeyDown={handleGridKeyDown}>
            <Stack spacing={2}>
              {filteredGroups.map((group, groupIdx) => {
                // Calcule l'offset de ce groupe dans flatIcons pour matcher
                // l'index global avec la position visuelle.
                const offset = filteredGroups.slice(0, groupIdx).reduce((sum, g) => sum + g.icons.length, 0);
                return (
                  <div key={group.id}>
                    <p className="cn-text-body1 text-[0.7rem] font-semibold text-muted-foreground uppercase tracking-[0.04em] mb-1">
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
                          <Tooltip key={iconName} title={iconName} arrow placement="top">
                            <IconButton
                              ref={(el) => { buttonRefs.current[globalIdx] = el; }}
                              role="option"
                              aria-selected={isSelected}
                              tabIndex={isFocused ? 0 : -1}
                              onClick={() => handleSelect(iconName)}
                              onFocus={() => setFocusedIndex(globalIdx)}
                              aria-label={t('settings.amenities.iconPicker.pickIcon', 'Choisir {{name}}', { name: iconName })}
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: isSelected ? ACCENT : 'divider',
                                backgroundColor: isSelected ? 'var(--accent-soft)' : 'background.paper',
                                color: isSelected ? ACCENT : 'text.secondary',
                                cursor: 'pointer',
                                transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                                '&:hover': {
                                  borderColor: ACCENT,
                                  backgroundColor: `${ACCENT}0A`,
                                  color: ACCENT,
                                },
                                '&:focus-visible': {
                                  borderColor: ACCENT,
                                  boxShadow: `0 0 0 3px ${ACCENT}33`,
                                  outline: 'none',
                                },
                              }}
                            >
                              <Icon size={18} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </Stack>
          </div>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between' }}>
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
      </DialogActions>
    </Dialog>
  );
}
