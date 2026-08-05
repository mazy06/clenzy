/* ============================================================
   ListResult — displayHint="list"

   Payload backend (list_reservations, list_properties, list_invoices,
   list_reviews, list_guests, get_owner_payout_summary, …) :
     { items: [...], count, totalMatching?, truncated?, from?, to? }
   Les items ont des clés variables → on dérive 2–4 colonnes depuis le
   1er item (en sautant les *Id techniques) et on rend une liste compacte.
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
import {
  SurfaceCard,
  StatusChip,
  formatDateShort,
  formatMoney,
  humanizeKey,
  humanizeStatus,
  statusTone,
} from './shared';

type Item = Record<string, unknown>;

interface ListData {
  items?: Item[];
  count?: number;
  totalMatching?: number;
  totalElements?: number;
  truncated?: boolean;
  from?: string;
  to?: string;
}

const MAX_ROWS = 8;
const DATE_KEYS = new Set(['checkIn', 'checkOut', 'scheduledDate', 'date', 'dueDate', 'issuedAt']);
const MONEY_KEYS = new Set(['totalPrice', 'amount', 'total', 'payout', 'price']);

/** Dérive jusqu'à 4 clés d'affichage depuis le 1er item (saute id/*Id/createdAt). */
function deriveColumns(sample: Item | undefined): string[] {
  if (!sample) return [];
  return Object.keys(sample)
    .filter((k) => k !== 'id' && k !== 'createdAt' && !k.endsWith('Id'))
    .slice(0, 4);
}

function renderCell(key: string, value: unknown, currency?: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'status') return <StatusChip label={humanizeStatus(value)} tone={statusTone(value)} />;
  if (DATE_KEYS.has(key)) return formatDateShort(value);
  if (MONEY_KEYS.has(key)) return formatMoney(value, typeof currency === 'string' ? currency : undefined);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export const ListResult: React.FC<{ data: ListData }> = ({ data }) => {
  const items = Array.isArray(data.items) ? data.items : [];
  const columns = deriveColumns(items[0]);
  const visible = items.slice(0, MAX_ROWS);
  const totalKnown = data.totalMatching ?? data.totalElements ?? items.length;
  const hidden = Math.max(totalKnown - visible.length, items.length - visible.length);

  if (items.length === 0) {
    return (
      <SurfaceCard className="text-center">
        <p className="text-xs text-muted-foreground">
          Aucun résultat
          {data.from && data.to && ` du ${formatDateShort(data.from)} au ${formatDateShort(data.to)}`}.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="mt-1.5 mb-2">
      {data.from && data.to && (
        <p className="mb-1 block text-2xs tabular-nums text-muted-foreground">
          Période : {formatDateShort(data.from)} → {formatDateShort(data.to)}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col}>{humanizeKey(col)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((item, idx) => (
              <TableRow key={String(item.id ?? idx)}>
                {columns.map((col) => (
                  <TableCell
                    key={col}
                    className="max-w-[18ch] overflow-hidden text-ellipsis tabular-nums text-foreground"
                  >
                    {renderCell(col, item[col], item.currency)}
                  </TableCell>
                ))}
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
