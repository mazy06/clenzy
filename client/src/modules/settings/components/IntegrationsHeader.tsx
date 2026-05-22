import React from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  Paper,
  Select,
  MenuItem,
  TextField,
  Typography,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon, Filter as FilterIcon } from '../../../icons';
import {
  ALL_SERVICES,
  CATEGORIES,
  getDomIdForCategory,
  type ServiceIndexEntry,
} from '../../../services/integrations/allServicesIndex';

/**
 * Header de la tab Integrations : recherche autocomplete + filtre par categorie.
 *
 * <h2>UX</h2>
 * <ul>
 *   <li>Autocomplete : tape pour rechercher parmi les ~50 services. Selectionner
 *       une suggestion declenche {@code onSelectService} qui scroll vers la
 *       section concernee.</li>
 *   <li>Select : filtre par categorie. "Toutes" = aucun filtre. Selection =
 *       n'affiche que cette section + ses sous-cards.</li>
 * </ul>
 *
 * <h2>Layout</h2>
 * <p>Sticky en haut de la tab pour rester accessible quand on scroll.
 * Theme-aware (background.paper, divider, etc.).</p>
 */

const ACCENT = '#4A9B8E';

interface IntegrationsHeaderProps {
  /** ID de la categorie actuellement filtree, ou null pour "Toutes". */
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  /** Callback quand l'utilisateur selectionne un service dans l'autocomplete. */
  onSelectService?: (service: ServiceIndexEntry) => void;
}

export default function IntegrationsHeader({
  selectedCategoryId,
  onCategoryChange,
  onSelectService,
}: IntegrationsHeaderProps) {
  const handleSelectService = (service: ServiceIndexEntry | null) => {
    if (!service) return;
    if (onSelectService) {
      onSelectService(service);
    } else {
      // Fallback : scroll direct vers la section
      const domId = getDomIdForCategory(service.categoryId);
      if (domId) {
        document.getElementById(domId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        borderRadius: '12px',
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        boxShadow: 'none',
        mb: 2,
        px: 2,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
      }}
    >
      {/* Recherche autocomplete */}
      <Autocomplete
        size="small"
        options={ALL_SERVICES}
        getOptionLabel={(option) => option.name}
        groupBy={(option) => option.categoryLabel}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_, value) => handleSelectService(value)}
        clearOnBlur
        blurOnSelect
        sx={{
          flex: 1,
          minWidth: 240,
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Rechercher un service…"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start" sx={{ ml: 0.5, color: 'text.secondary' }}>
                    <SearchIcon size={16} strokeWidth={2} />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
              sx: {
                fontSize: '0.82rem',
                borderRadius: '8px',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: `${ACCENT}66` },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
              },
            }}
          />
        )}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props as React.HTMLAttributes<HTMLLIElement> & { key?: React.Key };
          return (
            <Box component="li" key={key} {...optionProps} sx={{ display: 'flex !important', alignItems: 'center', gap: 1, py: 0.625 }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 500, color: 'text.primary' }}>
                {option.name}
              </Typography>
            </Box>
          );
        }}
        renderGroup={(params) => (
          <li key={params.key}>
            <Box
              sx={{
                position: 'sticky',
                top: 0,
                backgroundColor: 'background.paper',
                px: 1.5,
                py: 0.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                }}
              >
                {params.group}
              </Typography>
            </Box>
            <Box component="ul" sx={{ p: 0, m: 0 }}>{params.children}</Box>
          </li>
        )}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '10px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 8px 24px rgba(0,0,0,0.5)'
                  : '0 8px 24px rgba(15,23,42,0.12)',
              mt: 0.5,
            },
          },
        }}
      />

      {/* Filtre categorie */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 220 }}>
        <FilterIcon size={14} strokeWidth={2} color="currentColor" style={{ opacity: 0.6 }} />
        <Select
          size="small"
          value={selectedCategoryId ?? '_all'}
          onChange={(e) => {
            const v = e.target.value;
            onCategoryChange(v === '_all' ? null : v);
          }}
          displayEmpty
          renderValue={(value) => {
            if (value === '_all' || !value) {
              return (
                <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                  Toutes les catégories
                </Typography>
              );
            }
            const cat = CATEGORIES.find((c) => c.id === value);
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Chip
                  label={cat?.label ?? value}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    bgcolor: `${ACCENT}14`,
                    color: ACCENT,
                    border: `1px solid ${ACCENT}33`,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </Box>
            );
          }}
          sx={{
            flex: 1,
            fontSize: '0.82rem',
            borderRadius: '8px',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: `${ACCENT}66` },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                borderRadius: '10px',
                border: '1px solid',
                borderColor: 'divider',
                mt: 0.5,
                maxHeight: 380,
              },
            },
          }}
        >
          <MenuItem value="_all" sx={{ fontSize: '0.82rem' }}>
            Toutes les catégories
          </MenuItem>
          {CATEGORIES.map((cat) => (
            <MenuItem key={cat.id} value={cat.id} sx={{ fontSize: '0.82rem' }}>
              {cat.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Paper>
  );
}
