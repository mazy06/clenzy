import { Box, Typography, Tooltip, LinearProgress } from '@mui/material';

const LOW = 20;
const CRITICAL = 10;

interface BatteryIndicatorProps {
  /** Niveau 0–100, ou null/undefined si inconnu (rien n'est rendu). */
  level?: number | null;
}

/**
 * Jauge de batterie compacte : MuiLinearProgress thème (piste `--field`, pilule)
 * + pourcentage display `tabular-nums`. La couleur de barre porte le sens
 * (--ok OK, --warn faible, --err critique). Rendu nul si le niveau est inconnu.
 */
export default function BatteryIndicator({ level }: BatteryIndicatorProps) {
  if (level == null) return null;

  const low = level <= LOW;
  const color = level <= CRITICAL ? 'var(--err)' : low ? 'var(--warn)' : 'var(--ok)';

  return (
    <Tooltip title={low ? 'Batterie faible' : 'Batterie'} arrow>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.625 }}>
        <LinearProgress
          variant="determinate"
          value={level}
          aria-label="Niveau de batterie"
          sx={{
            width: 34,
            height: 5,
            flexShrink: 0,
            '& .MuiLinearProgress-bar': { backgroundColor: color },
          }}
        />
        <Typography
          variant="caption"
          sx={{
            color,
            fontWeight: 600,
            lineHeight: 1,
            fontFamily: 'var(--font-display)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {level}%
        </Typography>
      </Box>
    </Tooltip>
  );
}
