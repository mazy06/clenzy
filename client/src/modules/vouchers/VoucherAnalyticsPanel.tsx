import React from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
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
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <span className="cn-text-overline tracking-[0.06em] text-[10.5px] font-bold text-[var(--faint)]">
          {t('vouchers.analytics.title')}
        </span>
        <span className="cn-text-caption text-muted-foreground">
          {periodLabel}
        </span>
      </Stack>

      {/* KPI cards */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
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
      </Grid>

      {/* Top vouchers */}
      {data.topVouchers.length > 0 && (
        <Card className="gap-0 py-0 p-2 border-[var(--line)] bg-[var(--card)]">
          <span className="cn-text-overline text-[10.5px] tracking-[0.06em] font-bold text-[var(--faint)]">
            {t('vouchers.analytics.topVouchersTitle')}
          </span>
          <Table size="small" sx={{ mt: 0.5 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('vouchers.analytics.colName')}</TableCell>
                <TableCell>{t('vouchers.analytics.colCode')}</TableCell>
                <TableCell align="right">{t('vouchers.analytics.colUsages')}</TableCell>
                <TableCell align="right">{t('vouchers.analytics.colGross')}</TableCell>
                <TableCell align="right">{t('vouchers.analytics.colDiscount')}</TableCell>
                <TableCell align="right">{t('vouchers.analytics.colNet')}</TableCell>
                <TableCell align="right">{t('vouchers.analytics.colAvgPct')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.topVouchers.map((v: VoucherStats) => (
                <TableRow key={v.voucherId} hover>
                  <TableCell>
                    <p className="cn-text-body2 font-semibold text-[0.8125rem]">
                      {v.voucherName}
                    </p>
                  </TableCell>
                  <TableCell>
                    {v.voucherCode ? (
                      <Typography variant="body2" component="span" sx={{
                        display: 'inline-block', fontFamily: 'var(--font-display)', fontSize: '11.5px',
                        letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums', color: 'var(--body)',
                        bgcolor: 'var(--field)', border: '1px solid var(--field-line)', borderRadius: '6px',
                        px: '8px', py: '3px',
                      }}>
                        {v.voucherCode}
                      </Typography>
                    ) : (
                      <span className="cn-text-caption text-muted-foreground">
                        {t('vouchers.autoCampaign')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {v.usageCount}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(v.totalGross)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: TOKEN_WARN }}>
                    −{fmt(v.totalDiscount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    {fmt(v.totalNet)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: TOKEN_MUTED }}>
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
  <Grid item xs={6} md={3}>
    <Card className="gap-0 py-0 p-2 border-[var(--line)] bg-[var(--card)] transition-colors duration-200 hover:border-[var(--line-2)]">
      <p className="cn-text-body1 text-[10.5px] font-bold text-[var(--faint)] uppercase tracking-[0.06em] leading-[1.2] block">
        {label}
      </p>
      <Typography
        variant="h6"
        sx={{
          fontFamily: 'var(--font-display)',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          color: emphasis ? color : 'var(--ink)',
          mt: 0.5,
        }}
      >
        {value}
      </Typography>
    </Card>
  </Grid>
);

function formatPeriod(from: string, to: string, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return `${fmt.format(new Date(from))} → ${fmt.format(new Date(to))}`;
}
