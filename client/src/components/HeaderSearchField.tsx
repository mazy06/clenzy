import React, { useState } from 'react';
import { Box, IconButton, Dialog, TextField, InputAdornment, Tooltip, Typography } from '@mui/material';
import { Search, Close as CloseIcon } from '../icons';
import { useTranslation } from '../hooks/useTranslation';

/**
 * Recherche « repliée » (demande produit) : une simple LOUPE qui, au clic, ouvre
 * une modale d'input centrée EN HAUT de l'écran (style command-palette). Un point
 * d'accent sur la loupe signale qu'une recherche est active même repliée.
 *
 * La modale réutilise le skin global `.s-modal` (signatureTheme) ; on surcharge
 * juste l'alignement vertical pour la coller en haut.
 */
interface HeaderSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function HeaderSearchField({ value, onChange, placeholder }: HeaderSearchFieldProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ph = placeholder ?? t('common.search', 'Rechercher…');
  const active = value.trim().length > 0;

  return (
    <>
      <Tooltip title={ph} arrow>
        <IconButton
          aria-label={ph}
          onClick={() => setOpen(true)}
          sx={{ flexShrink: 0, position: 'relative', color: active ? 'var(--accent)' : undefined }}
        >
          <Search size={18} strokeWidth={2} />
          {active && (
            <Box
              component="span"
              sx={{
                position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: '50%',
                bgcolor: 'var(--accent)', border: '1.5px solid var(--card)',
              }}
            />
          )}
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        sx={{
          '& .MuiDialog-container': { alignItems: 'flex-start' },
          '& .MuiDialog-paper': { mt: '11vh', mx: 'auto', width: 'min(560px, 92vw)' },
        }}
      >
        <Box sx={{ p: 2 }}>
          <TextField
            autoFocus
            fullWidth
            placeholder={ph}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Enter') setOpen(false);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} strokeWidth={1.75} style={{ color: 'var(--faint)' }} />
                </InputAdornment>
              ),
              endAdornment: active ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label={t('common.clear', 'Effacer')} onClick={() => onChange('')}>
                    <CloseIcon size={16} strokeWidth={2} />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
              sx: { fontSize: '15px', height: 48 },
            }}
          />
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 1, color: 'var(--faint)', fontSize: '11px' }}
          >
            {t('common.searchHint', 'Entrée ou Échap pour fermer')}
          </Typography>
        </Box>
      </Dialog>
    </>
  );
}
