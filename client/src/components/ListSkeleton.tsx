import { Skeleton, Paper } from '@mui/material';
import { Card, TableRow, TableCell } from '../components/ui';

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
      <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(2,_1fr)] min-[900px]:grid-cols-[repeat(3,_1fr)] min-[1200px]:grid-cols-[repeat(4,_1fr)] gap-[9px]">
        {Array.from({ length: rows }).map((_, idx) => (
          <Card className="gap-0 py-0 p-2" key={idx}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Skeleton variant="rounded" width={26} height={26} />
              <Skeleton variant="text" width="50%" height={12} />
            </div>
            <Skeleton variant="text" width="40%" height={22} />
            <Skeleton variant="text" width="65%" height={12} sx={{ mt: 0.5 }} />
          </Card>
        ))}
      </div>
    );
  }

  // 'row' default
  return (
    <div className="flex flex-col gap-1">
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
          <div className="flex-1 flex flex-col gap-0.5">
            <Skeleton variant="text" width="40%" height={14} />
            <Skeleton variant="text" width="65%" height={10} />
          </div>
          <Skeleton variant="rounded" width={60} height={18} />
          <Skeleton variant="circular" width={24} height={24} />
        </Paper>
      ))}
    </div>
  );
}
