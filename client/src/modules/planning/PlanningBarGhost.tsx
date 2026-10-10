import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import type { BarLayout } from './types';
import { BAR_BORDER_RADIUS } from './constants';
import { getEventDisplayColor } from './utils/colorUtils';
import { orderNameForReading } from '../../utils/textDirection';
import { isRtlLanguage } from '../../utils/localeDate';

import './planningUrgency.css';

interface PlanningBarGhostProps {
  layout: BarLayout;
  isConflict: boolean;
}

const PlanningBarGhost: React.FC<PlanningBarGhostProps> = ({ layout, isConflict }) => {
  const { i18n } = useTranslation();
  const isRtl = isRtlLanguage(i18n.language);
  const { event, width, height } = layout;
  const eventColor = getEventDisplayColor(event);

  const borderColor = isConflict ? 'var(--err)' : 'var(--ok)';

  return (
    <div
      className={cn(
        'flex items-center px-[4.5px] overflow-hidden pointer-events-none opacity-80 border-solid',
        isConflict && 'shadow-[0_0_0_1px_var(--bui-destructive)]',
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
          {orderNameForReading(event.label, isRtl)}
        </p>
      )}
    </div>
  );
};

export default PlanningBarGhost;
