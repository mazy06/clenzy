import React from 'react';
import { cn } from '../../utils/cn';
import type { BarLayout } from './types';
import { BAR_BORDER_RADIUS } from './constants';
import { getEventDisplayColor } from './utils/colorUtils';

// Le @keyframes vivait dans le `sx` MUI, qui l'injectait lui-meme. Sans MUI il
// faut une vraie feuille : posee une seule fois au chargement du module.
const GHOST_KEYFRAMES_ID = 'planning-bar-ghost-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(GHOST_KEYFRAMES_ID)) {
  const styleEl = document.createElement('style');
  styleEl.id = GHOST_KEYFRAMES_ID;
  styleEl.textContent = '@keyframes ghost-pulse{0%,100%{opacity:.8}50%{opacity:.5}}';
  document.head.appendChild(styleEl);
}

interface PlanningBarGhostProps {
  layout: BarLayout;
  isConflict: boolean;
}

const PlanningBarGhost: React.FC<PlanningBarGhostProps> = ({ layout, isConflict }) => {
  const { event, width, height } = layout;
  const eventColor = getEventDisplayColor(event);

  const borderColor = isConflict ? 'var(--err)' : 'var(--ok)';

  return (
    <div
      className={cn(
        'flex items-center px-[4.5px] overflow-hidden pointer-events-none opacity-80 border-solid',
        isConflict && 'animate-[ghost-pulse_1s_ease-in-out_infinite] motion-reduce:animate-none',
      )}
      // Geometrie et couleurs derivees de l'evenement : valeurs d'execution.
      style={{
        width,
        height,
        backgroundColor: `color-mix(in srgb, ${eventColor} 25%, transparent)`,
        border: `2px solid ${borderColor}`,
        borderRadius: `${BAR_BORDER_RADIUS}px`,
      }}
    >
      {width > 40 && (
        <p className="cn-text-body1 text-[0.6875rem] font-semibold text-[var(--ink)] whitespace-nowrap overflow-hidden text-ellipsis leading-[1.2]">
          {event.label}
        </p>
      )}
    </div>
  );
};

export default PlanningBarGhost;
