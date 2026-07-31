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
import { Money } from '../../components/Money';
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



export default function BillingSummaryCard({ organizationId, refreshTrigger = 0 }: Props) {
  const { t } = useTranslation();

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
        backgroundColor: 'var(--accent-soft)',
        color: 'var(--accent)',
        '& .MuiChip-label': { px: 0.875 },
      }}
    />
  );

  return (
    <SettingsSection title={t('billing.title')} icon={ReceiptIcon} accent="accent" action={periodChip}>
      {/* Base plan */}
      <div className="flex justify-between items-baseline mb-1">
        <p className="cn-text-body1 text-[0.8rem] text-muted-foreground">
          {t('billing.basePlan')}
        </p>
        <p className="cn-text-body1 text-[0.8rem] font-semibold text-foreground tabular-nums">
          <Money value={summary.basePriceCents / 100} />
        </p>
      </div>

      {/* Per-seat */}
      <div className="flex justify-between items-baseline mb-0.5">
        <p className="cn-text-body1 text-[0.8rem] text-muted-foreground">
          {t('billing.seats')} ({summary.billableSeats} × <Money value={summary.perSeatPriceCents / 100} />)
        </p>
        <p className="cn-text-body1 text-[0.8rem] font-semibold text-foreground tabular-nums">
          <Money value={summary.seatsTotalCents / 100} />
        </p>
      </div>

      <p className="cn-text-body1 block text-[0.7rem] text-muted-foreground opacity-60 tabular-nums mb-1.5">
        {summary.memberCount} {t('billing.members')} · {summary.freeSeats} {t('billing.included')}
      </p>

      <Divider sx={{ mb: 1, borderColor: 'divider' }} />

      {/* Total */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: hasDiscount ? 0.625 : 0 }}>
        <p className="cn-text-body1 text-[0.85rem] font-bold text-foreground">
          {t('billing.monthlyTotal')}
        </p>
        <Typography
          sx={{
            fontSize: '0.95rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
            color: hasDiscount ? 'text.disabled' : 'var(--ok)',
            ...(hasDiscount && { textDecoration: 'line-through' }),
          }}
        >
          <Money value={summary.totalMonthlyCents / 100} />
        </Typography>
      </Box>

      {/* Effective with discount */}
      {hasDiscount && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1">
            <p className="cn-text-body1 text-[0.85rem] font-bold text-[var(--ok)]">
              {t('billing.effectiveMonthly')}
            </p>
            <Chip
              label={`-${discountPercent}%`}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                backgroundColor: 'var(--ok-soft)',
                color: 'var(--ok)',
                fontVariantNumeric: 'tabular-nums',
                '& .MuiChip-label': { px: 0.625 },
              }}
            />
          </div>
          <p className="cn-text-body1 text-[0.95rem] font-bold text-[var(--ok)] tabular-nums tracking-[-0.01em]">
            <Money value={summary.effectiveMonthlyCents / 100} />
          </p>
        </div>
      )}
    </SettingsSection>
  );
}
