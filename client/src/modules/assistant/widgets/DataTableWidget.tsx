import React, { useMemo } from 'react';
import { cn } from '../../../utils/cn';

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
  const items = useMemo(() => data.items ?? [], [data.items]);
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
      <div className="mt-1.5 mb-2 px-3 py-3 rounded-xl border border-border bg-card text-center">
        <p className="text-xs text-muted-foreground">
          Aucun resultat
          {data.from && data.to && ` sur la periode ${formatDate(data.from)} → ${formatDate(data.to)}`}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-1.5 mb-2">
      {/* Header avec range de dates si fournie */}
      {data.from && data.to && (
        <p className="block mb-1 text-xs text-muted-foreground tabular-nums">
          Periode : {formatDate(data.from)} → {formatDate(data.to)}
        </p>
      )}

      {/* Table hairline */}
      <div className="rounded-xl overflow-hidden border border-border bg-card">
        {/* Header row */}
        <div className="grid gap-1.5 border-b border-border bg-muted px-2 py-1" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((col) => (
            <p className="text-2xs font-bold tracking-[.05em] uppercase text-faint whitespace-nowrap overflow-hidden text-ellipsis" key={col.key}>
              {col.label}
            </p>
          ))}
        </div>

        {/* Data rows */}
        {visibleItems.map((item, idx) => (
          // Le gabarit de grille depend du nombre de colonnes (execution) → style.
          // gap 1 = 6px, px 1.5 = 9px, py 1 = 6px (theme.spacing = 6).
          <div
            key={String(item.id ?? idx)}
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
            className={cn(
              'grid gap-1.5 px-[9px] py-1.5 transition-[background] duration-[120ms] motion-reduce:transition-none hover:bg-accent',
              idx > 0 ? 'border-t border-solid border-border' : 'border-t-0',
            )}
          >
            {columns.map((col) => (
              <p
                key={col.key}
                className={cn(
                  'text-xs text-foreground whitespace-nowrap overflow-hidden text-ellipsis',
                  col.numeric && 'tabular-nums font-medium',
                )}
              >
                {formatCell(item[col.key], col)}
              </p>
            ))}
          </div>
        ))}
      </div>

      {/* Footer truncation */}
      {hiddenCount > 0 && (
        <p className="block mt-1 text-xs text-muted-foreground italic">
          + {hiddenCount} de plus (demande "tous" pour la liste complete)
        </p>
      )}
    </div>
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
