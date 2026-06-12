import React from 'react';
import { Paper, Box, Typography, Skeleton, alpha, useTheme } from '@mui/material';
import { useIconSize } from '../hooks/useResponsiveSize';

interface StatTileProps {
  /** Icone de role (rendue dans un badge coloré en haut à gauche). */
  icon: React.ReactNode;
  /** Libelle court, affiche en uppercase au-dessus de la valeur. */
  label: string;
  /** Valeur principale — string ou number, affichee en gros. */
  value: string | number;
  /** Couleur d'accent (hex). Pilote le badge icone + le ton de hover. */
  color: string;
  /** Hint secondaire en dessous de la valeur (e.g. "60% du total"). */
  hint?: string;
  /** Affiche un Skeleton à la place de la valeur. */
  loading?: boolean;
  /** Callback de click. Si fourni, le tile devient cliquable (cursor pointer + hover lift). */
  onClick?: () => void;
}

/**
 * Tuile de KPI standardisee pour les dashboards et les vues d'overview.
 *
 * Caracteristiques :
 *  - Badge icone carre colore (l'accent vit dans l'icone, pas dans un liseré)
 *  - Valeur en font display (Space Grotesk) tabular-nums pour comparaison verticale
 *  - Label en overline 10.5px var(--faint)
 *  - Hover : bordure var(--line-2) + lift de 1px (si onClick), carte plate au repos
 *  - Loading : Skeleton à la place de la valeur
 *
 * Decision de design : pas de side-stripe coloré (anti-pattern Impeccable
 * "Side-stripe borders >1px never intentional"). L'accent passe par le badge
 * d'icône et le hover de la bordure.
 *
 * Usage :
 *   <StatTile
 *     icon={<People size={16} strokeWidth={1.75} />}
 *     label="Voyageurs"
 *     value={42}
 *     color="#8b5cf6"
 *     hint="+12% vs mois dernier"
 *     onClick={() => navigate('/guests')}
 *   />
 */
export default function StatTile({
  icon,
  label,
  value,
  color,
  hint,
  loading = false,
  onClick,
}: StatTileProps) {
  const theme = useTheme();
  const iconSize = useIconSize('row');

  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 1.25,
        borderRadius: 'var(--radius-lg)',
        bgcolor: 'var(--card)',
        borderColor: 'var(--line)',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 200ms, transform 200ms, box-shadow 200ms',
        ...(onClick && {
          '&:hover': {
            borderColor: 'var(--line-2)',
            transform: 'translateY(-1px)',
            boxShadow: 'var(--shadow-card)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        }),
        ...(!onClick && {
          '&:hover': {
            borderColor: 'var(--line-2)',
          },
        }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
        <Box
          sx={{
            width: 26, height: 26, borderRadius: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color,
            bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.2 : 0.12),
            flexShrink: 0,
          }}
        >
          {React.isValidElement(icon)
            ? React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                size: iconSize,
                strokeWidth: 1.75,
              })
            : icon}
        </Box>
      </Box>

      <Typography
        variant="caption"
        sx={{
          fontSize: '10.5px',
          fontWeight: 700,
          color: 'var(--faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'block',
          mb: 0.25,
        }}
      >
        {label}
      </Typography>

      {loading ? (
        <Skeleton variant="text" width={60} height={22} />
      ) : (
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: { xs: '0.9375rem', md: '1.0625rem', xl: '1.1875rem' },
            fontWeight: 600,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            color: 'var(--ink)',
          }}
        >
          {value}
        </Typography>
      )}

      {hint && !loading && (
        <Typography
          variant="caption"
          sx={{ color: 'var(--muted)', display: 'block', mt: 0.25 }}
        >
          {hint}
        </Typography>
      )}
    </Paper>
  );
}
