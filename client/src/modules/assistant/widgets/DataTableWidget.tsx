import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

type DataItem = Record<string, unknown>;

interface DataTableData {
  items?: DataItem[];
  count?: number;
  totalElements?: number;
  totalMatching?: number;
  truncated?: boolean;
  from?: string;
  to?: string;
}

interface DataTableWidgetProps {
  data: DataTableData;
  /** Nom du tool source — utilise pour adapter les colonnes (reservations, properties, etc.) */
  toolName?: string;
}

/**
 * Widget de rendu pour {@code displayHint="list"} — table generique des items
 * retournes par {@code list_properties}, {@code list_reservations},
 * {@code list_cleaning_tasks}, etc.
 *
 * <p>Detection automatique des colonnes selon le {@link #toolName} (configuration
 * statique). Fallback : utilise les keys du premier item. Limite a 8 lignes
 * affichees, avec footer "N de plus" si {@code truncated}.</p>
 *
 * <p>Design « Signature » : carte hairline, entêtes overline 10.5 `--faint`,
 * lignes au filet `--line`, hover `--hover`, valeurs 12.5px tabular-nums.</p>
 */
export const DataTableWidget: React.FC<DataTableWidgetProps> = ({ data, toolName }) => {
  const items = data.items ?? [];
  const MAX_ROWS = 8;
  const visibleItems = items.slice(0, MAX_ROWS);
  const hiddenCount = Math.max(
    (data.totalMatching ?? data.totalElements ?? items.length) - visibleItems.length,
    items.length - visibleItems.length,
  );

  // Determine columns based on tool name (or fallback to first item keys)
  const columns = useMemo(() => getColumns(toolName, items[0]), [toolName, items]);

  if (items.length === 0) {
    return (
      <Box
        sx={{
          mt: 1, mb: 1.5,
          px: 2, py: 2,
          borderRadius: '12px',
          border: '1px solid var(--line)',
          bgcolor: 'var(--card)',
          textAlign: 'center',
        }}
      >
        <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)' }}>
          Aucun resultat
          {data.from && data.to && ` sur la periode ${formatDate(data.from)} → ${formatDate(data.to)}`}.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {/* Header avec range de dates si fournie */}
      {data.from && data.to && (
        <Typography
          sx={{
            display: 'block',
            mb: 0.75,
            fontSize: '11.5px',
            color: 'var(--muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Periode : {formatDate(data.from)} → {formatDate(data.to)}
        </Typography>
      )}

      {/* Table hairline */}
      <Box
        sx={{
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--line)',
          bgcolor: 'var(--card)',
        }}
      >
        {/* Header row */}
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
            <Typography
              key={col.key}
              sx={{
                fontSize: '10.5px',
                fontWeight: 700,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                color: 'var(--faint)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {col.label}
            </Typography>
          ))}
        </Box>

        {/* Data rows */}
        {visibleItems.map((item, idx) => (
          <Box
            key={String(item.id ?? idx)}
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
            {columns.map((col) => (
              <Typography
                key={col.key}
                sx={{
                  fontSize: '12.5px',
                  color: 'var(--body)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  ...(col.numeric && { fontVariantNumeric: 'tabular-nums', fontWeight: 500 }),
                }}
              >
                {formatCell(item[col.key], col)}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>

      {/* Footer truncation */}
      {hiddenCount > 0 && (
        <Typography
          sx={{
            display: 'block',
            mt: 0.75,
            fontSize: '11.5px',
            color: 'var(--muted)',
            fontStyle: 'italic',
          }}
        >
          + {hiddenCount} de plus (demande "tous" pour la liste complete)
        </Typography>
      )}
    </Box>
  );
};

// ─── Column configurations per tool ────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  numeric?: boolean;
  /** "currency" → format avec devise, "date" → JJ/MM, "status" → uppercase */
  format?: 'currency' | 'date' | 'status' | 'plain';
  /** Cle adjacente pour la devise (si format=currency) */
  currencyKey?: string;
}

function getColumns(toolName: string | undefined, sample: DataItem | undefined): ColumnDef[] {
  switch (toolName) {
    case 'list_properties':
      return [
        { key: 'name', label: 'Propriete' },
        { key: 'city', label: 'Ville' },
        { key: 'type', label: 'Type', format: 'status' },
        { key: 'status', label: 'Statut', format: 'status' },
      ];

    case 'list_reservations':
      return [
        { key: 'propertyName', label: 'Propriete' },
        { key: 'guestName', label: 'Invite' },
        { key: 'checkIn', label: 'Arrivee', format: 'date' },
        { key: 'checkOut', label: 'Depart', format: 'date' },
        { key: 'totalPrice', label: 'Montant', numeric: true, format: 'currency', currencyKey: 'currency' },
      ];

    case 'list_cleaning_tasks':
      return [
        { key: 'title', label: 'Tache' },
        { key: 'propertyName', label: 'Propriete' },
        { key: 'scheduledDate', label: 'Prevue', format: 'date' },
        { key: 'assignedTo', label: 'Assigne' },
        { key: 'status', label: 'Statut', format: 'status' },
      ];

    default: {
      // Fallback : derive from first item — max 4 colonnes, skip id/createdAt
      if (!sample) return [];
      const keys = Object.keys(sample)
        .filter((k) => k !== 'id' && k !== 'createdAt' && !k.endsWith('Id'))
        .slice(0, 4);
      return keys.map((k) => ({ key: k, label: humanize(k) }));
    }
  }
}

// ─── Formatting helpers ────────────────────────────────────────────────────

function formatCell(value: unknown, col: ColumnDef): string {
  if (value === null || value === undefined || value === '') return '—';

  switch (col.format) {
    case 'date':
      return formatDate(String(value));
    case 'status':
      return String(value).replace(/_/g, ' ').toLowerCase();
    case 'currency':
      if (typeof value === 'number' || typeof value === 'string') {
        const num = Number(value);
        return isNaN(num) ? String(value) : num.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
      }
      return String(value);
    case 'plain':
    default:
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
  }
}

function formatDate(iso: string): string {
  // Accepte YYYY-MM-DD ou ISO complet. Format compact "JJ/MM"
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
