import React from 'react';
import { Box, Typography, Tooltip, useTheme, alpha } from '@mui/material';

/**
 * Carte d'option selectionnable — pattern moderne pour remplacer les chips
 * empiles, plus visuel et tactile.
 *
 * <p>Etats :
 * <ul>
 *   <li><b>Default</b> : border subtle (divider), bgcolor transparent</li>
 *   <li><b>Hover</b> : border primary.light, bgcolor primary 2%</li>
 *   <li><b>Selected</b> : border primary 1.5px, bgcolor primary 6%, indicateur radio
 *       en haut a droite</li>
 * </ul>
 *
 * <p>La card affiche seulement le {@code label} + indicateur radio pour rester
 * compacte. Les details optionnels ({@code description}, {@code hint}) sont
 * exposes via un {@link Tooltip} au hover/focus — UX moderne et discrete qui
 * libere de la place verticale sans sacrifier l'info.</p>
 *
 * <p>Conformite Clenzy / Impeccable : pas de gradient, pas de scale hover,
 * pas de glow shadow. Transitions discretes (150ms). Accessible : role button,
 * aria-pressed, focus-visible ring, Enter/Space keyboard.</p>
 */
export interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  /** Titre principal court (1-3 mots), affiche en permanence sur la card. */
  label: React.ReactNode;
  /** Description secondaire affichee dans le tooltip au hover/focus. */
  description?: React.ReactNode;
  /** Info complementaire (prix, badge…) affichee aussi dans le tooltip. */
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

  const hasTooltipContent = !!(description || hint);
  const tooltipTitle = hasTooltipContent ? (
    <Box sx={{ py: 0.25 }}>
      {description && (
        <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.4, fontSize: '0.75rem' }}>
          {description}
        </Typography>
      )}
      {hint && (
        <Box sx={{ mt: description ? 0.5 : 0 }}>{hint}</Box>
      )}
    </Box>
  ) : null;

  const card = (
    <Box
      role="button"
      aria-pressed={selected}
      aria-label={typeof label === 'string' ? label : undefined}
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
        alignItems: 'center',
        gap: 1,
        py: 1.5,
        pl: 2,
        pr: 5, // place pour l'indicateur radio
        minHeight: 52,
        borderRadius: 1.5,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: '1.5px solid',
        borderColor: selected ? accentColor : 'divider',
        bgcolor: selected ? alpha(accentColor, 0.06) : 'transparent',
        transition: 'border-color 150ms ease, background-color 150ms ease',
        outline: 'none',
        '&:hover': {
          borderColor: selected ? accentColor : alpha(accentColor, 0.5),
          bgcolor: selected ? alpha(accentColor, 0.08) : alpha(accentColor, 0.02),
        },
        '&:focus-visible': {
          borderColor: accentColor,
          boxShadow: `0 0 0 3px ${alpha(accentColor, 0.18)}`,
        },
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          fontSize: '0.875rem',
          lineHeight: 1.3,
          color: 'text.primary',
          flex: 1,
          minWidth: 0,
        }}
      >
        {label}
      </Typography>

      {/* Indicateur radio en haut a droite */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: '50%',
          right: 14,
          transform: 'translateY(-50%)',
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
    </Box>
  );

  if (!hasTooltipContent) return card;

  return (
    <Tooltip
      title={tooltipTitle}
      arrow
      enterDelay={300}
      enterNextDelay={100}
      placement="top"
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: 'grey.900',
            color: 'common.white',
            fontSize: '0.75rem',
            maxWidth: 240,
            px: 1.5,
            py: 1,
            borderRadius: 1,
          },
        },
        arrow: {
          sx: { color: 'grey.900' },
        },
      }}
    >
      {card}
    </Tooltip>
  );
}
