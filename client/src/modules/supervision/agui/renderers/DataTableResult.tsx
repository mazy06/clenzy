/* ============================================================
   DataTableResult — displayHint="data_table"

   Payload générique tabulaire :
     { columns: [{ key, label?, numeric? } | "key"], rows: [{...} | [...]],
       title?, truncated?, totalMatching? }
   Tolère colonnes en objets OU en strings, lignes en objets OU en tableaux.
   Aucun tool backend n'émet ce hint aujourd'hui — renderer forward-compatible.
   ============================================================ */
import React from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui';
import { cn } from '../../../../utils/cn';
import { Overline, SurfaceCard, humanizeKey } from './shared';

interface ColumnObj {
  key: string;
  label?: string;
  numeric?: boolean;
}
type Column = ColumnObj | string;
type Row = Record<string, unknown> | unknown[];

interface DataTableData {
  title?: string;
  columns?: Column[];
  rows?: Row[];
  truncated?: boolean;
  totalMatching?: number;
}

const MAX_ROWS = 10;

function normalizeColumns(columns: Column[] | undefined, sample: Row | undefined): ColumnObj[] {
  if (Array.isArray(columns) && columns.length > 0) {
    return columns.map((c) =>
      typeof c === 'string' ? { key: c, label: humanizeKey(c) } : { ...c, label: c.label ?? humanizeKey(c.key) },
    );
  }
  // Pas de colonnes fournies : dérive depuis un sample objet.
  if (sample && !Array.isArray(sample)) {
    return Object.keys(sample)
      .slice(0, 6)
      .map((k) => ({ key: k, label: humanizeKey(k) }));
  }
  return [];
}

function cellValue(row: Row, col: ColumnObj, colIdx: number): unknown {
  if (Array.isArray(row)) return row[colIdx];
  return row[col.key];
}

export const DataTableResult: React.FC<{ data: DataTableData }> = ({ data }) => {
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const columns = normalizeColumns(data.columns, rows[0]);
  const visible = rows.slice(0, MAX_ROWS);
  const hidden = Math.max((data.totalMatching ?? rows.length) - visible.length, rows.length - visible.length);

  if (rows.length === 0 || columns.length === 0) {
    return (
      <SurfaceCard className="text-center">
        <p className="text-xs text-muted-foreground">Aucune donnée.</p>
      </SurfaceCard>
    );
  }

  return (
    <div className="mt-1.5 mb-2">
      {data.title && <Overline className="mb-1.5">{data.title}</Overline>}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={cn(col.numeric && 'text-end')}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row, idx) => (
              <TableRow key={idx}>
                {columns.map((col, colIdx) => {
                  const v = cellValue(row, col, colIdx);
                  return (
                    <TableCell
                      key={col.key}
                      className={cn(
                        'max-w-[18ch] overflow-hidden text-ellipsis tabular-nums text-foreground',
                        col.numeric && 'text-end font-medium',
                      )}
                    >
                      {v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hidden > 0 && (
        <p className="mt-1 block text-2xs italic text-muted-foreground">+ {hidden} de plus</p>
      )}
    </div>
  );
};
