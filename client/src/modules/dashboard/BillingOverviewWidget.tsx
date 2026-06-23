import React, { useState, useEffect } from 'react';
import { Box, Skeleton, Tooltip } from '@mui/material';
import { CalendarToday, DateRange } from '../../icons';
import RevenueByChannelCard, { type ChannelRevenue as CardChannel } from '../../components/RevenueByChannelCard';
import { dashboardBillingApi, type BillingOverview, type BillingScope } from '../../services/api/dashboardBillingApi';

/** Couleur de barre par canal (tokens de canal, repli muted). */
const CHANNEL_COLOR: Record<string, string> = {
  airbnb: 'var(--airbnb)',
  booking: 'var(--booking)',
  direct: 'var(--accent)',
  other: 'var(--muted)',
};

/** Bascule mois / année (icônes) de la portée des revenus par canal. */
const SCOPE_OPTIONS: { value: BillingScope; label: string; icon: React.ReactNode }[] = [
  { value: 'month', label: 'Mois en cours', icon: <CalendarToday size={14} strokeWidth={2} /> },
  { value: 'year', label: 'Année en cours', icon: <DateRange size={14} strokeWidth={2} /> },
];

function ScopeToggle({ scope, onChange }: { scope: BillingScope; onChange: (s: BillingScope) => void }) {
  return (
    <Box sx={{ display: 'inline-flex', gap: '2px', p: '3px', borderRadius: '9px', bgcolor: 'var(--field)', border: '1px solid var(--line-2)' }}>
      {SCOPE_OPTIONS.map((opt) => {
        const on = scope === opt.value;
        return (
          <Tooltip key={opt.value} title={opt.label} arrow>
            <Box
              component="button"
              type="button"
              aria-label={opt.label}
              aria-pressed={on}
              onClick={() => onChange(opt.value)}
              sx={{
                border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 24, borderRadius: '6px',
                bgcolor: on ? 'var(--card)' : 'transparent',
                color: on ? 'var(--accent)' : 'var(--muted)',
                boxShadow: on ? '0 1px 3px color-mix(in srgb, var(--ink) 12%, transparent)' : 'none',
                transition: 'background-color .14s, color .14s',
                '&:hover': { color: on ? 'var(--accent)' : 'var(--body)' },
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            >
              {opt.icon}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

/**
 * Widget dashboard « Revenus par canal » (réf. maquette billing). Remplace les
 * anciens widgets « Canaux de réservation » (ChannelHealth) et « Le saviez-vous »
 * (ContextualTips) dans la colonne droite. Données réelles org-scopées via
 * /dashboard/billing-overview (revenu réservé par source). Les reversements
 * propriétaires sont dans la carte fusionnée « Gestion & reversements »
 * (ContractCTABanner), pour éviter le doublon.
 */
interface BillingOverviewWidgetProps {
  /** Signalé une fois le fetch réglé (succès OU échec) — pilote la readiness dashboard. */
  onReady?: () => void;
}

export default function BillingOverviewWidget({ onReady }: BillingOverviewWidgetProps) {
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Portée des revenus par canal (toggle mois/année).
  const [scope, setScope] = useState<BillingScope>('month');

  useEffect(() => {
    let alive = true;
    // Pas de reset de `loading` sur changement de portée → la carte garde ses
    // données pendant le re-fetch (pas de skeleton qui clignote).
    dashboardBillingApi
      .getOverview(scope)
      .then((res) => { if (alive) { setData(res); setLoading(false); } })
      .catch(() => { if (alive) { setFailed(true); setLoading(false); } })
      .finally(() => { if (alive) onReady?.(); });
    return () => { alive = false; };
  }, [scope, onReady]);

  if (failed) return null; // dégradation silencieuse : on n'encombre pas le dashboard

  if (loading || !data) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Skeleton variant="rounded" height={150} sx={{ borderRadius: '14px' }} />
      </Box>
    );
  }

  const { channels } = data;
  const cardChannels: CardChannel[] = channels.map((c) => ({
    name: c.label,
    pct: Math.round(c.pct),
    amount: c.amount,
    color: CHANNEL_COLOR[c.source] ?? 'var(--muted)',
    comparePct: c.comparePct ?? undefined,
  }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <RevenueByChannelCard
        channels={cardChannels}
        headerAction={<ScopeToggle scope={scope} onChange={setScope} />}
      />
    </Box>
  );
}
