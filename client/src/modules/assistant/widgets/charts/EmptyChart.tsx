import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';

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
  const theme = useTheme();

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {label && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 1,
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: theme.palette.text.secondary,
          }}
        >
          {label}
        </Typography>
      )}
      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.text.primary, 0.025),
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Box>
    </Box>
  );
};
