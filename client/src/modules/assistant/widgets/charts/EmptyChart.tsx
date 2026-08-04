import React from 'react';
import { WIDGET_OVERLINE } from './chartConstants';

interface EmptyChartProps {
  label?: string;
  message?: string;
}

/**
 * Placeholder utilise par les chart widgets quand le payload est vide ou
 * malforme.
 *
 * <p>Factorise pour eviter la duplication entre {@code PieChartWidget},
 * {@code BarChartWidget} et {@code LineChartWidget} (Rule of Three : 3
 * occurrences = extraction).</p>
 */
export const EmptyChart: React.FC<EmptyChartProps> = ({
  label,
  message = 'Aucune donnée à afficher',
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <p className={WIDGET_OVERLINE}>{label}</p>}
      <div className="rounded-xl border border-border bg-muted p-4 text-center">
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};
