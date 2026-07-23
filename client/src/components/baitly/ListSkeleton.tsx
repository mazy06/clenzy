import { Skeleton } from '../ui';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/ListSkeleton.tsx (MUI), construit sur
 * le Skeleton du kit. Variantes row / card / table.
 */
export interface ListSkeletonProps {
  rows?: number;
  variant?: 'row' | 'card' | 'table';
  columns?: number;
  rowHeight?: number;
  className?: string;
}

export default function ListSkeleton({
  rows = 6,
  variant = 'row',
  columns = 6,
  rowHeight = 56,
  className,
}: ListSkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="w-full rounded-xl" style={{ height: rowHeight * 2 }} />
        ))}
      </div>
    );
  }
  if (variant === 'table') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            {Array.from({ length: columns }, (_, j) => (
              <Skeleton key={j} className={cn('h-4', j === 0 ? 'w-24' : 'flex-1')} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="w-full rounded-lg" style={{ height: rowHeight }} />
      ))}
    </div>
  );
}
