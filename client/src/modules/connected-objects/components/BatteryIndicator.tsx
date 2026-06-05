import { Box, Typography, Tooltip } from '@mui/material';
import { BatteryFull, Battery20, BatteryAlert } from '../../../icons';

const LOW = 20;
const CRITICAL = 10;

interface BatteryIndicatorProps {
  /** Niveau 0–100, ou null/undefined si inconnu (rien n'est rendu). */
  level?: number | null;
}

/**
 * Indicateur de batterie compact : icône selon le seuil + pourcentage en
 * `tabular-nums`. La couleur porte le sens (vert OK, ambre faible, rouge
 * critique). Rendu nul si le niveau est inconnu (pas encore synchronisé).
 * Icônes lucide uniquement, pas d'emoji (cf. bans design).
 */
export default function BatteryIndicator({ level }: BatteryIndicatorProps) {
  if (level == null) return null;

  const low = level <= LOW;
  const color = level <= CRITICAL ? 'error.main' : low ? 'warning.main' : 'success.main';
  const Icon = low ? BatteryAlert : level <= 60 ? Battery20 : BatteryFull;

  return (
    <Tooltip title={low ? 'Batterie faible' : 'Batterie'} arrow>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.375, color }}>
        <Icon size={14} strokeWidth={1.75} />
        <Typography
          variant="caption"
          sx={{ color, fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
        >
          {level}%
        </Typography>
      </Box>
    </Tooltip>
  );
}
