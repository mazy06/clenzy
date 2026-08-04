/* ============================================================
   ListResult — displayHint="list"

   Payload backend (list_reservations, list_properties, list_invoices,
   list_reviews, list_guests, get_owner_payout_summary, …) :
     { items: [...], count, totalMatching?, truncated?, from?, to? }
   Les items ont des clés variables → on dérive 2–4 colonnes depuis le
   1er item (en sautant les *Id techniques) et on rend une liste compacte.
   ============================================================ */
import React from 'react';
import { cn } from '../../../../utils/cn';
import {
  SurfaceCard,
  Overline,
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
      <SurfaceCard sx={{ textAlign: 'center' }}>
        <p className="cn-text-body1 text-[12.5px] text-[var(--muted)]">
          Aucun résultat
          {data.from && data.to && ` du ${formatDateShort(data.from)} au ${formatDateShort(data.to)}`}.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="mt-1.5 mb-2">
      {data.from && data.to && (
        <p className="cn-text-body1 block mb-1 text-[11.5px] text-[var(--muted)] tabular-nums">
          Période : {formatDateShort(data.from)} → {formatDateShort(data.to)}
        </p>
      )}

      <div className="rounded-[12px] overflow-hidden border border-[var(--line)] bg-[var(--card)]">
        {/* En-têtes */}
        <div className="grid gap-1.5 px-[9px] py-[4.5px] bg-[var(--surface-2)]" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, borderBottom: '1px solid var(--line)' }}>
          {columns.map((col) => (
            <Overline key={col} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {humanizeKey(col)}
            </Overline>
          ))}
        </div>

        {/* Lignes */}
        {visible.map((item, idx) => (
          <div
            key={String(item.id ?? idx)}
            className={cn(
              'grid gap-1.5 px-[9px] py-1.5 items-center',
              'transition-[background-color] duration-[120ms] hover:bg-[var(--hover)] motion-reduce:transition-none',
              idx > 0 && 'border-t border-solid border-[var(--line)]',
            )}
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {columns.map((col) => (
              <div className="text-[12.5px] text-[var(--body)] whitespace-nowrap overflow-hidden text-ellipsis tabular-nums" key={col}>
                {renderCell(col, item[col], item.currency)}
              </div>
            ))}
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
