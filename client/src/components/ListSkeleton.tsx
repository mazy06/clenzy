import { Box, Skeleton, Paper, TableRow, TableCell } from '@mui/material';

interface ListSkeletonProps {
  /** Nombre de lignes/cards à simuler. Default : 6. */
  rows?: number;
  /**
   * Variante :
   *  - 'row'  : rangées flat alignées (liste type Properties / Interventions)
   *  - 'card' : grid de cards (type Dashboard stats / Booking engine)
   *  - 'table': lignes de table (avec cells)
   */
  variant?: 'row' | 'card' | 'table';
  /** Nombre de colonnes pour `table`. Default : 6. */
  columns?: number;
  /** Hauteur d'une rangée (variant row/card). Default : 56. */
  rowHeight?: number;
}

/**
 * Skeleton screen générique — remplace les `<CircularProgress />` centrés
 * (anti-pattern Taste : *"Replace generic circular spinners with skeleton
 * loaders that match the layout shape"*).
 *
 * Les blocs Skeleton suivent la forme attendue du contenu pour éviter le
 * "content jumping" au moment du remplacement.
 */
export default function ListSkeleton({
  rows = 6,
  variant = 'row',
  columns = 6,
  rowHeight = 56,
}: ListSkeletonProps) {
  if (variant === 'table') {
    return (
      <>
        {Array.from({ length: rows }).map((_, idx) => (
          <TableRow key={idx}>
            {Array.from({ length: columns }).map((__, colIdx) => (
              <TableCell key={colIdx}>
                <Skeleton variant="text" width={colIdx === 0 ? '80%' : '60%'} height={18} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </>
    );
  }

  if (variant === 'card') {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        {Array.from({ length: rows }).map((_, idx) => (
          <Paper key={idx} variant="outlined" sx={{ p: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Skeleton variant="rounded" width={26} height={26} />
              <Skeleton variant="text" width="50%" height={12} />
            </Box>
            <Skeleton variant="text" width="40%" height={22} />
            <Skeleton variant="text" width="65%" height={12} sx={{ mt: 0.5 }} />
          </Paper>
        ))}
      </Box>
    );
  }

  // 'row' default
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {Array.from({ length: rows }).map((_, idx) => (
        <Paper
          key={idx}
          variant="outlined"
          sx={{
            height: rowHeight,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 1.5,
          }}
        >
          <Skeleton variant="rounded" width={36} height={36} />
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Skeleton variant="text" width="40%" height={14} />
            <Skeleton variant="text" width="65%" height={10} />
          </Box>
          <Skeleton variant="rounded" width={60} height={18} />
          <Skeleton variant="circular" width={24} height={24} />
        </Paper>
      ))}
    </Box>
  );
}
