import React, { useMemo } from 'react';
import { Skeleton } from '../../components/ui';
import { useAiPricingPredictions } from '../../hooks/useAi';
import { useTranslation } from '../../hooks/useTranslation';
import type { AiPricingRecommendation } from '../../services/api/aiApi';
import { activeIntlLocaleGregorian } from '../../utils/activeLocale';

export interface BaitlyPricingAiSelection {
  propertyId: number;
  propertyName: string;
  currency: string;
  currentPrice: number | null;
  recommendation: AiPricingRecommendation;
}

export function proposalKey(propertyId: number, recommendation: AiPricingRecommendation) {
  return `${propertyId}:${recommendation.date}:${recommendation.suggestedPrice}`;
}

export function useBaitlyPricingProposals(propertyId: number, from: string, to: string, enabled: boolean) {
  const query = useAiPricingPredictions(propertyId, from, to, enabled);
  const proposals = useMemo(() => new Map((query.data ?? [])
    .filter((rec) => rec.date >= from && rec.date <= to && /^\d{4}-\d{2}-\d{2}$/.test(rec.date)
      && Number.isFinite(rec.suggestedPrice) && rec.suggestedPrice >= 0)
    .map((rec) => [rec.date, rec])), [query.data, from, to]);
  return { ...query, proposals };
}

export function pricingAmount(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(activeIntlLocaleGregorian(), { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export default function BaitlyPricingProposal({ selection, active, onSelect }: {
  selection: BaitlyPricingAiSelection;
  active: boolean;
  onSelect: (selection: BaitlyPricingAiSelection) => void;
}) {
  const { t } = useTranslation();
  const amount = new Intl.NumberFormat(activeIntlLocaleGregorian(), { maximumFractionDigits: 2 }).format(selection.recommendation.suggestedPrice);
  let unit = selection.currency;
  try { unit = new Intl.NumberFormat(activeIntlLocaleGregorian(), { style: 'currency', currency: selection.currency })
    .formatToParts(0).find(part => part.type === 'currency')?.value ?? unit; } catch { /* Le code devise reste lisible. */ }
  return <button type="button" className="bp-ai-proposal" aria-pressed={active}
    aria-label={t('baitlyPricing.ai.cellLabel', { defaultValue: 'Proposition IA : {{price}}, {{date}}, {{property}}',
      price: pricingAmount(selection.recommendation.suggestedPrice, selection.currency),
      date: selection.recommendation.date, property: selection.propertyName })}
    onClick={() => onSelect(selection)}>
    <span className="bp-ai-label">{t('baitlyPricing.ai.short', 'IA')}</span>
    <span className="bp-ai-amount">{amount}<span className="bp-ai-money-unit"> {unit}</span></span>
  </button>;
}

export function BaitlyPricingProposalSkeleton() {
  return <div className="bp-ai-proposal bp-ai-proposal-loading" aria-hidden="true">
    <span className="bp-ai-label">IA</span><Skeleton className="h-3 w-10" />
  </div>;
}
