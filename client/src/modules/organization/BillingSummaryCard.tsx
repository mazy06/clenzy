import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Divider,
  Skeleton,
  Alert,
  Chip,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
} from '../../icons';
import { organizationsApi, BillingSummaryDto } from '../../services/api/organizationsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import SettingsSection from '../settings/components/SettingsSection';

interface Props {
  organizationId: number;
  refreshTrigger?: number;
}

const BILLING_PERIOD_LABELS: Record<string, string> = {
  MONTHLY: 'Mensuel',
  ANNUAL: 'Annuel',
  BIENNIAL: 'Bisannuel',
};

const ACCENT = '#4A9B8E';
const PRIMARY = '#6B8A9A';

export default function BillingSummaryCard({ organizationId, refreshTrigger = 0 }: Props) {
  const { t } = useTranslation();
  const { currencySymbol } = useCurrency();

  const formatCents = (cents: number): string => {
    return (cents / 100).toFixed(2).replace('.', ',') + ` ${currencySymbol}`;
  };
  const [summary, setSummary] = useState<BillingSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await organizationsApi.getBillingSummary(organizationId);
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setError(t('billing.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [organizationId, refreshTrigger, t]);

  if (loading) {
    return (
      <SettingsSection title={t('billing.title')} icon={ReceiptIcon} accent="accent">
        <Skeleton variant="rectangular" height={100} sx={{ borderRadius: '8px' }} />
      </SettingsSection>
    );
  }

  if (error) {
    return (
      <SettingsSection title={t('billing.title')} icon={ReceiptIcon} accent="accent">
        <Alert severity="error" sx={{ borderRadius: '8px' }}>
          {error}
        </Alert>
      </SettingsSection>
    );
  }

  if (!summary) return null;

  const hasDiscount = summary.billingPeriodDiscount < 1.0;
  const discountPercent = Math.round((1 - summary.billingPeriodDiscount) * 100);

  const periodChip = (
    <Chip
      label={BILLING_PERIOD_LABELS[summary.billingPeriod] || summary.billingPeriod}
      size="small"
      sx={{
        height: 22,
        fontSize: '0.6875rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        backgroundColor: `${PRIMARY}14`,
        color: PRIMARY,
        border: `1px solid ${PRIMARY}33`,
        borderRadius: '6px',
        '& .MuiChip-label': { px: 0.875 },
      }}
    />
  );

  return (
    <SettingsSection title={t('billing.title')} icon={ReceiptIcon} accent="accent" action={periodChip}>
      {/* Base plan */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.625 }}>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
          {t('billing.basePlan')}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'text.primary',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatCents(summary.basePriceCents)}
        </Typography>
      </Box>

      {/* Per-seat */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
          {t('billing.seats')} ({summary.billableSeats} × {formatCents(summary.perSeatPriceCents)})
        </Typography>
        <Typography
          sx={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'text.primary',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatCents(summary.seatsTotalCents)}
        </Typography>
      </Box>

      <Typography
        sx={{
          display: 'block',
          fontSize: '0.7rem',
          color: 'text.disabled',
          fontVariantNumeric: 'tabular-nums',
          mb: 1,
        }}
      >
        {summary.memberCount} {t('billing.members')} · {summary.freeSeats} {t('billing.included')}
      </Typography>

      <Divider sx={{ mb: 1, borderColor: 'divider' }} />

      {/* Total */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: hasDiscount ? 0.625 : 0 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary' }}>
          {t('billing.monthlyTotal')}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.95rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
            color: hasDiscount ? 'text.disabled' : ACCENT,
            ...(hasDiscount && { textDecoration: 'line-through' }),
          }}
        >
          {formatCents(summary.totalMonthlyCents)}
        </Typography>
      </Box>

      {/* Effective with discount */}
      {hasDiscount && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: ACCENT }}>
              {t('billing.effectiveMonthly')}
            </Typography>
            <Chip
              label={`-${discountPercent}%`}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                backgroundColor: `${ACCENT}1F`,
                color: ACCENT,
                border: `1px solid ${ACCENT}40`,
                borderRadius: '5px',
                fontVariantNumeric: 'tabular-nums',
                '& .MuiChip-label': { px: 0.625 },
              }}
            />
          </Box>
          <Typography
            sx={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: ACCENT,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.01em',
            }}
          >
            {formatCents(summary.effectiveMonthlyCents)}
          </Typography>
        </Box>
      )}
    </SettingsSection>
  );
}
