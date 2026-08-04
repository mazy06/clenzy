import { Card, TableRow, TableCell, Skeleton } from './ui';

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
 * Skeleton screen générique — remplace les `<Spinner />` centrés
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
                {/* Largeur calculee au rendu : Tailwind n'emet pas de classe depuis une valeur runtime. */}
                <Skeleton className="h-[18px]" style={{ width: colIdx === 0 ? '80%' : '60%' }} />
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
              <Skeleton className="size-[26px]" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-[22px] w-2/5" />
            <Skeleton className="h-3 w-[65%] mt-[3px]" />
          </Card>
        ))}
      </div>
    );
  }

  // 'row' default
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center gap-[7.5px] px-[9px] rounded-lg border border-solid border-[var(--line)] bg-[var(--card)]"
          style={{ height: rowHeight }}
        >
          <Skeleton className="size-9" />
          <div className="flex-1 flex flex-col gap-0.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-2.5 w-[65%]" />
          </div>
          <Skeleton className="h-[18px] w-[60px]" />
          <Skeleton className="size-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}
