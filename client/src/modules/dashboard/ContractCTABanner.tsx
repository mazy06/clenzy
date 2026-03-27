import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Skeleton,
  Chip,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Handshake,
  ArrowForward,
  Close,
  AccountBalanceWallet,
  TrendingUp,
  PieChart,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import {
  managementContractsApi,
  type ManagementContract,
} from '../../services/api/managementContractsApi';
import { accountingApi, type OwnerPayout } from '../../services/api/accountingApi';
import { propertiesApi, type Property } from '../../services/api/propertiesApi';
import { STORAGE_KEYS, getItem, setItem } from '../../services/storageService';
import { useCurrency } from '../../hooks/useCurrency';

// ─── Couleurs Clenzy (brand) ───────────────────────────────────────────────
const C = {
  primary:      '#6B8A9A',
  success:      '#4A9B8E',
  warm:         '#D4A574',
  warmLight:    '#E8C9A8',
} as const;

// Couleurs par type de contrat
const TYPE_COLORS: Record<string, string> = {
  FULL_MANAGEMENT:  C.success,
  BOOKING_ONLY:     C.primary,
  MAINTENANCE_ONLY: C.warm,
  CUSTOM:           '#AB47BC',
};

/** Max contracts to show in the compact sidebar list */
const MAX_VISIBLE = 4;

// ─── Summary data computed from contracts + payouts ────────────────────────

interface ContractRow {
  id: number;
  propertyName: string;
  commissionRate: number;
  commissionAmount: number | null; // null = no payout data
}

interface SummaryData {
  totalCommissions: number;
  totalOwnerPayouts: number;
  hasPayoutData: boolean;
  avgRate: number;
  rows: ContractRow[];
}

function computeSummary(
  contracts: ManagementContract[],
  payouts: OwnerPayout[],
  propertyMap: Map<number, string>,
): SummaryData {
  // Group payouts by ownerId → total commission & net amounts
  const payoutByOwner = new Map<number, { commission: number; net: number }>();
  for (const p of payouts) {
    const prev = payoutByOwner.get(p.ownerId) ?? { commission: 0, net: 0 };
    payoutByOwner.set(p.ownerId, {
      commission: prev.commission + p.commissionAmount,
      net: prev.net + p.netAmount,
    });
  }

  const hasPayoutData = payouts.length > 0;
  let totalCommissions = 0;
  let totalOwnerPayouts = 0;

  const rows: ContractRow[] = contracts.map((c) => {
    const ownerData = payoutByOwner.get(c.ownerId);
    const commissionAmount = ownerData?.commission ?? null;
    if (ownerData) {
      totalCommissions += ownerData.commission;
      totalOwnerPayouts += ownerData.net;
    }
    return {
      id: c.id,
      propertyName: propertyMap.get(c.propertyId) ?? c.contractNumber,
      commissionRate: c.commissionRate,
      commissionAmount,
    };
  });

  const avgRate = contracts.length > 0
    ? contracts.reduce((s, c) => s + c.commissionRate, 0) / contracts.length
    : 0;

  return { totalCommissions, totalOwnerPayouts, hasPayoutData, avgRate, rows };
}

// ─── Formatting helpers ────────────────────────────────────────────────────

const fmtPercent = (v: number) => `${Math.round(v * 100)}%`;

// ─── Component ──────────────────────────────────────────────────────────────

const ContractCTABanner: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { convertAndFormat } = useCurrency();
  const fmtCurrency = (v: number) => convertAndFormat(v, 'EUR');

  const [dismissed, setDismissed] = useState(
    () => getItem(STORAGE_KEYS.CONTRACT_CTA_DISMISSED) === 'true',
  );
  const [contracts, setContracts] = useState<ManagementContract[]>([]);
  const [payouts, setPayouts] = useState<OwnerPayout[]>([]);
  const [propertyMap, setPropertyMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Only show for SUPER_ADMIN / SUPER_MANAGER (concierge management roles)
  const isAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  const isManager = user?.roles?.includes('SUPER_MANAGER') || false;
  const canManageContracts = isAdmin || isManager;

  useEffect(() => {
    if (!canManageContracts) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const activeContracts = await managementContractsApi.getAll({ status: 'ACTIVE' });
        if (cancelled) return;
        setContracts(activeContracts);

        // If active contracts exist, fetch financial data + properties in parallel
        if (activeContracts.length > 0) {
          const [allPayouts, properties] = await Promise.all([
            accountingApi.getPayouts().catch(() => [] as OwnerPayout[]),
            propertiesApi.getAll().catch(() => [] as Property[]),
          ]);
          if (cancelled) return;
          setPayouts(allPayouts);
          setPropertyMap(new Map(properties.map((p) => [p.id, p.name])));
        }
      } catch {
        if (!cancelled) setContracts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canManageContracts]);

  const handleDismiss = useCallback(() => {
    setItem(STORAGE_KEYS.CONTRACT_CTA_DISMISSED, 'true');
    setDismissed(true);
  }, []);

  const summary = useMemo(
    () => contracts.length > 0 ? computeSummary(contracts, payouts, propertyMap) : null,
    [contracts, payouts, propertyMap],
  );

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading && canManageContracts) {
    return (
      <Box sx={{ borderRadius: '12px', p: 2.5, bgcolor: 'background.paper' }}>
        <Skeleton variant="rectangular" height={100} sx={{ borderRadius: '8px' }} />
      </Box>
    );
  }

  if (!canManageContracts) return null;

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE RÉSUMÉ — Contrats actifs avec données financières
  // ═══════════════════════════════════════════════════════════════════════════
  if (summary && contracts.length > 0) {
    const visibleRows = summary.rows.slice(0, MAX_VISIBLE);
    const remaining = summary.rows.length - MAX_VISIBLE;

    return (
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: '12px',
          borderLeft: `4px solid ${C.success}`,
          boxShadow: isDark
            ? '0 2px 8px rgba(0,0,0,0.3)'
            : '0 2px 8px rgba(74,155,142,0.10)',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
        }}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Handshake sx={{ fontSize: 16, color: C.success }} />
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'text.secondary',
              }}
            >
              {t('dashboard.contractCta.activeTitle')}
            </Typography>
          </Box>
          <Chip
            label={contracts.length}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 700,
              bgcolor: isDark ? `${C.success}30` : `${C.success}18`,
              color: C.success,
            }}
          />
        </Box>

        {/* ── Financial summary (only if payouts exist) ───────────── */}
        {summary.hasPayoutData ? (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* Commissions */}
            <Box
              sx={{
                flex: 1,
                p: 1,
                borderRadius: '8px',
                bgcolor: isDark ? 'rgba(74,155,142,0.08)' : 'rgba(74,155,142,0.05)',
              }}
            >
              <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontWeight: 600, mb: 0.25 }}>
                {t('dashboard.contractCta.commissions')}
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: C.success, fontVariantNumeric: 'tabular-nums' }}>
                {fmtCurrency(summary.totalCommissions)}
              </Typography>
            </Box>
            {/* Owner payouts */}
            <Box
              sx={{
                flex: 1,
                p: 1,
                borderRadius: '8px',
                bgcolor: isDark ? 'rgba(107,138,154,0.08)' : 'rgba(107,138,154,0.05)',
              }}
            >
              <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontWeight: 600, mb: 0.25 }}>
                {t('dashboard.contractCta.ownerPayouts')}
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: C.primary, fontVariantNumeric: 'tabular-nums' }}>
                {fmtCurrency(summary.totalOwnerPayouts)}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              p: 1,
              borderRadius: '8px',
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(107,138,154,0.04)',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', fontWeight: 500 }}>
              {t('dashboard.contractCta.noPayouts')}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600, mt: 0.25 }}>
              {t('dashboard.contractCta.avgRate')}: {fmtPercent(summary.avgRate)}
            </Typography>
          </Box>
        )}

        {/* ── Contract rows ───────────────────────────────────────── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {visibleRows.map((row) => (
            <Tooltip key={row.id} title={row.propertyName} placement="left" arrow>
              <Box
                onClick={() => navigate('/contracts')}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1,
                  py: 0.5,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
                }}
              >
                {/* Color dot */}
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: TYPE_COLORS[contracts.find((c) => c.id === row.id)?.contractType ?? ''] ?? C.success,
                    flexShrink: 0,
                  }}
                />
                {/* Property name */}
                <Typography
                  sx={{
                    flex: 1,
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    color: 'text.primary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.propertyName}
                </Typography>
                {/* Rate chip */}
                <Typography
                  sx={{
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    color: 'text.disabled',
                    flexShrink: 0,
                  }}
                >
                  {fmtPercent(row.commissionRate)}
                </Typography>
                {/* Amount */}
                {row.commissionAmount != null && (
                  <Typography
                    sx={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      color: C.success,
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}
                  >
                    {fmtCurrency(row.commissionAmount)}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          ))}

          {remaining > 0 && (
            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', textAlign: 'center', mt: 0.25 }}>
              {t('dashboard.contractCta.moreContracts', { count: remaining })}
            </Typography>
          )}
        </Box>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto' }}>
          <Button
            size="small"
            onClick={() => navigate('/contracts')}
            endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
            sx={{
              fontSize: '0.68rem',
              fontWeight: 600,
              textTransform: 'none',
              color: C.success,
              px: 1,
              py: 0.25,
              minWidth: 0,
              borderRadius: '6px',
              '&:hover': { bgcolor: `${C.success}08` },
            }}
          >
            {t('dashboard.contractCta.viewAll')}
          </Button>
        </Box>
      </Box>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE CTA — Pas de contrats actifs
  // ═══════════════════════════════════════════════════════════════════════════
  if (dismissed) return null;

  const benefits = [
    { icon: <PieChart sx={{ fontSize: 16 }} />, label: t('dashboard.contractCta.benefit1') },
    { icon: <AccountBalanceWallet sx={{ fontSize: 16 }} />, label: t('dashboard.contractCta.benefit2') },
    { icon: <TrendingUp sx={{ fontSize: 16 }} />, label: t('dashboard.contractCta.benefit3') },
  ];

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: '12px',
        borderLeft: `4px solid ${C.warm}`,
        boxShadow: isDark
          ? '0 2px 8px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(212,165,116,0.12)',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        height: '100%',
      }}
    >
      {/* ── Header: title + dismiss ─────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1.5, flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: isDark
                ? 'linear-gradient(135deg, rgba(212,165,116,0.15), rgba(74,155,142,0.10))'
                : 'linear-gradient(135deg, rgba(212,165,116,0.12), rgba(74,155,142,0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Handshake sx={{ fontSize: 22, color: C.warm }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: 'text.primary', lineHeight: 1.3, mb: 0.25 }}>
              {t('dashboard.contractCta.title')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.5 }}>
              {t('dashboard.contractCta.subtitle')}
            </Typography>
          </Box>
        </Box>

        <IconButton
          size="small"
          onClick={handleDismiss}
          sx={{ color: 'text.disabled', ml: 0.5, '&:hover': { color: 'text.secondary' } }}
        >
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* ── Benefits list ───────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {benefits.map((b, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.75,
              borderRadius: '6px',
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(212,165,116,0.04)',
            }}
          >
            <Box
              sx={{
                color: i === 0 ? C.warm : i === 1 ? C.success : C.primary,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              {b.icon}
            </Box>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 500, color: 'text.secondary', lineHeight: 1.3 }}>
              {b.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── CTA Button ──────────────────────────────────────────────── */}
      <Button
        variant="contained"
        size="small"
        fullWidth
        onClick={() => navigate('/contracts')}
        endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
        sx={{
          mt: 'auto',
          background: `linear-gradient(135deg, ${C.warm} 0%, ${C.success} 100%)`,
          color: '#fff',
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: '8px',
          py: 0.9,
          fontSize: '0.8rem',
          boxShadow: isDark
            ? '0 2px 8px rgba(0,0,0,0.3)'
            : '0 2px 8px rgba(212,165,116,0.25)',
          '&:hover': {
            background: `linear-gradient(135deg, #C99560 0%, #3D8A7E 100%)`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
        }}
      >
        {t('dashboard.contractCta.cta')}
      </Button>
    </Box>
  );
});

ContractCTABanner.displayName = 'ContractCTABanner';

export default ContractCTABanner;
