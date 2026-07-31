import React from 'react';

interface EmptyChartProps {
  label?: string;
  message?: string;
}

/**
 * Placeholder utilise par les chart widgets quand le payload est vide ou
 * malforme. Bg tonal subtil, pas de border (aligne avec la directive design
 * borderless de l'assistant).
 *
 * <p>Factorise pour eviter la duplication entre {@code PieChartWidget},
 * {@code BarChartWidget} et {@code LineChartWidget} (Rule of Three : 3
 * occurrences = extraction).</p>
 */
export const EmptyChart: React.FC<EmptyChartProps> = ({
  label,
  message = 'Aucune donnee a afficher',
}) => {
  return (
    <div className="mt-1.5 mb-2">
      {label && (
        <p className="cn-text-body1 block mb-1.5 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
          {label}
        </p>
      )}
      <div className="p-4 rounded-[12px] bg-[var(--field)] text-center">
        <p className="cn-text-body1 text-[12.5px] text-[var(--muted)]">
          {message}
        </p>
      </div>
    </div>
  );
};
