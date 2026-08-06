import { cn } from '../../../utils/cn';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import { Button, Spinner, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { Thermostat, AcUnit, Wifi, WifiOff, Add, Remove, Delete } from '../../../icons';
import type { ThermostatDto } from '../../../services/api/thermostatsApi';

// Modes de consigne → tons sémantiques Baitly UI : chauffer réchauffe (warn),
// climatiser refroidit (info), éco est un état sain (ok), éteint est neutre.
// Passer par les tons donne l'encre `-ink` : les hex bruts d'origine
// plafonnaient à ~2,2:1 sur leur propre fond doux.
const MODE_META: Record<string, { label: string; tone: StatusTone }> = {
  heat: { label: 'Chauffage', tone: 'warn' },
  cool: { label: 'Climatisation', tone: 'info' },
  eco: { label: 'Éco', tone: 'ok' },
  off: { label: 'Éteint', tone: 'neutral' },
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
    <div className={cn('rounded-xl border border-solid border-border bg-card p-[7.5px] flex flex-col gap-1.5 transition-[border-color] duration-200 ease-out-quart motion-reduce:transition-none hover:border-input', online ? 'opacity-100' : 'opacity-62')}>
      {/* En-tête : badge + nom + état réseau + supprimer */}
      <div className="flex items-start gap-1.5">
        {/* Pastille d'icône du type : accent de marque sur son fond doux — le
            jeton `primary-soft` porte déjà la nuance clair/sombre. */}
        <div className="w-[30px] h-[30px] rounded-md shrink-0 flex items-center justify-center bg-primary-soft text-primary">
          <Thermostat size={17} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">{name}</p>
          <span className="text-xs text-muted-foreground">{roomName ? `${roomName} · ` : ''}{brand || 'Thermostat'}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn('inline-flex shrink-0 mt-[1.5px]', online ? 'text-success' : 'text-faint')}>
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
                  className="text-faint hover:text-destructive"
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
        <p className="font-[family-name:var(--font-display)] text-[1.75rem] font-semibold leading-[1] text-foreground tabular-nums">{fmt(currentTempC)}°</p>
        <p className="text-sm text-muted-foreground opacity-60">→</p>
        <p className="font-[family-name:var(--font-display)] text-base font-semibold text-primary tabular-nums">{fmt(targetTempC)}°</p>
      </div>

      {/* Mode + humidité */}
      <div className="flex items-center gap-1 flex-wrap">
        <StatusChip tone={m.tone} label={m.label} icon={mode === 'cool' ? <AcUnit size={12} /> : undefined} className="text-2xs" />
        {humidity != null && (
          <span className="text-xs text-muted-foreground tabular-nums">Humidité {humidity}%</span>
        )}
      </div>

      {/* Contrôles de consigne */}
      <div className="flex items-center gap-0.5 mt-auto pt-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button variant="ghost" size="icon-sm" aria-label="Baisser la consigne" disabled={!canControl} onClick={() => adjust(-0.5)} className="border border-solid border-border">
                <Remove size={15} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Baisser la consigne</TooltipContent>
        </Tooltip>
        <span className="text-xs flex-1 text-center text-muted-foreground font-semibold">
          {acting ? <Spinner className="size-[13px]" /> : (preset || 'Consigne')}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button variant="ghost" size="icon-sm" aria-label="Monter la consigne" disabled={!canControl} onClick={() => adjust(0.5)} className="border border-solid border-border">
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
