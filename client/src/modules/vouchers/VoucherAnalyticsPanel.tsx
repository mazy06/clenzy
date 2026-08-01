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

// Tokens Signature : l'accent des KPI passe par la couleur de valeur, pas par un liseré.
const TOKEN_OK = 'var(--ok)';
const TOKEN_WARN = 'var(--warn)';
const TOKEN_INFO = 'var(--info)';
const TOKEN_MUTED = 'var(--muted)';

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
      <Card className="gap-0 py-0 p-3 mb-4 border-[var(--line)] bg-[var(--card)]">
        <p className="cn-text-body2 text-muted-foreground">
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
        <span className="cn-text-overline tracking-[0.06em] text-[10.5px] font-bold text-[var(--faint)]">
          {t('vouchers.analytics.title')}
        </span>
        <span className="cn-text-caption text-muted-foreground">
          {periodLabel}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-12 gap-[9px] mb-3">
        <KpiCard
          label={t('vouchers.analytics.totalUsages')}
          value={data.totalUsages.toString()}
          color={TOKEN_OK}
        />
        <KpiCard
          label={t('vouchers.analytics.totalGross')}
          value={fmt(data.totalGross)}
          color={TOKEN_INFO}
        />
        <KpiCard
          label={t('vouchers.analytics.totalDiscount')}
          value={`−${fmt(data.totalDiscount)}`}
          color={TOKEN_WARN}
        />
        <KpiCard
          label={t('vouchers.analytics.totalNet')}
          value={fmt(data.totalNet)}
          color={TOKEN_OK}
          emphasis
        />
      </div>

      {/* Top vouchers */}
      {data.topVouchers.length > 0 && (
        <Card className="gap-0 py-0 p-2 border-[var(--line)] bg-[var(--card)]">
          <span className="cn-text-overline text-[10.5px] tracking-[0.06em] font-bold text-[var(--faint)]">
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
                    <p className="cn-text-body2 font-semibold text-[0.8125rem]">
                      {v.voucherName}
                    </p>
                  </TableCell>
                  <TableCell>
                    {v.voucherCode ? (
                      <span className="cn-text-body2 inline-block text-[11.5px] tracking-[0.04em] tabular-nums text-[var(--body)] bg-[var(--field)] border border-solid border-[var(--field-line)] rounded-[6px] px-2 py-[3px]" style={{ fontFamily: 'var(--font-display)' }}>
                        {v.voucherCode}
                      </span>
                    ) : (
                      <span className="cn-text-caption text-muted-foreground">
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
                  {/* Couleur portee par une constante : une classe Tailwind ne peut
                      pas naitre d'une variable, elle passe donc par style. */}
                  <TableCell className="text-end tabular-nums" style={{ color: TOKEN_WARN }}>
                    −{fmt(v.totalDiscount)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums font-medium">
                    {fmt(v.totalNet)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums" style={{ color: TOKEN_MUTED }}>
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
  color: string;
  emphasis?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, color, emphasis }) => (
  <div className="col-span-6 min-[900px]:col-span-3">
    <Card className="gap-0 py-0 p-2 border-[var(--line)] bg-[var(--card)] transition-colors duration-200 hover:border-[var(--line-2)]">
      <p className="cn-text-body1 text-[10.5px] font-bold text-[var(--faint)] uppercase tracking-[0.06em] leading-[1.2] block">
        {label}
      </p>
      <h6 className="cn-text-h6 tabular-nums font-semibold mt-[3px]" style={{ fontFamily: 'var(--font-display)', color: emphasis ? color : 'var(--ink)' }}>
        {value}
      </h6>
    </Card>
  </div>
);

function formatPeriod(from: string, to: string, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return `${fmt.format(new Date(from))} → ${fmt.format(new Date(to))}`;
}
