/* ============================================================
   DataTableResult — displayHint="data_table"

   Payload générique tabulaire :
     { columns: [{ key, label?, numeric? } | "key"], rows: [{...} | [...]],
       title?, truncated?, totalMatching? }
   Tolère colonnes en objets OU en strings, lignes en objets OU en tableaux.
   Aucun tool backend n'émet ce hint aujourd'hui — renderer forward-compatible.
   ============================================================ */
import React from 'react';
import { cn } from '../../../../utils/cn';
import { Overline, humanizeKey } from './shared';

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
      <div className="mt-1.5 mb-2 px-3 py-3 rounded-[12px] border border-[var(--line)] bg-[var(--card)] text-center">
        <p className="cn-text-body1 text-[12.5px] text-[var(--muted)]">Aucune donnée.</p>
      </div>
    );
  }

  return (
    <div className="mt-1.5 mb-2">
      {data.title && <Overline sx={{ mb: 0.75 }}>{data.title}</Overline>}

      <div className="rounded-[12px] overflow-hidden border border-[var(--line)] bg-[var(--card)]">
        <div className="grid gap-1.5 px-[9px] py-[4.5px] bg-[var(--surface-2)]" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, borderBottom: '1px solid var(--line)' }}>
          {columns.map((col) => (
            <Overline key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: col.numeric ? 'right' : 'left' }}>
              {col.label}
            </Overline>
          ))}
        </div>

        {visible.map((row, idx) => (
          <div
            key={idx}
            className={cn(
              'grid gap-1.5 px-[9px] py-1.5 transition-[background] duration-[120ms] hover:bg-[var(--hover)] motion-reduce:transition-none',
              idx > 0 && 'border-t border-solid border-[var(--line)]',
            )}
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {columns.map((col, colIdx) => {
              const v = cellValue(row, col, colIdx);
              return (
                <p
                  key={col.key}
                  className={cn(
                    'cn-text-body1 text-[12.5px] text-[var(--body)] whitespace-nowrap overflow-hidden text-ellipsis tabular-nums',
                    col.numeric ? 'text-right font-medium' : 'text-left',
                  )}
                >
                  {v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </p>
              );
            })}
          </div>
        ))}
      </div>

      {hidden > 0 && (
        <p className="cn-text-body1 block mt-1 text-[11.5px] text-[var(--muted)] italic">
          + {hidden} de plus
        </p>
      )}
    </div>
  );
};
