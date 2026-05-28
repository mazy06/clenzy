import React from 'react';
import { Box, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import type { AssistantUsage } from '../../../services/api/assistantApi';

interface AssistantUsageBadgeProps {
  usage: AssistantUsage | null;
  loading: boolean;
  error?: string | null;
}

/**
 * Badge compact "$0.12 ce mois · 1.2k tokens" affiche dans le header du chat.
 *
 * <p>Pattern visuel : pill discrete, low-contrast, sans bordure colorée — on
 * suit le register "product" Clenzy (Linear/Notion vibes). Hover →
 * tooltip riche avec breakdown par modele + budget.</p>
 *
 * <p>States :</p>
 * <ul>
 *   <li>loading : "—" (no skeleton — c'est petit)</li>
 *   <li>error : masque le badge entierement (silencieux, c'est nice-to-have)</li>
 *   <li>zero usage : "$0.00 ce mois" — affiche quand meme pour montrer la mecanique</li>
 * </ul>
 */
export const AssistantUsageBadge: React.FC<AssistantUsageBadgeProps> = ({
  usage,
  loading,
  error,
}) => {
  const theme = useTheme();
  if (error) return null; // silent fail — pas d'erreur visible pour un nice-to-have

  const costLabel = loading ? '—' : formatCost(usage?.costUsd ?? 0);
  const tokensLabel = loading ? '—' : formatTokens((usage?.tokensIn ?? 0) + (usage?.tokensOut ?? 0));
  const periodLabel = usage?.period === 'today' ? "aujourd'hui" : 'ce mois';

  return (
    <Tooltip
      arrow
      placement="bottom-end"
      title={<UsageTooltipContent usage={usage} loading={loading} />}
      enterDelay={300}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: 999,
          fontSize: '0.75rem',
          fontWeight: 500,
          color: theme.palette.text.secondary,
          bgcolor: alpha(theme.palette.text.primary, 0.04),
          cursor: 'help',
          transition: 'background-color 150ms ease-out',
          fontVariantNumeric: 'tabular-nums',
          userSelect: 'none',
          '&:hover': {
            bgcolor: alpha(theme.palette.text.primary, 0.08),
          },
        }}
        aria-label={`Consommation assistant : ${costLabel} ${periodLabel}, ${tokensLabel} tokens`}
      >
        <span style={{ fontWeight: 600 }}>{costLabel}</span>
        <Box component="span" sx={{ color: alpha(theme.palette.text.secondary, 0.5) }}>
          · {tokensLabel} tokens
        </Box>
      </Box>
    </Tooltip>
  );
};

// ─── Tooltip detaille (breakdown par modele) ─────────────────────────────────

const UsageTooltipContent: React.FC<{
  usage: AssistantUsage | null;
  loading: boolean;
}> = ({ usage, loading }) => {
  if (loading) {
    return <Typography variant="caption">Chargement…</Typography>;
  }
  if (!usage || usage.requestCount === 0) {
    return (
      <Box sx={{ minWidth: 200, fontSize: '0.75rem' }}>
        Aucune consommation enregistree pour cette periode.
      </Box>
    );
  }

  const periodLabel = usage.period === 'today' ? "Aujourd'hui" : 'Ce mois';
  const budgetPct =
    usage.monthlyBudget && usage.monthlyBudget > 0
      ? ((usage.tokensIn + usage.tokensOut) / usage.monthlyBudget) * 100
      : null;

  return (
    <Box sx={{ minWidth: 240, fontSize: '0.75rem', lineHeight: 1.5 }}>
      <Typography
        variant="overline"
        sx={{ fontSize: '0.625rem', letterSpacing: 0.8, fontWeight: 700, opacity: 0.7 }}
      >
        {periodLabel}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <span>Cout total</span>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatCost(usage.costUsd, true)}
        </strong>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Tokens entree</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTokens(usage.tokensIn)}</span>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Tokens sortie</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTokens(usage.tokensOut)}</span>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Appels LLM</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{usage.requestCount}</span>
      </Box>

      {budgetPct !== null && (
        <Box sx={{ mt: 0.5, opacity: 0.85 }}>
          {budgetPct.toFixed(1)}% du budget mensuel
          {usage.monthlyBudget != null && ` (${formatTokens(usage.monthlyBudget)})`}
        </Box>
      )}

      {usage.byModel.length > 0 && (
        <>
          <Box
            sx={{
              borderTop: (t) => `1px solid ${alpha(t.palette.common.white, 0.2)}`,
              mt: 1,
              pt: 0.75,
            }}
          >
            <Typography
              variant="overline"
              sx={{ fontSize: '0.625rem', letterSpacing: 0.8, fontWeight: 700, opacity: 0.7 }}
            >
              Par modele
            </Typography>
          </Box>
          {usage.byModel.map((m) => (
            <Box
              key={m.model}
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
            >
              <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shortenModelName(m.model)}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCost(m.costUsd, true)}</span>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
};

// ─── Formatters ──────────────────────────────────────────────────────────────

/**
 * Formate un cout USD pour le badge : "$0.12" (≤ 0.01 → "$0.001", < 0.0001 → "<$0.001").
 * Si {@code precise} = true, montre 4 decimales pour le tooltip.
 */
function formatCost(value: number | string, precise = false): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num) || num === 0) return '$0.00';
  if (precise) {
    if (num < 0.0001) return '<$0.0001';
    return `$${num.toFixed(num < 0.01 ? 4 : 2)}`;
  }
  if (num < 0.001) return '<$0.001';
  if (num < 0.01) return `$${num.toFixed(3)}`;
  return `$${num.toFixed(2)}`;
}

/** Formate un nombre de tokens : "1.2k", "234", "1.2M" */
function formatTokens(value: number): string {
  if (value === 0) return '0';
  if (value < 1000) return value.toString();
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(value < 10_000_000 ? 1 : 0)}M`;
}

/**
 * Raccourcit le nom du modele pour le tooltip : "claude-sonnet-4-20250514" →
 * "claude-sonnet-4" (tronque le suffix date qui apporte peu de valeur dans le
 * detail).
 */
function shortenModelName(model: string): string {
  // Strip trailing date suffix (YYYYMMDD) si present
  return model.replace(/-\d{8}$/, '');
}
