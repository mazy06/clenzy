import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Tooltip,
  Stack,
} from '@mui/material';
import { Search, X, RotateCcw } from 'lucide-react';
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

const ACCENT = '#0F766E';
const PRIMARY = '#6B8A9A';
const NEUTRAL = '#8A8378';

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
    return ICON_CATALOG
      .map((g) => ({ ...g, icons: g.icons.filter((name) => name.toLowerCase().includes(q)) }))
      .filter((g) => g.icons.length > 0);
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
      PaperProps={{ sx: { borderRadius: 1.5, boxShadow: '0 8px 32px rgba(15,23,42,0.12)' } }}
    >
      <DialogTitle sx={{ pb: 1, pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {/* Preview de l'icone courante */}
          {CurrentIcon && (
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `${ACCENT}14`,
                color: ACCENT,
                flexShrink: 0,
              }}
            >
              <CurrentIcon size={20} strokeWidth={1.75} />
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.3 }}>
              {t('settings.amenities.iconPicker.title', 'Choisir une icône')}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
              {amenityLabel} ·{' '}
              <Box component="span" sx={{ fontFamily: '"SF Mono", Menlo, Consolas, monospace' }}>
                {amenityCode}
              </Box>
            </Typography>
          </Box>
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
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('settings.amenities.iconPicker.noMatch', 'Aucune icône ne correspond à « {{query}} ».', { query })}
            </Typography>
          </Box>
        ) : (
          // Grid wrapper avec onKeyDown pour la navigation flechee
          // (role=grid + aria-rowcount/colcount serait plus strict mais le
          // layout est dynamique — on garde role implicite).
          <Box
            role="listbox"
            aria-label={t('settings.amenities.iconPicker.title', 'Choisir une icône')}
            onKeyDown={handleGridKeyDown}
          >
            <Stack spacing={2}>
              {filteredGroups.map((group, groupIdx) => {
                // Calcule l'offset de ce groupe dans flatIcons pour matcher
                // l'index global avec la position visuelle.
                const offset = filteredGroups.slice(0, groupIdx).reduce((sum, g) => sum + g.icons.length, 0);
                return (
                  <Box key={group.id}>
                    <Typography
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        mb: 0.75,
                      }}
                    >
                      {group.label}
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
                        gap: 0.75,
                      }}
                    >
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
                                backgroundColor: isSelected ? `${ACCENT}14` : 'background.paper',
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
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isOverridden && (
            <Button
              size="small"
              startIcon={<RotateCcw size={13} />}
              onClick={() => { onReset(); onClose(); }}
              sx={{
                textTransform: 'none',
                fontSize: '0.78rem',
                color: NEUTRAL,
                cursor: 'pointer',
                '&:hover': { color: PRIMARY, backgroundColor: `${PRIMARY}0F` },
              }}
            >
              {t('settings.amenities.iconPicker.resetToDefault', "Revenir à l'icône par défaut")}
            </Button>
          )}
        </Box>
        <Button
          onClick={handleClose}
          size="small"
          sx={{ textTransform: 'none', fontSize: '0.78rem', cursor: 'pointer' }}
        >
          {t('common.close', 'Fermer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
