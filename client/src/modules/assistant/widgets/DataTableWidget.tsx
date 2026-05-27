import React, { useMemo } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';

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
 * <p>Design : table borderless, lignes alternees via bg color, headers en
 * uppercase petite taille, tabular-nums sur les valeurs.</p>
 */
export const DataTableWidget: React.FC<DataTableWidgetProps> = ({ data, toolName }) => {
  const theme = useTheme();
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
          borderRadius: 2,
          bgcolor: alpha(theme.palette.text.primary, 0.035),
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
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
          variant="caption"
          sx={{
            display: 'block',
            mb: 0.75,
            color: theme.palette.text.secondary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Periode : {formatDate(data.from)} → {formatDate(data.to)}
        </Typography>
      )}

      {/* Table borderless */}
      <Box
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: alpha(theme.palette.text.primary, 0.025),
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
            bgcolor: alpha(theme.palette.text.primary, 0.04),
          }}
        >
          {columns.map((col) => (
            <Typography
              key={col.key}
              variant="caption"
              sx={{
                fontSize: '0.65rem',
                fontWeight: 600,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: theme.palette.text.secondary,
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
              // Zebra stripes via bg alpha, pas via border
              bgcolor: idx % 2 === 1
                ? alpha(theme.palette.text.primary, 0.02)
                : 'transparent',
            }}
          >
            {columns.map((col) => (
              <Typography
                key={col.key}
                variant="body2"
                sx={{
                  fontSize: '0.8125rem',
                  color: theme.palette.text.primary,
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
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.75,
            color: theme.palette.text.secondary,
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
