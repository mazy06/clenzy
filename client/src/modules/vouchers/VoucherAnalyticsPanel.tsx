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
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: '14px', borderColor: 'var(--line)', bgcolor: 'var(--card)' }}>
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
        <Typography variant="overline" sx={{ letterSpacing: '0.06em', fontSize: '10.5px', fontWeight: 700, color: 'var(--faint)' }}>
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
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '14px', borderColor: 'var(--line)', bgcolor: 'var(--card)' }}>
          <Typography variant="overline" sx={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 700, color: 'var(--faint)' }}>
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
                      <Typography variant="body2" component="span" sx={{
                        display: 'inline-block', fontFamily: 'var(--font-display)', fontSize: '11.5px',
                        letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums', color: 'var(--body)',
                        bgcolor: 'var(--field)', border: '1px solid var(--field-line)', borderRadius: '6px',
                        px: '8px', py: '3px',
                      }}>
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
        borderRadius: '14px',
        borderColor: 'var(--line)',
        bgcolor: 'var(--card)',
        boxShadow: 'none',
        transition: 'border-color 0.18s cubic-bezier(.16,1,.3,1)',
        '&:hover': { borderColor: 'var(--line-2)' },
      }}
    >
      <Typography
        sx={{
          fontSize: '10.5px',
          fontWeight: 700,
          color: 'var(--faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          lineHeight: 1.2,
          display: 'block',
        }}
      >
        {label}
      </Typography>
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
    </Paper>
  </Grid>
);

function formatPeriod(from: string, to: string, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return `${fmt.format(new Date(from))} → ${fmt.format(new Date(to))}`;
}
