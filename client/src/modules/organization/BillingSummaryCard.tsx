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
} from '@mui/icons-material';
import { organizationsApi, BillingSummaryDto } from '../../services/api/organizationsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';

interface Props {
  organizationId: number;
  refreshTrigger?: number;
}

const BILLING_PERIOD_LABELS: Record<string, string> = {
  MONTHLY: 'Mensuel',
  ANNUAL: 'Annuel',
  BIENNIAL: 'Bisannuel',
};

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
      <Box sx={{ mt: 2 }}>
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!summary) return null;

  const hasDiscount = summary.billingPeriodDiscount < 1.0;
  const discountPercent = Math.round((1 - summary.billingPeriodDiscount) * 100);

  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <ReceiptIcon sx={{ color: 'primary.main', fontSize: 18 }} />
        <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
          {t('billing.title')}
        </Typography>
        <Chip
          label={BILLING_PERIOD_LABELS[summary.billingPeriod] || summary.billingPeriod}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.7rem', height: 20 }}
        />
      </Box>

      {/* Base plan */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          {t('billing.basePlan')}
        </Typography>
        <Typography variant="body2" fontWeight={500}>
          {formatCents(summary.basePriceCents)}
        </Typography>
      </Box>

      {/* Per-seat */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          {t('billing.seats')} ({summary.billableSeats} × {formatCents(summary.perSeatPriceCents)})
        </Typography>
        <Typography variant="body2" fontWeight={500}>
          {formatCents(summary.seatsTotalCents)}
        </Typography>
      </Box>

      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
        {summary.memberCount} {t('billing.members')} · {summary.freeSeats} {t('billing.included')}
      </Typography>

      <Divider sx={{ my: 1 }} />

      {/* Total */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: hasDiscount ? 0.5 : 0 }}>
        <Typography variant="body2" fontWeight={700}>
          {t('billing.monthlyTotal')}
        </Typography>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={hasDiscount ? { textDecoration: 'line-through', color: 'text.secondary' } : {}}
        >
          {formatCents(summary.totalMonthlyCents)}
        </Typography>
      </Box>

      {/* Effective with discount */}
      {hasDiscount && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" fontWeight={700} color="success.main">
            {t('billing.effectiveMonthly')}
            <Chip
              label={`-${discountPercent}%`}
              size="small"
              color="success"
              sx={{ ml: 0.5, fontSize: '0.65rem', height: 18 }}
            />
          </Typography>
          <Typography variant="body2" fontWeight={700} color="success.main">
            {formatCents(summary.effectiveMonthlyCents)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
