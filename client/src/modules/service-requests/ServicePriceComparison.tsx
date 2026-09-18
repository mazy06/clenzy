import type { ReactNode } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

/** Écart signé ; ne prête pas de devise à un montant historique non renseigné. */
export function ServicePriceDifference({ amount, currency }: { amount: number; currency?: string | null }) {
  const { currentLanguage } = useTranslation();
  const rounded = Math.round(amount * 100) / 100;
  const tone = rounded > 0 ? 'bg-warning-soft text-warning-ink'
    : rounded < 0 ? 'bg-success-soft text-success-ink' : 'bg-muted text-muted-foreground';
  return <span className={`inline-block whitespace-nowrap rounded px-2 py-1 text-xs tabular-nums ${tone}`}>
    {new Intl.NumberFormat(currentLanguage, {
      ...(currency ? { style: 'currency' as const, currency } : {}),
      signDisplay: 'exceptZero', maximumFractionDigits: 2,
    }).format(rounded)}
  </span>;
}

/** Présentation partagée du prix proposé et du prix du prestataire. */
export default function ServicePriceComparison({ proposedLabel, proposed, providerLabel, provider, difference }: {
  proposedLabel: ReactNode; proposed: ReactNode; providerLabel: ReactNode; provider: ReactNode; difference?: ReactNode;
}) {
  return <div className="flex items-end justify-between gap-3 rounded-lg bg-muted/40 p-3">
    <div className="min-w-0 flex-1"><div className="text-xs uppercase tracking-wide text-muted-foreground">{proposedLabel}</div>
      <div className="mt-1 text-base font-semibold tabular-nums">{proposed}</div></div>
    {difference != null && <div className="shrink-0 self-center">{difference}</div>}
    <div className="min-w-0 flex-1 text-end"><div className="text-xs uppercase tracking-wide text-muted-foreground">{providerLabel}</div>
      <div className="mt-1 text-base font-semibold tabular-nums">{provider}</div></div>
  </div>;
}
