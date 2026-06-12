import { Box, Typography, Chip, Tooltip, IconButton, CircularProgress, alpha, useTheme } from '@mui/material';
import { Thermostat, AcUnit, Wifi, WifiOff, Add, Remove, Delete } from '../../../icons';
import type { ThermostatDto } from '../../../services/api/thermostatsApi';

const ACCENT = '#6B8A9A'; // primary Baitly (type « thermostat »)

const MODE_META: Record<string, { label: string; color: string }> = {
  heat: { label: 'Chauffage', color: '#D4A574' },
  cool: { label: 'Climatisation', color: '#7BA3C2' },
  eco: { label: 'Éco', color: '#4A9B8E' },
  off: { label: 'Éteint', color: '#9CA3AF' },
};

const fmt = (n: number | null) => (n == null ? '—' : n.toFixed(1).replace('.', ','));

interface ThermostatTileProps {
  thermostat: ThermostatDto;
  /** Définit la consigne (°C). */
  onSetTarget?: (id: number, targetTempC: number) => void;
  onDelete?: (id: number) => void;
  /** Action en cours (spinner + désactivation). */
  acting?: boolean;
}

/**
 * Tuile thermostat — carte de données/contrôle branchee sur les vraies donnees
 * Tuya (currentTempC/targetTempC/humidity/mode). Consigne pilotable (±0.5°C).
 */
export default function ThermostatTile({ thermostat, onSetTarget, onDelete, acting = false }: ThermostatTileProps) {
  const theme = useTheme();
  const { id, name, roomName, brand, online, currentTempC, targetTempC, humidity, mode, preset } = thermostat;
  const m = MODE_META[mode ?? 'off'] ?? MODE_META.off;
  const canControl = online && targetTempC != null && !acting;

  const adjust = (delta: number) => {
    if (targetTempC != null && onSetTarget) {
      onSetTarget(id, Math.round((targetTempC + delta) * 2) / 2);
    }
  };

  return (
    <Box
      sx={{
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', bgcolor: 'var(--card)',
        p: 1.25, display: 'flex', flexDirection: 'column', gap: 1,
        opacity: online ? 1 : 0.62,
        transition: 'border-color 200ms',
        '&:hover': { borderColor: 'var(--line-2)' },
      }}
    >
      {/* En-tête : badge + nom + état réseau + supprimer */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, bgcolor: alpha(ACCENT, theme.palette.mode === 'dark' ? 0.2 : 0.12) }}>
          <Thermostat size={17} strokeWidth={1.75} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{roomName ? `${roomName} · ` : ''}{brand || 'Thermostat'}</Typography>
        </Box>
        <Tooltip title={online ? 'En ligne' : 'Hors ligne'} arrow>
          <Box component="span" sx={{ color: online ? 'success.main' : 'text.disabled', display: 'inline-flex', flexShrink: 0, mt: 0.25 }}>
            {online ? <Wifi size={14} strokeWidth={1.75} /> : <WifiOff size={14} strokeWidth={1.75} />}
          </Box>
        </Tooltip>
        {onDelete && (
          <Tooltip title="Supprimer" arrow>
            <span>
              <IconButton size="small" disabled={acting} onClick={() => onDelete(id)} sx={{ color: 'text.disabled', p: 0.25, '&:hover': { color: 'var(--err)' } }}>
                <Delete size={14} strokeWidth={1.75} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>

      {/* Températures : mesurée → consigne — chiffres en display (Space Grotesk) */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 600, lineHeight: 1, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmt(currentTempC)}°</Typography>
        <Typography sx={{ fontSize: '0.95rem', color: 'text.disabled' }}>→</Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{fmt(targetTempC)}°</Typography>
      </Box>

      {/* Mode + humidité */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        <Chip
          size="small"
          icon={mode === 'cool' ? <AcUnit size={12} /> : undefined}
          label={m.label}
          sx={{ height: 22, bgcolor: alpha(m.color, 0.14), color: m.color, fontWeight: 700, fontSize: '0.65rem', '& .MuiChip-icon': { color: m.color } }}
        />
        {humidity != null && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>Humidité {humidity}%</Typography>
        )}
      </Box>

      {/* Contrôles de consigne */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto', pt: 0.25 }}>
        <Tooltip title="Baisser la consigne" arrow>
          <span><IconButton size="small" disabled={!canControl} onClick={() => adjust(-0.5)} sx={{ border: '1px solid', borderColor: 'divider' }}><Remove size={15} /></IconButton></span>
        </Tooltip>
        <Typography variant="caption" sx={{ flex: 1, textAlign: 'center', color: 'text.secondary', fontWeight: 600 }}>
          {acting ? <CircularProgress size={13} /> : (preset || 'Consigne')}
        </Typography>
        <Tooltip title="Monter la consigne" arrow>
          <span><IconButton size="small" disabled={!canControl} onClick={() => adjust(0.5)} sx={{ border: '1px solid', borderColor: 'divider' }}><Add size={15} /></IconButton></span>
        </Tooltip>
      </Box>
    </Box>
  );
}
