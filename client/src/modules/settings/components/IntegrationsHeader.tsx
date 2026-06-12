import React from 'react';
import {
  Autocomplete,
  Box,
  Select,
  MenuItem,
  TextField,
  Typography,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon } from '../../../icons';
import {
  ALL_SERVICES,
  CATEGORIES,
  getDomIdForCategory,
  type ServiceIndexEntry,
} from '../../../services/integrations/allServicesIndex';

/**
 * Header compact (recherche + filtre categorie) destine au slot {@code filters}
 * du PageHeader de la page Parametres. Aucune surface propre (pas de Paper) :
 * juste 2 champs inline qui s'integrent visuellement dans le bandeau de titre.
 *
 * <h2>Tailles</h2>
 * <ul>
 *   <li>Autocomplete : largeur 220-260px responsive, height 34px</li>
 *   <li>Select : largeur 180px, height 34px</li>
 *   <li>Gap 8px entre les 2</li>
 * </ul>
 *
 * <h2>Theme-aware</h2>
 * <p>Borders {@code divider}, focus ACCENT, dropdown {@code background.paper}.</p>
 */

const ACCENT = 'var(--accent)';

interface IntegrationsHeaderProps {
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  /**
   * Service actuellement filtre (affiche dans l'input de l'autocomplete).
   * {@code null} = aucun filtre service actif → l'input affiche son
   * placeholder. Mode controle complet : le parent possede l'etat.
   */
  selectedService?: ServiceIndexEntry | null;
  /**
   * Callback declenche soit avec un service (selection via l'autocomplete),
   * soit avec {@code null} quand l'utilisateur clic sur le bouton X clear
   * de MUI pour reset le filtre.
   */
  onSelectService?: (service: ServiceIndexEntry | null) => void;
}

export default function IntegrationsHeader({
  selectedCategoryId,
  onCategoryChange,
  selectedService = null,
  onSelectService,
}: IntegrationsHeaderProps) {
  // Mode controle : la {@code value} de l'autocomplete vient du parent
  // ({@code selectedService}). Quand un service est filtre, son nom apparait
  // dans l'input — l'utilisateur voit ce qu'il a recherche au lieu d'un
  // placeholder vide. Clic sur X (clearable natif MUI) → onChange(null) →
  // le parent reset le filtre.
  const handleSelectService = (service: ServiceIndexEntry | null) => {
    if (onSelectService) {
      onSelectService(service);
    } else if (service) {
      const domId = getDomIdForCategory(service.categoryId);
      if (domId) {
        document.getElementById(domId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const fieldSx = {
    fontSize: '0.78rem',
    borderRadius: '8px',
    height: 34,
    '& .MuiOutlinedInput-root': { height: 34, fontSize: '0.78rem' },
    '& .MuiOutlinedInput-input': { py: 0 },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline, & .Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: ACCENT,
    },
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Autocomplete
        size="small"
        options={ALL_SERVICES}
        getOptionLabel={(option) => option.name}
        groupBy={(option) => option.categoryLabel}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        value={selectedService}
        onChange={(_, value) => handleSelectService(value)}
        blurOnSelect
        sx={{ width: { xs: 200, sm: 240, md: 260 } }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Rechercher…"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start" sx={{ ml: 0.25, mr: -0.25, color: 'text.secondary' }}>
                    <SearchIcon size={14} strokeWidth={2} />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
              sx: fieldSx,
            }}
          />
        )}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props as React.HTMLAttributes<HTMLLIElement> & { key?: React.Key };
          return (
            <Box component="li" key={key} {...optionProps} sx={{ display: 'flex !important', alignItems: 'center', py: 0.5 }}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 500, color: 'text.primary' }}>
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
                px: 1.25,
                py: 0.375,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.6rem',
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
              boxShadow: 'var(--shadow-pop)',
              mt: 0.5,
              fontSize: '0.78rem',
            },
          },
        }}
      />

      <Select
        size="small"
        value={selectedCategoryId ?? '_all'}
        onChange={(e) => {
          const v = e.target.value;
          onCategoryChange(v === '_all' ? null : v);
        }}
        sx={{
          width: { xs: 160, sm: 180 },
          ...fieldSx,
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              borderRadius: '10px',
              border: '1px solid',
              borderColor: 'divider',
              mt: 0.5,
              maxHeight: 340,
              fontSize: '0.78rem',
            },
          },
        }}
      >
        <MenuItem value="_all" sx={{ fontSize: '0.78rem' }}>
          Toutes les catégories
        </MenuItem>
        {CATEGORIES.map((cat) => (
          <MenuItem key={cat.id} value={cat.id} sx={{ fontSize: '0.78rem' }}>
            {cat.label}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
