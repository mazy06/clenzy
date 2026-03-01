import React from 'react';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { PAGINATION_BAR_HEIGHT } from './constants';

interface PlanningPaginationBarProps {
  currentPage: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  totalProperties: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

const PlanningPaginationBar: React.FC<PlanningPaginationBarProps> = React.memo(({
  currentPage,
  totalPages,
  rangeStart,
  rangeEnd,
  totalProperties,
  onPrevPage,
  onNextPage,
}) => {
  const theme = useTheme();

  if (totalPages <= 1) return null;

  return (
    <Box
      sx={{
        height: PAGINATION_BAR_HEIGHT,
        minHeight: PAGINATION_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        px: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        flexShrink: 0,
      }}
    >
      {/* Prev */}
      <IconButton
        size="small"
        onClick={onPrevPage}
        disabled={currentPage === 0}
        sx={{ width: 28, height: 28 }}
      >
        <ChevronLeft sx={{ fontSize: 18 }} />
      </IconButton>

      {/* Page indicator */}
      <Typography
        variant="body2"
        sx={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'text.primary',
          userSelect: 'none',
        }}
      >
        Page {currentPage + 1} / {totalPages}
      </Typography>

      {/* Next */}
      <IconButton
        size="small"
        onClick={onNextPage}
        disabled={currentPage >= totalPages - 1}
        sx={{ width: 28, height: 28 }}
      >
        <ChevronRight sx={{ fontSize: 18 }} />
      </IconButton>

      {/* Range info */}
      <Typography
        variant="caption"
        sx={{
          fontSize: '0.6875rem',
          color: 'text.secondary',
          ml: 1,
        }}
      >
        {rangeStart}-{rangeEnd} sur {totalProperties} logements
      </Typography>
    </Box>
  );
});

PlanningPaginationBar.displayName = 'PlanningPaginationBar';
export default PlanningPaginationBar;
