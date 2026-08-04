import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
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
 * suit le register "product" Baitly (Linear/Notion vibes). Hover →
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
  if (error) return null; // silent fail — pas d'erreur visible pour un nice-to-have

  const costLabel = loading ? '—' : formatCost(usage?.costUsd ?? 0);
  const tokensLabel = loading ? '—' : formatTokens((usage?.tokensIn ?? 0) + (usage?.tokensOut ?? 0));
  const periodLabel = usage?.period === 'today' ? "aujourd'hui" : 'ce mois';

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div
          className="inline-flex h-7 cursor-help select-none items-center gap-1 rounded-full border border-border bg-card px-2 text-xs font-medium tabular-nums text-muted-foreground transition-colors duration-150 hover:border-muted-foreground/40 motion-reduce:transition-none"
          aria-label={`Consommation assistant : ${costLabel} ${periodLabel}, ${tokensLabel} tokens`}
        >
          <span className="font-semibold text-foreground">{costLabel}</span>
          <span className="text-faint">· {tokensLabel} tokens</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        <UsageTooltipContent usage={usage} loading={loading} />
      </TooltipContent>
    </Tooltip>
  );
};

// ─── Tooltip detaille (breakdown par modele) ─────────────────────────────────

const UsageTooltipContent: React.FC<{
  usage: AssistantUsage | null;
  loading: boolean;
}> = ({ usage, loading }) => {
  if (loading) {
    return <span className="text-xs">Chargement…</span>;
  }
  if (!usage || usage.requestCount === 0) {
    return (
      <div className="min-w-[200px] text-[0.75rem]">
        Aucune consommation enregistree pour cette periode.
      </div>
    );
  }

  const periodLabel = usage.period === 'today' ? "Aujourd'hui" : 'Ce mois';
  const budgetPct =
    usage.monthlyBudget && usage.monthlyBudget > 0
      ? ((usage.tokensIn + usage.tokensOut) / usage.monthlyBudget) * 100
      : null;

  return (
    <div className="min-w-[240px] text-[0.75rem] leading-[1.5]">
      <span className="cn-text-overline text-[0.625rem] tracking-[0.8px] font-bold opacity-70">
        {periodLabel}
      </span>

      <div className="flex justify-between mt-0.5">
        <span>Cout total</span>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatCost(usage.costUsd, true)}
        </strong>
      </div>
      <div className="flex justify-between">
        <span>Tokens entree</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTokens(usage.tokensIn)}</span>
      </div>
      <div className="flex justify-between">
        <span>Tokens sortie</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTokens(usage.tokensOut)}</span>
      </div>
      <div className="flex justify-between">
        <span>Appels LLM</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{usage.requestCount}</span>
      </div>

      {budgetPct !== null && (
        <div className="mt-0.5 opacity-85">
          {budgetPct.toFixed(1)}% du budget mensuel
          {usage.monthlyBudget != null && ` (${formatTokens(usage.monthlyBudget)})`}
        </div>
      )}

      {usage.byModel.length > 0 && (
        <>
          <div className="mt-1.5 border-t border-current/20 pt-1">
            <span className="cn-text-overline text-[0.625rem] tracking-[0.8px] font-bold opacity-70">
              Par modele
            </span>
          </div>
          {usage.byModel.map((m) => (
            <div className="flex justify-between items-baseline" key={m.model}>
              <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shortenModelName(m.model)}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCost(m.costUsd, true)}</span>
            </div>
          ))}
        </>
      )}
    </div>
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
