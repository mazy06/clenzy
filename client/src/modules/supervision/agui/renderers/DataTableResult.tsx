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
      <Box sx={{ mt: 1, mb: 1.5, px: 2, py: 2, borderRadius: '12px', border: '1px solid var(--line)', bgcolor: 'var(--card)', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)' }}>Aucune donnée.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {data.title && <Overline sx={{ mb: 0.75 }}>{data.title}</Overline>}

      <Box sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--line)', bgcolor: 'var(--card)' }}>
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
      </Box>

      {hidden > 0 && (
        <Typography sx={{ display: 'block', mt: 0.75, fontSize: '11.5px', color: 'var(--muted)', fontStyle: 'italic' }}>
          + {hidden} de plus
        </Typography>
      )}
    </Box>
  );
};
