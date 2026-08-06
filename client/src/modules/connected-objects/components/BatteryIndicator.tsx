import type { CSSProperties } from 'react';
import { Progress, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';

const LOW = 20;
const CRITICAL = 10;

interface BatteryIndicatorProps {
  /** Niveau 0–100, ou null/undefined si inconnu (rien n'est rendu). */
  level?: number | null;
}

/**
 * Jauge de batterie compacte : Progress du kit (piste de champ, pilule)
 * + pourcentage display `tabular-nums`. La couleur porte le sens (succès OK,
 * avertissement faible, destructif critique). Rendu nul si le niveau est inconnu.
 *
 * <p>Deux jetons pour un même sens : la BARRE prend la teinte vive (un aplat
 * n'est pas soumis au contraste de texte), le POURCENTAGE l'encre `-ink`, seule
 * conforme AA sur une carte claire.</p>
 */
export default function BatteryIndicator({ level }: BatteryIndicatorProps) {
  if (level == null) return null;

  const low = level <= LOW;
  const barColor = level <= CRITICAL ? 'var(--bui-destructive)' : low ? 'var(--bui-warning)' : 'var(--bui-success)';
  const inkColor = level <= CRITICAL ? 'var(--bui-destructive-ink)' : low ? 'var(--bui-warning-ink)' : 'var(--bui-success-ink)';

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
            style={{ '--battery-bar': barColor } as CSSProperties}
          />
          {/* Couleur derivee du niveau a l'execution : style inline obligatoire */}
          <span
            className="text-xs font-[family-name:var(--font-display)] font-semibold leading-none tabular-nums"
            style={{ color: inkColor }}
          >
            {level}%
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{low ? 'Batterie faible' : 'Batterie'}</TooltipContent>
    </Tooltip>
  );
}
