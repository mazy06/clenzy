import React from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useVoucherAnalytics } from '../../hooks/useBookingVouchers';
import type { VoucherStats } from '../../services/api/bookingVouchersApi';

/**
 * Panneau analytics affiche en haut de VouchersPage.
 *
 * <h3>Contenu V1</h3>
 * <ul>
 *   <li>4 KPI cards : usages, CA brut, discount cumule, CA net</li>
 *   <li>Top 5 vouchers par CA brut (tableau compact)</li>
 *   <li>Periode par defaut : 30 derniers jours (cote backend)</li>
 * </ul>
 *
 * <p>Hidden si aucune utilisation (evite d'afficher des 0 partout sur un
 * compte qui n'a jamais utilise un voucher).</p>
 *
 * <p>Pas de graphique chronologique en V1 — peut etre ajoute en P7 avec
 * recharts/chart.js si necessaire. Les 4 KPI + top 5 donnent deja la vue
 * d'ensemble suffisante pour la majorite des cas.</p>
 */
export default function VoucherAnalyticsPanel() {
  const { t, currentLanguage } = useTranslation();
  const { data, isLoading, error } = useVoucherAnalytics();

  const currencyFormatter = React.useMemo(
    () => new Intl.NumberFormat(currentLanguage, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }),
    [currentLanguage],
  );

  // Affichage conditionnel : si pas de data ou aucune usage, on rend juste
  // un compteur d'actifs (utile meme sans historique).
  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="warning" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{t('vouchers.analytics.loadError')}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  // Si pas d'usages historiques, on simplifie : juste le compteur d'actifs.
  if (data.totalUsages === 0) {
    return (
      <Card className="gap-0 py-0 p-3 mb-4">
        <p className="text-xs text-muted-foreground">
          {t('vouchers.analytics.noUsageYet', { active: data.activeVouchersCount })}
        </p>
      </Card>
    );
  }

  const fmt = (v: string) => currencyFormatter.format(Number(v));

  const periodLabel = formatPeriod(data.from, data.to, currentLanguage);

  return (
    <div className="mb-4">
      {/* mb: 1 = 6 px (theme.spacing vaut 6). */}
      <div className="flex flex-row items-baseline justify-between mb-[6px]">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('vouchers.analytics.title')}
        </span>
        <span className="text-xs text-muted-foreground">
          {periodLabel}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-12 gap-[9px] mb-3">
        <KpiCard
          label={t('vouchers.analytics.totalUsages')}
          value={data.totalUsages.toString()}
        />
        <KpiCard
          label={t('vouchers.analytics.totalGross')}
          value={fmt(data.totalGross)}
        />
        <KpiCard
          label={t('vouchers.analytics.totalDiscount')}
          value={`−${fmt(data.totalDiscount)}`}
        />
        <KpiCard
          label={t('vouchers.analytics.totalNet')}
          value={fmt(data.totalNet)}
          emphasis
        />
      </div>

      {/* Top vouchers */}
      {data.topVouchers.length > 0 && (
        <Card className="gap-0 py-0 p-2">
          <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('vouchers.analytics.topVouchersTitle')}
          </span>
          <Table className="mt-[3px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('vouchers.analytics.colName')}</TableHead>
                <TableHead>{t('vouchers.analytics.colCode')}</TableHead>
                <TableHead className="text-end">{t('vouchers.analytics.colUsages')}</TableHead>
                <TableHead className="text-end">{t('vouchers.analytics.colGross')}</TableHead>
                <TableHead className="text-end">{t('vouchers.analytics.colDiscount')}</TableHead>
                <TableHead className="text-end">{t('vouchers.analytics.colNet')}</TableHead>
                <TableHead className="text-end">{t('vouchers.analytics.colAvgPct')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topVouchers.map((v: VoucherStats) => (
                <TableRow key={v.voucherId}>
                  <TableCell>
                    <p className="text-[0.8125rem] font-semibold">
                      {v.voucherName}
                    </p>
                  </TableCell>
                  <TableCell>
                    {v.voucherCode ? (
                      <span className="inline-block rounded-md border border-solid border-field-line bg-field px-2 py-[3px] text-[11.5px] tracking-[0.04em] tabular-nums text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                        {v.voucherCode}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t('vouchers.autoCampaign')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {v.usageCount}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {fmt(v.totalGross)}
                  </TableCell>
                  {/* Remise = du TEXTE : encre `-ink`, pas la teinte vive (§2.4). */}
                  <TableCell className="text-end tabular-nums text-warning-ink">
                    −{fmt(v.totalDiscount)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums font-medium">
                    {fmt(v.totalNet)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums text-muted-foreground">
                    {v.avgDiscountPct}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  /** Met la valeur en teinte de réussite (le net encaissé). */
  emphasis?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, emphasis }) => (
  <div className="col-span-6 min-[900px]:col-span-3">
    <Card className="gap-0 py-0 p-2">
      <p className="block text-2xs font-semibold uppercase leading-[1.2] tracking-wide text-muted-foreground">
        {label}
      </p>
      {/* `-ink` et non la teinte vive : une valeur est du TEXTE (§2.4). */}
      <p className={cn('mt-[3px] text-sm font-semibold tabular-nums', emphasis ? 'text-success-ink' : 'text-foreground')} style={{ fontFamily: 'var(--font-display)' }}>
        {value}
      </p>
    </Card>
  </div>
);

function formatPeriod(from: string, to: string, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return `${fmt.format(new Date(from))} → ${fmt.format(new Date(to))}`;
}
