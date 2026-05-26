import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';

/**
 * Carte d'option selectionnable — pattern moderne pour remplacer les chips
 * empiles, plus visuel et tactile.
 *
 * <p>Etats :
 * <ul>
 *   <li><b>Default</b> : border subtle (divider), bgcolor transparent</li>
 *   <li><b>Hover</b> : border primary.light, bgcolor primary 2%</li>
 *   <li><b>Selected</b> : border primary 2px, bgcolor primary 6%, label bold,
 *       petit indicateur radio en haut a droite</li>
 * </ul>
 *
 * <p>Conformite Clenzy / Impeccable : pas de gradient, pas de scale hover,
 * pas de glow shadow. Transitions discretes (150ms). Tout est cliquable
 * (cursor pointer) avec aria-pressed pour l'accessibilite.</p>
 */
export interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  /** Titre principal court (1-3 mots). */
  label: React.ReactNode;
  /** Description secondaire courte (1 ligne). */
  description?: React.ReactNode;
  /** Slot bas optionnel : prix, badge, etc. */
  hint?: React.ReactNode;
  /** Couleur d'accent custom (defaut primary.main). */
  accent?: string;
  disabled?: boolean;
}

export default function OptionCard({
  selected,
  onClick,
  label,
  description,
  hint,
  accent,
  disabled = false,
}: OptionCardProps) {
  const theme = useTheme();
  const accentColor = accent ?? theme.palette.primary.main;

  return (
    <Box
      role="button"
      aria-pressed={selected}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onClick()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        p: 2,
        borderRadius: 1.5,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: '1.5px solid',
        borderColor: selected ? accentColor : 'divider',
        bgcolor: selected
          ? alpha(accentColor, 0.06)
          : 'transparent',
        transition: 'border-color 150ms ease, background-color 150ms ease',
        outline: 'none',
        '&:hover': {
          borderColor: selected ? accentColor : alpha(accentColor, 0.5),
          bgcolor: selected
            ? alpha(accentColor, 0.08)
            : alpha(accentColor, 0.02),
        },
        '&:focus-visible': {
          borderColor: accentColor,
          boxShadow: `0 0 0 3px ${alpha(accentColor, 0.18)}`,
        },
      }}
    >
      {/* Indicateur radio en haut a droite */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: '1.5px solid',
          borderColor: selected ? accentColor : 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 150ms ease',
        }}
      >
        {selected && (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: accentColor,
            }}
          />
        )}
      </Box>

      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          fontSize: '0.875rem',
          lineHeight: 1.3,
          color: 'text.primary',
          pr: 3, // laisse place pour l'indicateur radio
        }}
      >
        {label}
      </Typography>
      {description && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.75rem',
            lineHeight: 1.4,
            display: 'block',
          }}
        >
          {description}
        </Typography>
      )}
      {hint && (
        <Box sx={{ mt: 0.5 }}>
          {hint}
        </Box>
      )}
    </Box>
  );
}
