import React, { useMemo, useState } from 'react';
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
 * - Bouton "Reinitialiser" si override actif (revient au defaut Clenzy)
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
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo<IconGroup[]>(() => {
    if (!query.trim()) return ICON_CATALOG;
    const q = query.toLowerCase();
    return ICON_CATALOG
      .map((g) => ({ ...g, icons: g.icons.filter((name) => name.toLowerCase().includes(q)) }))
      .filter((g) => g.icons.length > 0);
  }, [query]);

  const handleSelect = (iconName: string) => {
    onSelect(iconName);
    onClose();
    setQuery('');
  };

  const handleClose = () => {
    onClose();
    setQuery('');
  };

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
              Choisir une icône
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
          aria-label="Fermer"
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
          placeholder="Rechercher une icône (ex: wifi, flame, lock)…"
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
                <IconButton size="small" onClick={() => setQuery('')} aria-label="Effacer la recherche" sx={{ cursor: 'pointer' }}>
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
              Aucune icône ne correspond à « {query} ».
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {filteredGroups.map((group) => (
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
                  {group.icons.map((iconName) => {
                    const Icon = ICON_REGISTRY[iconName];
                    if (!Icon) return null;
                    const isSelected = iconName === currentIcon;
                    return (
                      <Tooltip key={iconName} title={iconName} arrow placement="top">
                        <IconButton
                          onClick={() => handleSelect(iconName)}
                          aria-label={`Choisir ${iconName}`}
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
                          }}
                        >
                          <Icon size={18} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Stack>
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
              Revenir à l'icône par défaut
            </Button>
          )}
        </Box>
        <Button
          onClick={handleClose}
          size="small"
          sx={{ textTransform: 'none', fontSize: '0.78rem', cursor: 'pointer' }}
        >
          Fermer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
