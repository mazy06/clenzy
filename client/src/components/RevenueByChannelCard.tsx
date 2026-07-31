import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { Money } from './Money';

/**
 * Carte « Revenus par canal » (réf. maquette Signature « .bl-chrow ») :
 * barre de répartition par canal + %. Comparaison optionnelle : si `comparePct`
 * est fourni, affiche le delta en points (▲/▼ coloré) vs période précédente.
 * Un slot `headerAction` permet d'y poser un sélecteur de période (PeriodSegmented).
 */
export interface ChannelRevenue {
  name: string;
  /** Part en % (0-100). */
  pct: number;
  /** Montant dans la devise d'affichage — rendu via <Money> (icône SAR/MAD). */
  amount?: number;
  /** Couleur de la barre (token/hex de canal). */
  color: string;
  /** Part en % sur la période de comparaison → affiche le delta si fourni. */
  comparePct?: number;
}

export interface RevenueByChannelCardProps {
  channels: ChannelRevenue[];
  title?: string;
  /** Slot à droite du titre (ex: <PeriodSegmented … /> pour comparer des périodes). */
  headerAction?: React.ReactNode;
}

export default function RevenueByChannelCard({
  channels,
  title = 'Revenus par canal',
  headerAction,
}: RevenueByChannelCardProps) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: '14px', bgcolor: 'var(--card)', borderColor: 'var(--line)', overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
          px: '17px', pt: '15px', pb: headerAction ? '11px' : '4px',
        }}
      >
        <p className="cn-text-body1 font-[var(--font-display)] text-[15px] font-semibold text-[var(--ink)] tracking-[-0.01em]">
          {title}
        </p>
        {headerAction}
      </Box>

      <Box sx={{ px: '17px', pb: '8px' }}>
        {channels.length === 0 && (
          <Typography sx={{ fontSize: '12px', color: 'var(--muted)', py: '14px' }}>
            Aucun revenu par canal sur la période.
          </Typography>
        )}
        {channels.map((c) => {
          const delta = c.comparePct != null ? Math.round((c.pct - c.comparePct) * 10) / 10 : null;
          return (
            <Box
              key={c.name}
              sx={{
                display: 'flex', alignItems: 'center', gap: '11px', py: '11px',
                borderTop: '1px solid var(--line)',
                '&:first-of-type': { borderTop: 0 },
              }}
            >
              <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--ink)] w-[74px] shrink-0">
                {c.name}
              </p>
              <div className="flex-1 h-[8px] rounded-[5px] bg-[var(--field)] overflow-hidden">
                <Box sx={{ height: '100%', borderRadius: '5px', width: `${c.pct}%`, backgroundColor: c.color, transition: 'width .3s var(--ease-out)', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }} />
              </div>
              <div className="shrink-0 text-end min-w-[66px]">
                {/* Montant (devise) en tête, % + delta en sous-ligne. */}
                <p className="cn-text-body1 font-[var(--font-display)] text-[13px] font-semibold text-[var(--ink)] leading-[1.2] tabular-nums">
                  {c.amount != null ? <Money value={c.amount} decimals={0} /> : `${c.pct}%`}
                </p>
                {(c.amount != null || (delta != null && delta !== 0)) && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '5px', mt: '1px' }}>
                    {c.amount != null && (
                      <span className="text-[10.5px] font-semibold text-[var(--muted)] tabular-nums">
                        {c.pct}%
                      </span>
                    )}
                    {delta != null && delta !== 0 && (
                      <Typography component="span" sx={{ fontSize: '10.5px', fontWeight: 700, color: delta > 0 ? 'var(--ok)' : 'var(--err)', fontVariantNumeric: 'tabular-nums' }}>
                        {delta > 0 ? '▲' : '▼'}{Math.abs(delta)} pt
                      </Typography>
                    )}
                  </Box>
                )}
              </div>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
