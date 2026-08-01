import { cn } from '../../../utils/cn';
import StatusChip from '../../../components/StatusChip';
import { Button, Spinner, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
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
        {/* Le fond doux etait un alpha() dependant du mode : deux valeurs
            litterales, sinon Tailwind n'emettrait pas la classe. */}
        <div
          className="w-[30px] h-[30px] rounded-[8px] shrink-0 flex items-center justify-center bg-[color-mix(in_srgb,#6B8A9A_12%,transparent)] dark:bg-[color-mix(in_srgb,#6B8A9A_20%,transparent)]"
          style={{ color: ACCENT }}
        >
          <Thermostat size={17} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="cn-text-body1 font-semibold text-[0.875rem] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">{name}</p>
          <span className="cn-text-caption text-muted-foreground">{roomName ? `${roomName} · ` : ''}{brand || 'Thermostat'}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn('inline-flex shrink-0 mt-[1.5px]', online ? 'text-[#4A9B8E]' : 'text-[var(--faint)]')}>
              {online ? <Wifi size={14} strokeWidth={1.75} /> : <WifiOff size={14} strokeWidth={1.75} />}
            </span>
          </TooltipTrigger>
          <TooltipContent>{online ? 'En ligne' : 'Hors ligne'}</TooltipContent>
        </Tooltip>
        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* span : TooltipTrigger asChild pose une ref DOM que le Button du
                  kit (fonction, React 18) ne transmet pas. */}
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Supprimer le thermostat"
                  disabled={acting}
                  onClick={() => onDelete(id)}
                  className="text-[var(--faint)] hover:text-[var(--err)]"
                >
                  <Delete size={14} strokeWidth={1.75} />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Supprimer</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Températures : mesurée → consigne — chiffres en display (Space Grotesk) */}
      <div className="flex items-baseline gap-1">
        <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[1.75rem] font-semibold leading-[1] text-[var(--ink)] tabular-nums">{fmt(currentTempC)}°</p>
        <p className="cn-text-body1 text-[0.95rem] text-muted-foreground opacity-60">→</p>
        <p className="cn-text-body1 text-[1.05rem] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-display)', color: ACCENT }}>{fmt(targetTempC)}°</p>
      </div>

      {/* Mode + humidité */}
      <div className="flex items-center gap-1 flex-wrap">
        <StatusChip tokens={{ color: m.color, bg: `color-mix(in srgb, ${m.color} 14%, transparent)` }} label={m.label} icon={mode === 'cool' ? <AcUnit size={12} /> : undefined} className="text-[0.65rem]" />
        {humidity != null && (
          <span className="cn-text-caption text-muted-foreground tabular-nums">Humidité {humidity}%</span>
        )}
      </div>

      {/* Contrôles de consigne */}
      <div className="flex items-center gap-0.5 mt-auto pt-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button variant="ghost" size="icon-sm" aria-label="Baisser la consigne" disabled={!canControl} onClick={() => adjust(-0.5)} className="border border-solid border-[var(--line)]">
                <Remove size={15} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Baisser la consigne</TooltipContent>
        </Tooltip>
        <span className="cn-text-caption flex-1 text-center text-muted-foreground font-semibold">
          {acting ? <Spinner className="size-[13px]" /> : (preset || 'Consigne')}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button variant="ghost" size="icon-sm" aria-label="Monter la consigne" disabled={!canControl} onClick={() => adjust(0.5)} className="border border-solid border-[var(--line)]">
                <Add size={15} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Monter la consigne</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
