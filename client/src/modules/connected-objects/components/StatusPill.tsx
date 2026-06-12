import { Box, Typography } from '@mui/material';
import { STATUS_TOKENS } from '../deviceRegistry';
import type { DeviceStatusLevel } from '../types';

interface StatusPillProps {
  level: DeviceStatusLevel;
  label: string;
  /** `pulse` anime le point pour les états vivants (en ligne). */
  pulse?: boolean;
}

/**
 * Pastille d'état normalisée : point coloré + libellé sur fond `-soft`.
 * Tokens sémantiques Signature : --ok en ligne, --warn attention, --err alerte,
 * neutre --muted/--hover hors ligne — suivent le thème clair/sombre.
 */
export default function StatusPill({ level, label, pulse = false }: StatusPillProps) {
  const { color, soft } = STATUS_TOKENS[level];
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.625,
        px: 0.875,
        py: 0.25,
        borderRadius: 'var(--radius-pill)',
        bgcolor: soft,
        maxWidth: '100%',
      }}
    >
      <Box
        component="span"
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: color,
          flexShrink: 0,
          ...(pulse && level === 'ok' && {
            boxShadow: `0 0 0 0 color-mix(in srgb, ${color} 60%, transparent)`,
            animation: 'clz-pulse-dot 2s infinite',
            '@keyframes clz-pulse-dot': {
              '0%': { boxShadow: `0 0 0 0 color-mix(in srgb, ${color} 50%, transparent)` },
              '70%': { boxShadow: `0 0 0 5px color-mix(in srgb, ${color} 0%, transparent)` },
              '100%': { boxShadow: `0 0 0 0 color-mix(in srgb, ${color} 0%, transparent)` },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }),
        }}
      />
      <Typography
        variant="caption"
        sx={{
          color,
          fontWeight: 600,
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
