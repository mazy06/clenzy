import React from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';
import { useVoucherAnalytics } from '../../hooks/useBookingVouchers';
import type { VoucherStats } from '../../services/api/bookingVouchersApi';

// Palette Baitly partagee avec VouchersPage.
const ACCENT_TEAL = '#4A9B8E';
const WARM = '#D4A574';
const SOFT_BLUE = '#7BA3C2';
const NEUTRAL = '#8A8378';

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

  // Affichage conditionnel : si pas de data ou aucune usage, on rend juste
  // un compteur d'actifs (utile meme sans historique).
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        {t('vouchers.analytics.loadError')}
      </Alert>
    );
  }

  if (!data) return null;

  // Si pas d'usages historiques, on simplifie : juste le compteur d'actifs.
  if (data.totalUsages === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {t('vouchers.analytics.noUsageYet', { active: data.activeVouchersCount })}
        </Typography>
      </Paper>
    );
  }

  const currencyFormatter = new Intl.NumberFormat(currentLanguage, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
  const fmt = (v: string) => currencyFormatter.format(Number(v));

  const periodLabel = formatPeriod(data.from, data.to, currentLanguage);

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.6, fontSize: '0.6875rem' }}>
          {t('vouchers.analytics.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {periodLabel}
        </Typography>
      </Stack>

      {/* KPI cards */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <KpiCard
          label={t('vouchers.analytics.totalUsages')}
          value={data.totalUsages.toString()}
          color={ACCENT_TEAL}
        />
        <KpiCard
          label={t('vouchers.analytics.totalGross')}
          value={fmt(data.totalGross)}
          color={SOFT_BLUE}
        />
        <KpiCard
          label={t('vouchers.analytics.totalDiscount')}
          value={`−${fmt(data.totalDiscount)}`}
          color={WARM}
        />
        <KpiCard
          label={t('vouchers.analytics.totalNet')}
          value={fmt(data.totalNet)}
          color={ACCENT_TEAL}
          emphasis
        />
      </Grid>

      {/* Top vouchers */}
      {data.topVouchers.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.6875rem', letterSpacing: 0.5 }}>
            {t('vouchers.analytics.topVouchersTitle')}
          </Typography>
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
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem' }}>
                      {v.voucherName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {v.voucherCode ? (
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {v.voucherCode}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {t('vouchers.autoCampaign')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {v.usageCount}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(v.totalGross)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: WARM }}>
                    −{fmt(v.totalDiscount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    {fmt(v.totalNet)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: NEUTRAL }}>
                    {v.avgDiscountPct}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
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
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderLeft: `3px solid ${color}`,
        bgcolor: emphasis ? `${color}08` : 'transparent',
      }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ fontSize: '0.6875rem', letterSpacing: 0.5, lineHeight: 1.2, display: 'block' }}
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        sx={{
          fontVariantNumeric: 'tabular-nums',
          fontWeight: emphasis ? 700 : 600,
          color: emphasis ? color : 'text.primary',
          mt: 0.5,
        }}
      >
        {value}
      </Typography>
    </Paper>
  </Grid>
);

function formatPeriod(from: string, to: string, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return `${fmt.format(new Date(from))} → ${fmt.format(new Date(to))}`;
}
