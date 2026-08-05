/* ============================================================
   QuoteResult — displayHint="quote"

   Payload backend (get_price_quote) :
     { propertyId, propertyName, from, to, nights, total, currency,
       perNight: [{ date, price }] }
   → carte devis : total en avant, période + nb de nuits, détail
     prix par nuit (replié au-delà de quelques nuits).
   ============================================================ */
import React from 'react';
import { SurfaceCard, Overline, formatMoney } from './shared';

interface PerNight {
  date: string;
  price: number | string;
}
interface QuoteData {
  propertyName?: string;
  from?: string;
  to?: string;
  nights?: number;
  total?: number | string;
  currency?: string;
  perNight?: PerNight[];
}

function formatRange(from?: string, to?: string): string {
  if (!from || !to) return '';
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return `${from} → ${to}`;
  return `${f.toLocaleDateString('fr-FR', opts)} → ${t.toLocaleDateString('fr-FR', opts)}`;
}

export const QuoteResult: React.FC<{ data: QuoteData }> = ({ data }) => {
  const perNight = Array.isArray(data.perNight) ? data.perNight : [];
  const nights = data.nights ?? perNight.length;

  return (
    <SurfaceCard className="border-primary">
      {/* En-tête : libellé + total */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <Overline>Devis{data.propertyName ? ` · ${data.propertyName}` : ''}</Overline>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {formatRange(data.from, data.to)}
            {nights > 0 && ` · ${nights} nuit${nights > 1 ? 's' : ''}`}
          </p>
        </div>
        <p className="whitespace-nowrap text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground font-[family-name:var(--font-display)]">
          {formatMoney(data.total, data.currency)}
        </p>
      </div>

      {/* Détail par nuit */}
      {perNight.length > 0 && (
        <div className="mt-2 border-t border-border pt-1.5">
          {perNight.map((night) => (
            <div className="flex items-baseline justify-between py-0.5" key={night.date}>
              <p className="text-xs tabular-nums text-muted-foreground">
                {new Date(night.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
              </p>
              <p className="text-xs font-medium tabular-nums text-foreground">
                {formatMoney(night.price, data.currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
};
