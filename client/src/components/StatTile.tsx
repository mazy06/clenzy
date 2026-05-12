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
  /** Couleur d'accent (hex). Definit le badge icone + le liseré gauche. */
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
 *  - Liseré gauche colore (3px) reprenant la couleur d'accent
 *  - Badge icone carre arrondi avec bg pastel
 *  - Valeur en 1.25rem bold, qui scale via useTypography responsive
 *  - Label en caption uppercase
 *  - Hover : bordure prend la couleur d'accent + lift de 1px (si onClick)
 *  - Loading : Skeleton à la place de la valeur
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
        borderRadius: 1.5,
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 200ms, transform 200ms, box-shadow 200ms',
        // Liseré gauche
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, bottom: 0,
          width: 3,
          bgcolor: color,
          opacity: 0.7,
        },
        ...(onClick && {
          '&:hover': {
            borderColor: color,
            transform: 'translateY(-1px)',
            boxShadow: `0 1px 3px ${alpha(color, 0.18)}`,
          },
        }),
        ...(!onClick && {
          '&:hover': {
            borderColor: color,
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
          fontWeight: 700,
          color: 'text.secondary',
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
            fontSize: { xs: '0.9375rem', md: '1.0625rem', xl: '1.1875rem' },
            fontWeight: 700,
            lineHeight: 1.1,
            color: 'text.primary',
          }}
        >
          {value}
        </Typography>
      )}

      {hint && !loading && (
        <Typography
          variant="caption"
          sx={{ color: 'text.disabled', display: 'block', mt: 0.25 }}
        >
          {hint}
        </Typography>
      )}
    </Paper>
  );
}
