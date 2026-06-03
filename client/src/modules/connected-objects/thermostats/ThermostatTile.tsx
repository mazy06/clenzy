import { Box, Typography, Chip, Tooltip, IconButton, alpha, useTheme } from '@mui/material';
import { Thermostat, AcUnit, Wifi, WifiOff, Add, Remove, ChevronRight } from '../../../icons';
import type { MockThermostat, ThermostatMode } from './mockThermostats';

const ACCENT = '#6B8A9A'; // primary Baitly (type « thermostat »)

const MODE_META: Record<ThermostatMode, { label: string; color: string }> = {
  heat: { label: 'Chauffage', color: '#D4A574' }, // doré
  cool: { label: 'Climatisation', color: '#7BA3C2' }, // bleu
  eco: { label: 'Éco', color: '#4A9B8E' }, // vert
  off: { label: 'Éteint', color: '#9CA3AF' }, // gris
};

const fmt = (n: number) => n.toFixed(1).replace('.', ',');

/**
 * Tuile thermostat — carte de données/contrôle (pas de feed). Affiche température
 * mesurée → consigne, mode, humidité, et des contrôles désactivés (Phase 2).
 * Palette Baitly (thermostat = primary), valeurs en tabular-nums.
 */
export default function ThermostatTile({ thermostat }: { thermostat: MockThermostat }) {
  const theme = useTheme();
  const { name, roomName, brand, online, currentTemp, targetTemp, humidity, mode, preset } = thermostat;
  const m = MODE_META[mode];

  return (
    <Box
      sx={{
        borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
        p: 1.25, display: 'flex', flexDirection: 'column', gap: 1,
        opacity: online ? 1 : 0.62,
        transition: 'border-color 200ms',
        '&:hover': { borderColor: alpha(ACCENT, 0.5) },
      }}
    >
      {/* En-tête : badge + nom + état réseau */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, bgcolor: alpha(ACCENT, theme.palette.mode === 'dark' ? 0.2 : 0.12) }}>
          <Thermostat size={17} strokeWidth={1.75} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{roomName} · {brand}</Typography>
        </Box>
        <Tooltip title={online ? 'En ligne' : 'Hors ligne'} arrow>
          <Box component="span" sx={{ color: online ? 'success.main' : 'text.disabled', display: 'inline-flex', flexShrink: 0, mt: 0.25 }}>
            {online ? <Wifi size={14} strokeWidth={1.75} /> : <WifiOff size={14} strokeWidth={1.75} />}
          </Box>
        </Tooltip>
      </Box>

      {/* Températures : mesurée → consigne */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
        <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{fmt(currentTemp)}°</Typography>
        <Box component="span" sx={{ color: 'text.disabled', display: 'inline-flex', alignSelf: 'center' }}><ChevronRight size={16} strokeWidth={2} /></Box>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 600, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{fmt(targetTemp)}°</Typography>
      </Box>

      {/* Mode + humidité */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        <Chip
          size="small"
          icon={mode === 'cool' ? <AcUnit size={12} /> : undefined}
          label={m.label}
          sx={{ height: 22, bgcolor: alpha(m.color, 0.14), color: m.color, fontWeight: 700, fontSize: '0.65rem', '& .MuiChip-icon': { color: m.color } }}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>Humidité {humidity}%</Typography>
      </Box>

      {/* Contrôles de consigne (à venir) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto', pt: 0.25 }}>
        <Tooltip title="Baisser la consigne (Phase 2)" arrow>
          <span><IconButton size="small" disabled sx={{ border: '1px solid', borderColor: 'divider' }}><Remove size={15} /></IconButton></span>
        </Tooltip>
        <Typography variant="caption" sx={{ flex: 1, textAlign: 'center', color: 'text.secondary', fontWeight: 600 }}>{preset}</Typography>
        <Tooltip title="Monter la consigne (Phase 2)" arrow>
          <span><IconButton size="small" disabled sx={{ border: '1px solid', borderColor: 'divider' }}><Add size={15} /></IconButton></span>
        </Tooltip>
      </Box>
    </Box>
  );
}
