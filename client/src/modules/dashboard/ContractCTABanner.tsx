import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Skeleton,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Handshake,
  ArrowForward,
  Close,
  AccountBalanceWallet,
  TrendingUp,
  PieChart,
} from '../../icons';
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
import { Money } from '../../components/Money';

// ─── Couleurs (tokens Signature) ────────────────────────────────────────────
const C = {
  primary:      'var(--accent)',
  success:      'var(--ok)',
  warm:         'var(--warn)',
  warmLight:    'var(--warn-soft)',
} as const;

// Couleurs par type de contrat
const TYPE_COLORS: Record<string, string> = {
  FULL_MANAGEMENT:  C.success,
  BOOKING_ONLY:     C.primary,
  MAINTENANCE_ONLY: C.warm,
  CUSTOM:           'var(--info)',
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
  /** Net déjà reversé aux propriétaires (statut PAID). */
  reversed: number;
  /** Net dû aux propriétaires, généré mais pas encore versé (PENDING + APPROVED). */
  toReverse: number;
  /** Net en cours de versement (statut PROCESSING). */
  inTransit: number;
  /** Échéance du prochain reversement planifié (periodEnd ISO le plus proche) ou null. */
  nextDate: string | null;
  hasPayoutData: boolean;
  avgRate: number;
  rows: ContractRow[];
}

function computeSummary(
  contracts: ManagementContract[],
  payouts: OwnerPayout[],
  propertyMap: Map<number, string>,
): SummaryData {
  // Périmètre = propriétaires sous contrat actif (un payout est par-owner par-période).
  const ownersWithContract = new Set(contracts.map((c) => c.ownerId));
  const scoped = payouts.filter((p) => ownersWithContract.has(p.ownerId));

  // Commission cumulée par owner (toutes périodes) → lignes + total commissions.
  const commissionByOwner = new Map<number, number>();
  for (const p of scoped) {
    commissionByOwner.set(p.ownerId, (commissionByOwner.get(p.ownerId) ?? 0) + p.commissionAmount);
  }

  // Net reversé ventilé par statut (source unique : les payouts déjà chargés).
  let reversed = 0;
  let toReverse = 0;
  let inTransit = 0;
  let nextDate: string | null = null;
  for (const p of scoped) {
    if (p.status === 'PAID') {
      reversed += p.netAmount;
    } else if (p.status === 'PENDING' || p.status === 'APPROVED') {
      toReverse += p.netAmount;
      // periodEnd la plus proche = prochaine échéance de reversement.
      if (!nextDate || p.periodEnd < nextDate) nextDate = p.periodEnd;
    } else if (p.status === 'PROCESSING') {
      inTransit += p.netAmount;
    }
  }

  const hasPayoutData = scoped.length > 0;

  const rows: ContractRow[] = contracts.map((c) => ({
    id: c.id,
    propertyName: propertyMap.get(c.propertyId) ?? c.contractNumber,
    commissionRate: c.commissionRate,
    commissionAmount: commissionByOwner.has(c.ownerId) ? commissionByOwner.get(c.ownerId)! : null,
  }));

  let totalCommissions = 0;
  for (const ownerId of ownersWithContract) {
    totalCommissions += commissionByOwner.get(ownerId) ?? 0;
  }

  const avgRate = contracts.length > 0
    ? contracts.reduce((s, c) => s + c.commissionRate, 0) / contracts.length
    : 0;

  return { totalCommissions, reversed, toReverse, inTransit, nextDate, hasPayoutData, avgRate, rows };
}

/** Échéance ISO yyyy-MM-dd → libellé FR lisible (ou null si pas de date). */
function formatNextDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ─── Formatting helpers ────────────────────────────────────────────────────

const fmtPercent = (v: number) => `${Math.round(v * 100)}%`;

// ─── Component ──────────────────────────────────────────────────────────────

const ContractCTABanner: React.FC<{ onReady?: () => void }> = React.memo(({ onReady }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const fmtCurrency = (v: number) => <Money value={v} from="EUR" />;

  const [dismissed, setDismissed] = useState(
    () => getItem(STORAGE_KEYS.CONTRACT_CTA_DISMISSED) === 'true',
  );
  const [contracts, setContracts] = useState<ManagementContract[]>([]);
  const [payouts, setPayouts] = useState<OwnerPayout[]>([]);
  const [propertyMap, setPropertyMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const readyFired = useRef(false);

  // Only show for SUPER_ADMIN / SUPER_MANAGER (concierge management roles)
  const isAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  const isManager = user?.roles?.includes('SUPER_MANAGER') || false;
  const canManageContracts = isAdmin || isManager;

  useEffect(() => {
    if (!canManageContracts) {
      setLoading(false);
      if (!readyFired.current) { readyFired.current = true; onReady?.(); }
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
        if (!cancelled) {
          setLoading(false);
          if (!readyFired.current) { readyFired.current = true; onReady?.(); }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [canManageContracts, onReady]);

  const handleDismiss = useCallback(() => {
    setItem(STORAGE_KEYS.CONTRACT_CTA_DISMISSED, 'true');
    setDismissed(true);
  }, []);

  const summary = useMemo(
    () => contracts.length > 0 ? computeSummary(contracts, payouts, propertyMap) : null,
    [contracts, payouts, propertyMap],
  );

  // Loading is handled by the parent DashboardSkeleton — no individual skeleton needed
  if (loading || !canManageContracts) return null;

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE RÉSUMÉ — Contrats actifs avec données financières
  // ═══════════════════════════════════════════════════════════════════════════
  if (summary && contracts.length > 0) {
    const visibleRows = summary.rows.slice(0, MAX_VISIBLE);
    const remaining = summary.rows.length - MAX_VISIBLE;

    // KPI fusionnés : commissions agence + ventilation des reversements par statut.
    const kpis = [
      { label: t('dashboard.contractCta.commissions'), value: summary.totalCommissions },
      { label: t('dashboard.contractCta.reversed', 'Reversé'), value: summary.reversed },
      { label: t('dashboard.contractCta.toReverse', 'À reverser'), value: summary.toReverse },
      { label: t('dashboard.contractCta.inTransit', 'En cours'), value: summary.inTransit },
    ];
    const nextLabel = summary.nextDate
      ? `${t('dashboard.contractCta.nextPayoutPrefix', 'Prochain reversement le')} ${formatNextDate(summary.nextDate)}`
      : t('dashboard.contractCta.noNextPayout', 'Aucun reversement planifié');

    return (
      <Box
        sx={{
          background: 'linear-gradient(135deg, var(--chrome-1), var(--chrome-2))',
          border: '1px solid var(--chrome-line)',
          borderRadius: '14px',
          p: '18px',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: '#fff' }}><Handshake size={15} strokeWidth={2} /></Box>
          <Typography component="span" sx={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--chrome-text)' }}>
            {t('dashboard.contractCta.mergedTitle', 'Gestion & reversements')}
          </Typography>
          <Chip
            label={contracts.length}
            size="small"
            sx={{
              ml: 'auto',
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              bgcolor: 'rgba(255,255,255,.12)',
              color: '#fff',
            }}
          />
        </Box>

        {/* ── Synthèse financière ─────────────────────────────────── */}
        {summary.hasPayoutData ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {kpis.map((kpi) => (
                <Box
                  key={kpi.label}
                  sx={{
                    minWidth: 0,
                    backgroundColor: 'rgba(255,255,255,.05)',
                    border: '1px solid var(--chrome-line)',
                    borderRadius: '10px',
                    p: '10px 12px',
                  }}
                >
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--chrome-faint)' }}>
                    {kpi.label}
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 600, mt: '3px', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCurrency(kpi.value)}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontSize: '12px', color: 'var(--chrome-text)' }}>{nextLabel}</Typography>
          </Box>
        ) : (
          <Box sx={{ p: '11px 12px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,.05)', border: '1px solid var(--chrome-line)', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'var(--chrome-faint)', fontWeight: 500 }}>
              {t('dashboard.contractCta.noPayouts')}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#fff', fontWeight: 600, mt: 0.25 }}>
              {t('dashboard.contractCta.avgRate')}: {fmtPercent(summary.avgRate)}
            </Typography>
          </Box>
        )}

        {/* ── Lignes de contrat (clic → /contracts) ───────────────── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
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
                  borderRadius: '8px',
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,.06)' },
                }}
              >
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: TYPE_COLORS[contracts.find((c) => c.id === row.id)?.contractType ?? ''] ?? C.success,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  sx={{
                    flex: 1,
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,.92)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.propertyName}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--chrome-faint)', flexShrink: 0 }}>
                  {fmtPercent(row.commissionRate)}
                </Typography>
                {row.commissionAmount != null && (
                  <Typography
                    sx={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      color: '#fff',
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
            <Typography sx={{ fontSize: '0.6rem', color: 'var(--chrome-faint)', textAlign: 'center', mt: 0.25 }}>
              {t('dashboard.contractCta.moreContracts', { count: remaining })}
            </Typography>
          )}
        </Box>

        {/* ── Footer : accès aux reversements ─────────────────────── */}
        <Button
          onClick={() => navigate('/billing')}
          disableRipple
          endIcon={<ArrowForward size={14} strokeWidth={2} />}
          sx={{
            mt: 'auto',
            width: '100%',
            height: 38,
            borderRadius: '10px',
            textTransform: 'none',
            fontSize: '12.5px',
            fontWeight: 600,
            color: '#fff',
            backgroundColor: 'rgba(255,255,255,.1)',
            border: 0,
            '&:hover': { backgroundColor: 'rgba(255,255,255,.16)' },
          }}
        >
          {t('dashboard.contractCta.viewPayouts', 'Voir les reversements')}
        </Button>
      </Box>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE CTA — Pas de contrats actifs
  // ═══════════════════════════════════════════════════════════════════════════
  if (dismissed) return null;

  const benefits = [
    { icon: <PieChart size={16} strokeWidth={1.75} />, label: t('dashboard.contractCta.benefit1') },
    { icon: <AccountBalanceWallet size={16} strokeWidth={1.75} />, label: t('dashboard.contractCta.benefit2') },
    { icon: <TrendingUp size={16} strokeWidth={1.75} />, label: t('dashboard.contractCta.benefit3') },
  ];

  return (
    <Box
      sx={{
        bgcolor: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
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
              borderRadius: 'var(--radius-md)',
              background: 'var(--warn-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Box component="span" sx={{ display: 'inline-flex', color: C.warm }}><Handshake size={22} strokeWidth={1.75} /></Box>
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
          <Close size={16} strokeWidth={1.75} />
        </IconButton>
      </Box>

      {/* ── Benefits list ───────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {benefits.map((b, i) => (
          <Box
            key={b.label}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.75,
              borderRadius: 'var(--radius-sm)',
              bgcolor: 'var(--hover)',
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
        endIcon={<ArrowForward size={16} strokeWidth={1.75} />}
        sx={{
          mt: 'auto',
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: 'var(--radius-md)',
          py: 0.9,
          fontSize: '0.8rem',
          boxShadow: 'none',
          '&:hover': {
            background: 'var(--accent-deep)',
            boxShadow: 'none',
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
