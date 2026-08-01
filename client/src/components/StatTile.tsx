import React from 'react';
import { Paper, Typography, Skeleton } from '@mui/material';

interface StatTileProps {
  /** Icône inline (accent par défaut, ou la couleur passée) à gauche du label. */
  icon: React.ReactNode;
  /** Libellé court (muted, sentence-case) sur la ligne de l'icône. */
  label: string;
  /** Valeur principale — texte, nombre ou nœud (ex: <Money/> pour afficher le
   *  glyphe de devise au lieu du code). */
  value: React.ReactNode;
  /** Unité affichée en petit + muted après la valeur (ex: "%", ou
   *  <CurrencySymbol/>). */
  unit?: React.ReactNode;
  /** Couleur de l'icône (hex/token). Défaut : accent. */
  color?: string;
  /** Ligne secondaire sous la valeur (delta/contexte). ReactNode → highlight possible
   *  (ex: <><b>+8%</b> vs janvier</> avec b coloré --ok). */
  hint?: React.ReactNode;
  /** Affiche un Skeleton à la place de la valeur. */
  loading?: boolean;
  /** Callback de click. Si fourni, le tile devient cliquable (hover lift). */
  onClick?: () => void;
}

/**
 * Carte KPI standardisée (réf. maquette Signature « .bl-kpi ») :
 *  - ligne 1 : icône inline (accent) + label muted 11.5px fw600
 *  - valeur : Space Grotesk 27px fw600 --ink (tabular-nums) + unité petite muted
 *  - delta  : 11px fw600 --muted, highlight --ok possible via ReactNode
 *  - carte plate r14 hairline, AUCUNE ombre au repos (hover lift si cliquable).
 *
 * Le `<b>` d'un hint ReactNode est coloré --ok par défaut (tendance positive) ;
 * passer un style inline pour une autre couleur.
 */
export default function StatTile({
  icon,
  label,
  value,
  unit,
  color = 'var(--accent)',
  hint,
  loading = false,
  onClick,
}: StatTileProps) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        px: '17px',
        py: '16px',
        borderRadius: '14px',
        bgcolor: 'var(--card)',
        borderColor: 'var(--line)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 200ms, transform 200ms, box-shadow 200ms',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        ...(onClick
          ? {
              '&:hover': {
                borderColor: 'var(--line-2)',
                transform: 'translateY(-1px)',
                boxShadow: 'var(--shadow-card)',
              },
              '&:active': { transform: 'translateY(0)' },
            }
          : { '&:hover': { borderColor: 'var(--line-2)' } }),
      }}
    >
      {/* Ligne 1 : icône inline + label */}
      <div className="flex items-center gap-[7px] min-w-0">
        {/* `color` est calcule a l'execution : passe par style, une classe Tailwind
            ne peut pas naitre d'une variable. */}
        <span className="inline-flex shrink-0" style={{ color }}>
          {React.isValidElement(icon)
            ? React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                size: 15,
                strokeWidth: 1.85,
              })
            : icon}
        </span>
        <span className="text-[11.5px] font-semibold text-[var(--muted)] overflow-hidden text-ellipsis whitespace-nowrap">
          {label}
        </span>
      </div>

      {/* Valeur */}
      {loading ? (
        <Skeleton variant="text" width={90} height={34} sx={{ mt: '11px' }} />
      ) : (
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: { xs: '1.375rem', md: '1.6875rem' },
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            color: 'var(--ink)',
            mt: '11px',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
          {unit && (
            <span className="text-[0.625em] text-[var(--muted)] ms-1 font-semibold">
              {unit}
            </span>
          )}
        </Typography>
      )}

      {/* Delta / contexte */}
      {hint && !loading && (
        <Typography
          component="div"
          sx={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--muted)',
            mt: '5px',
            '& b': { color: 'var(--ok)', fontWeight: 600 },
          }}
        >
          {hint}
        </Typography>
      )}
    </Paper>
  );
}
