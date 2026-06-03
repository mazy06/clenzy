import { Box, Typography, alpha } from '@mui/material';
import { STATUS_COLORS } from '../deviceRegistry';
import type { DeviceStatusLevel } from '../types';

interface StatusPillProps {
  level: DeviceStatusLevel;
  label: string;
  /** `pulse` anime le point pour les états vivants (en ligne). */
  pulse?: boolean;
}

/**
 * Pastille d'état normalisée : point coloré + libellé. La couleur (et elle seule)
 * porte le sens : vert=ok, ambre=attention, rouge=alerte, gris=hors ligne.
 */
export default function StatusPill({ level, label, pulse = false }: StatusPillProps) {
  const color = STATUS_COLORS[level];
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.625,
        px: 0.875,
        py: 0.25,
        borderRadius: 5,
        bgcolor: alpha(color, 0.12),
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
            boxShadow: `0 0 0 0 ${alpha(color, 0.6)}`,
            animation: 'clz-pulse-dot 2s infinite',
            '@keyframes clz-pulse-dot': {
              '0%': { boxShadow: `0 0 0 0 ${alpha(color, 0.5)}` },
              '70%': { boxShadow: `0 0 0 5px ${alpha(color, 0)}` },
              '100%': { boxShadow: `0 0 0 0 ${alpha(color, 0)}` },
            },
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
