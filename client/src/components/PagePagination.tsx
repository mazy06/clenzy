import React, { useMemo } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../utils/cn';

/**
 * Pagination UNIQUE du PMS Baitly (kit Baitly UI).
 *
 * Une seule et même pagination dans tous les écrans — listes, tableaux,
 * grilles de cartes : « ‹ Précédent  1 [2] 3 … 9  Suivant › », avec le total
 * rappelé à gauche et, si l'écran le permet, le sélecteur de taille de page.
 * Elle remplace les `TablePagination` MUI et leurs `sx` recopiés d'un module à
 * l'autre.
 *
 * `page` est **0-indexé** (contrat des écrans existants) ; l'affichage, lui,
 * commence à 1.
 */

interface PagePaginationProps {
  /** Page courante, 0-indexée. */
  page: number;
  /** Appelé avec la nouvelle page, 0-indexée. */
  onPageChange: (page: number) => void;
  /** Nombre total d'éléments (pas de pages). Requis pour le rappel « x-y sur n ». */
  count?: number;
  /** Taille de page. */
  rowsPerPage?: number;
  /** Nombre de pages, quand l'écran ne connaît que celui-ci (prioritaire sur count/rowsPerPage). */
  totalPages?: number;
  /** Tailles de page proposées. Le sélecteur n'apparaît qu'à partir de 2 valeurs. */
  rowsPerPageOptions?: number[];
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  /** Masquer le rappel « x-y sur n ». */
  hideTotal?: boolean;
  /** Masquer entièrement le bloc quand il n'y a qu'une page. Défaut : true. */
  hideOnSinglePage?: boolean;
  className?: string;
}

/**
 * Fenêtre de pages affichée : première, dernière, courante ± 1, et des ellipses
 * pour le reste. Renvoie des numéros de page 1-indexés, `null` = ellipse.
 */
function pageWindow(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: Array<number | null> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push(null);
    result.push(page);
  });
  return result;
}

export default function PagePagination({
  page,
  onPageChange,
  count,
  rowsPerPage,
  totalPages: totalPagesProp,
  rowsPerPageOptions,
  onRowsPerPageChange,
  hideTotal = false,
  hideOnSinglePage = true,
  className,
}: PagePaginationProps) {
  const { t } = useTranslation();

  const totalPages = Math.max(
    1,
    totalPagesProp ?? (count != null && rowsPerPage ? Math.ceil(count / rowsPerPage) : 1),
  );
  const currentPage = Math.min(Math.max(page + 1, 1), totalPages);
  const pages = useMemo(() => pageWindow(currentPage, totalPages), [currentPage, totalPages]);

  const sizeOptions = (rowsPerPageOptions ?? []).filter((option) => option > 0);
  const showSizeSelect = sizeOptions.length > 1 && !!onRowsPerPageChange && !!rowsPerPage;

  if (hideOnSinglePage && totalPages <= 1 && !showSizeSelect) return null;

  const showRange = !hideTotal && count != null && !!rowsPerPage;
  const from = count === 0 ? 0 : page * (rowsPerPage ?? 0) + 1;
  const to = Math.min(count ?? 0, (page + 1) * (rowsPerPage ?? 0));

  const go = (target: number) => {
    const next = Math.min(Math.max(target, 1), totalPages);
    if (next !== currentPage) onPageChange(next - 1);
  };

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 py-2', className)}>
      <div className="flex items-center gap-3">
        {showRange && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t('pagination.range', '{{from}}-{{to}} sur {{count}}', { from, to, count })}
          </span>
        )}
        {showSizeSelect && (
          <Select
            value={String(rowsPerPage)}
            onValueChange={(next) => onRowsPerPageChange?.(Number(next))}
          >
            <SelectTrigger
              size="sm"
              className="h-8 w-auto"
              aria-label={t('pagination.rowsPerPage', 'Lignes par page')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {t('pagination.rowsPerPageOption', '{{count}} / page', { count: option })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text={t('pagination.previous', 'Précédent')}
              aria-disabled={currentPage === 1}
              className={cn(currentPage === 1 && 'pointer-events-none opacity-50')}
              onClick={(event) => {
                event.preventDefault();
                go(currentPage - 1);
              }}
            />
          </PaginationItem>

          {pages.map((entry, index) =>
            entry === null ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={entry}>
                <PaginationLink
                  href="#"
                  isActive={entry === currentPage}
                  className="tabular-nums"
                  onClick={(event) => {
                    event.preventDefault();
                    go(entry);
                  }}
                >
                  {entry}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              href="#"
              text={t('pagination.next', 'Suivant')}
              aria-disabled={currentPage === totalPages}
              className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')}
              onClick={(event) => {
                event.preventDefault();
                go(currentPage + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
