import { Typography, Tooltip, IconButton, alpha, useTheme } from '@mui/material';
import { cn } from '../../../utils/cn';
import StatusChip from '../../../components/StatusChip';
import { Spinner } from '../../../components/ui';
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
    <div className={cn('rounded-[var(--radius-lg)] border border-solid border-[var(--line)] bg-[var(--card)] p-[7.5px] flex flex-col gap-1.5 hover:border-[var(--line-2)]', online ? 'opacity-100' : 'opacity-62')} style={{ transition: 'border-color 200ms' }}>
      {/* En-tête : badge + nom + état réseau + supprimer */}
      <div className="flex items-start gap-1.5">
        <div className="w-[30px] h-[30px] rounded-[8px] shrink-0 flex items-center justify-center" style={{ color: ACCENT, backgroundColor: alpha(ACCENT, theme.palette.mode === 'dark' ? 0.2 : 0.12) }}>
          <Thermostat size={17} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="cn-text-body1 font-semibold text-[0.875rem] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">{name}</p>
          <span className="cn-text-caption text-muted-foreground">{roomName ? `${roomName} · ` : ''}{brand || 'Thermostat'}</span>
        </div>
        <Tooltip title={online ? 'En ligne' : 'Hors ligne'} arrow>
          <span className={cn('inline-flex shrink-0 mt-[1.5px]', online ? 'text-[#4A9B8E]' : 'text-[var(--faint)]')}>
            {online ? <Wifi size={14} strokeWidth={1.75} /> : <WifiOff size={14} strokeWidth={1.75} />}
          </span>
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
      </div>

      {/* Températures : mesurée → consigne — chiffres en display (Space Grotesk) */}
      <div className="flex items-baseline gap-1">
        <p className="cn-text-body1 font-[var(--font-display)] text-[1.75rem] font-semibold leading-[1] text-[var(--ink)] tabular-nums">{fmt(currentTempC)}°</p>
        <p className="cn-text-body1 text-[0.95rem] text-muted-foreground opacity-60">→</p>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{fmt(targetTempC)}°</Typography>
      </div>

      {/* Mode + humidité */}
      <div className="flex items-center gap-1 flex-wrap">
        <StatusChip tokens={{ color: m.color, bg: alpha(m.color, 0.14) }} label={m.label} icon={mode === 'cool' ? <AcUnit size={12} /> : undefined} className="text-[0.65rem]" />
        {humidity != null && (
          <span className="cn-text-caption text-muted-foreground tabular-nums">Humidité {humidity}%</span>
        )}
      </div>

      {/* Contrôles de consigne */}
      <div className="flex items-center gap-0.5 mt-auto pt-0.5">
        <Tooltip title="Baisser la consigne" arrow>
          <span><IconButton size="small" disabled={!canControl} onClick={() => adjust(-0.5)} sx={{ border: '1px solid', borderColor: 'divider' }}><Remove size={15} /></IconButton></span>
        </Tooltip>
        <span className="cn-text-caption flex-1 text-center text-muted-foreground font-semibold">
          {acting ? <Spinner className="size-[13px]" /> : (preset || 'Consigne')}
        </span>
        <Tooltip title="Monter la consigne" arrow>
          <span><IconButton size="small" disabled={!canControl} onClick={() => adjust(0.5)} sx={{ border: '1px solid', borderColor: 'divider' }}><Add size={15} /></IconButton></span>
        </Tooltip>
      </div>
    </div>
  );
}
