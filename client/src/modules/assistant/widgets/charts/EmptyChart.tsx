import React from 'react';
import { Box, Typography } from '@mui/material';

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
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {label && (
        <Typography
          sx={{
            display: 'block',
            mb: 1,
            fontSize: '10.5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            color: 'var(--faint)',
          }}
        >
          {label}
        </Typography>
      )}
      <Box
        sx={{
          p: 3,
          borderRadius: '12px',
          bgcolor: 'var(--field)',
          textAlign: 'center',
        }}
      >
        <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)' }}>
          {message}
        </Typography>
      </Box>
    </Box>
  );
};
