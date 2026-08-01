import type { CSSProperties } from 'react';
import { Progress, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';

const LOW = 20;
const CRITICAL = 10;

interface BatteryIndicatorProps {
  /** Niveau 0–100, ou null/undefined si inconnu (rien n'est rendu). */
  level?: number | null;
}

/**
 * Jauge de batterie compacte : Progress du kit (piste `--field`, pilule)
 * + pourcentage display `tabular-nums`. La couleur de barre porte le sens
 * (--ok OK, --warn faible, --err critique). Rendu nul si le niveau est inconnu.
 */
export default function BatteryIndicator({ level }: BatteryIndicatorProps) {
  if (level == null) return null;

  const low = level <= LOW;
  const color = level <= CRITICAL ? 'var(--err)' : low ? 'var(--warn)' : 'var(--ok)';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1">
          {/* La teinte de barre depend du niveau (execution) : elle passe par une
              custom property, la classe qui la consomme reste statique. */}
          <Progress
            value={level}
            aria-label="Niveau de batterie"
            className="w-[34px] h-[5px] shrink-0 [&_[data-slot=progress-indicator]]:bg-(--battery-bar)"
            style={{ '--battery-bar': color } as CSSProperties}
          />
          {/* Couleur derivee du niveau a l'execution : style inline obligatoire */}
          <span
            className="cn-text-caption font-[family-name:var(--font-display)] font-semibold leading-none tabular-nums"
            style={{ color }}
          >
            {level}%
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{low ? 'Batterie faible' : 'Batterie'}</TooltipContent>
    </Tooltip>
  );
}
