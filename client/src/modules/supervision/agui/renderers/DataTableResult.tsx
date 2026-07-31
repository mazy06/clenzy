/* ============================================================
   DataTableResult — displayHint="data_table"

   Payload générique tabulaire :
     { columns: [{ key, label?, numeric? } | "key"], rows: [{...} | [...]],
       title?, truncated?, totalMatching? }
   Tolère colonnes en objets OU en strings, lignes en objets OU en tableaux.
   Aucun tool backend n'émet ce hint aujourd'hui — renderer forward-compatible.
   ============================================================ */
import React from 'react';
import { Box, Typography } from '@mui/material';
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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
            gap: 1,
            px: 1.5,
            py: 0.75,
            bgcolor: 'var(--surface-2)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          {columns.map((col) => (
            <Overline key={col.key} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: col.numeric ? 'right' : 'left' }}>
              {col.label}
            </Overline>
          ))}
        </Box>

        {visible.map((row, idx) => (
          <Box
            key={idx}
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
              gap: 1,
              px: 1.5,
              py: 1,
              borderTop: idx > 0 ? '1px solid var(--line)' : 'none',
              transition: 'background .12s',
              '&:hover': { bgcolor: 'var(--hover)' },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            {columns.map((col, colIdx) => {
              const v = cellValue(row, col, colIdx);
              return (
                <Typography
                  key={col.key}
                  sx={{
                    fontSize: '12.5px',
                    color: 'var(--body)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: col.numeric ? 'right' : 'left',
                    fontVariantNumeric: 'tabular-nums',
                    ...(col.numeric && { fontWeight: 500 }),
                  }}
                >
                  {v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </Typography>
              );
            })}
          </Box>
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
