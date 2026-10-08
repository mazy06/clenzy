import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useBaitlyPricingProposals, pricingAmount, type BaitlyPricingAiSelection } from './BaitlyPricingProposal';
import { AgentPortrait } from '../supervision/renderers/AgentPortrait';
import { calendarPricingApi, type BulkRateOverrideData } from '../../services/api/calendarPricingApi';
import { dynamicPricingKeys } from '../../hooks/useDynamicPricing';
import { activeIntlLocaleGregorian } from '../../utils/activeLocale';
import { useNavigate } from 'react-router-dom';

export function proposalEndDate(date: string) {
  const next = new Date(date + 'T00:00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export default function BaitlyPricingAiPanel({ selection, propertyId, from, to, enabled, loading, onApply, onDismiss }: {
  selection: BaitlyPricingAiSelection | null;
  propertyId: number | null;
  from: string;
  to: string;
  enabled: boolean;
  loading: boolean;
  onApply: (data: BulkRateOverrideData) => Promise<void>;
  onDismiss: (selection: BaitlyPricingAiSelection) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState(false);
  const [applied, setApplied] = useState(false);
  const query = useBaitlyPricingProposals(selection?.propertyId ?? propertyId ?? 0, from, to, enabled);
  const pricing = useQuery({
    queryKey: dynamicPricingKeys.calendarPricing(selection?.propertyId ?? 0, from, to),
    queryFn: () => calendarPricingApi.getPricing(selection!.propertyId, from, to),
    enabled: !!selection,
  });
  const recommendation = selection && query.proposals.get(selection.recommendation.date);
  const currentPrice = selection ? pricing.data?.find(day => day.date === selection.recommendation.date)?.nightlyPrice ?? selection.currentPrice : null;
  const details = query.error as { details?: { errorCode?: string } } | null;
  const unconfigured = ['AI_NOT_CONFIGURED', 'AI_FEATURE_DISABLED'].includes(details?.details?.errorCode ?? '');
  const confidence = recommendation && Number.isFinite(recommendation.confidence) ? Math.max(0, Math.min(1, recommendation.confidence)) : null;
  const delta = recommendation && currentPrice != null && currentPrice > 0
    ? Math.round((recommendation.suggestedPrice - currentPrice) / currentPrice * 100) : null;
  const accept = async () => {
    if (!selection || !recommendation || loading) return;
    setSaveError(false);
    try {
      await onApply({ propertyId: selection.propertyId, from: recommendation.date,
        to: proposalEndDate(recommendation.date), nightlyPrice: recommendation.suggestedPrice, currency: selection.currency });
      setApplied(true);
    } catch { setSaveError(true); }
  };

  return <aside className="bp-ai-panel" aria-label={t('baitlyPricing.ai.panel', 'Agent Revenue et proposition tarifaire')}>
    <section className="bp-pricing-agent">
      <div className="bp-agent-identity"><AgentPortrait agentId="rev" /><div>
        <h2>{t('supervision.agents.rev.name', 'Revenue')}</h2>
        <p>{t('baitlyPricing.ai.agent', 'Agent IA')}<br />{t('supervision.agents.rev.role', 'Tarification dynamique')}</p>
      </div></div>
      <p>{t('baitlyPricing.ai.agentCopy', 'Je propose des prix adaptés à la demande et à l’occupation de vos logements.')}</p>
      <small>{t('baitlyPricing.ai.validation', 'Vos tarifs évoluent après votre validation.')}</small>
    </section>
    <div aria-live="polite">
      {query.isLoading && <div role="status"><p className="bp-ai-loading-status"><span className="bp-ai-progress" aria-hidden="true" />{t('baitlyPricing.ai.preparing', 'Revenue prépare les propositions… Les prix actuels restent inchangés.')}</p><Skeleton className="h-3 w-3/4 mt-5" /><Skeleton className="h-20 w-full mt-4" /><Skeleton className="h-3 w-full mt-4" /></div>}
      {query.isError && <Alert variant={unconfigured ? 'info' : 'destructive'}><AlertDescription>
        {unconfigured ? t('bookingEngine.ai.guidance.pricing.text') : t('baitlyPricing.ai.loadError', 'Les propositions IA sont indisponibles. Vos tarifs restent consultables.')}
        <Button variant="outline" size="sm" onClick={() => unconfigured ? navigate('/settings?tab=ai') : void query.refetch()}>
          {unconfigured ? t('bookingEngine.ai.guidance.pricing.button') : t('common.retry')}
        </Button>
      </AlertDescription></Alert>}
      {applied ? <p role="status" className="bp-ai-hint">{t('baitlyPricing.ai.applied', 'Le tarif a été appliqué à cette nuit.')}</p> :
      !query.isError && !query.isLoading && (selection && recommendation ? <>
        <div className="bp-ai-detail-heading"><span>{t('baitlyPricing.ai.proposal', 'Proposition tarifaire IA')}</span><span className="bp-ai-pending">{t('baitlyPricing.ai.pending', 'À valider')}</span></div>
        <h2 dir="auto">{selection.propertyName}</h2>
        <p className="bp-ai-date">{new Date(recommendation.date + 'T12:00:00').toLocaleDateString(activeIntlLocaleGregorian(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <div className="bp-ai-comparison">
          <div><small>{t('baitlyPricing.ai.current', 'Prix appliqué')}</small><strong>{currentPrice == null ? '–' : pricingAmount(currentPrice, selection.currency)}</strong></div>
          <span aria-hidden="true">→</span>
          <div><small>{t('baitlyPricing.ai.proposal', 'Proposition tarifaire IA')}</small><strong className="bp-ai-suggested">{pricingAmount(recommendation.suggestedPrice, selection.currency)}</strong>
          {delta != null && <small>{t('baitlyPricing.ai.relativeChange', { value: delta, defaultValue: '{{value}} % par rapport au tarif actuel' })}</small>}</div>
        </div>
        <h3>{t('baitlyPricing.ai.why', 'Pourquoi ce tarif ?')}</h3>
        <p className="bp-ai-explanation">{recommendation.explanation}</p>
        <div className="bp-ai-confidence"><span>{t('baitlyPricing.ai.confidence', 'Confiance de l’IA')}</span><strong>{confidence == null ? '–' : new Intl.NumberFormat(activeIntlLocaleGregorian(), { style: 'percent', maximumFractionDigits: 0 }).format(confidence)}{confidence != null && <> · {confidence >= .8 ? t('baitlyPricing.ai.highConfidence', 'Élevée') : confidence >= .6 ? t('baitlyPricing.ai.moderateConfidence', 'Modérée') : t('baitlyPricing.ai.lowConfidence', 'Faible')}</>}</strong></div>
        <p className="bp-ai-decision-note">{t('baitlyPricing.ai.decisionNote', 'Cette estimation reste une aide à la décision. Elle peut être acceptée ou laissée sans suite.')}</p>
        {saveError && <Alert variant="destructive"><AlertDescription>{t('baitlyPricing.saveError', 'Enregistrement impossible. Vos modifications sont conservées.')}</AlertDescription></Alert>}
        {pricing.isError && <Alert variant="destructive"><AlertDescription>{t('baitlyPricing.loadError', 'Impossible de charger les tarifs. Réessayez.')}<Button variant="outline" onClick={() => void pricing.refetch()}>{t('common.retry')}</Button></AlertDescription></Alert>}
        <Button className="bp-ai-apply" disabled={loading || pricing.isFetching || pricing.isError} onClick={() => void accept()}>
          {loading ? t('common.loading') : t('baitlyPricing.ai.apply', 'Appliquer à cette nuit')}
        </Button>
        <Button variant="ghost" className="bp-ai-dismiss" disabled={loading} onClick={() => onDismiss(selection)}>{t('baitlyPricing.ai.dismiss', 'Ignorer cette proposition')}</Button>
        <p className="bp-ai-hint">{t('baitlyPricing.ai.noChange', 'Aucune modification avant votre validation.')}</p>
      </> : <p className="bp-ai-hint">{!propertyId && !selection ? t('baitlyPricing.chooseProperty', 'Sélectionnez un logement') : query.proposals.size === 0
        ? t('baitlyPricing.aiEmpty', 'Aucune recommandation pour cette période.')
        : t('baitlyPricing.ai.pick', 'Cliquez sur une proposition IA dans le calendrier pour l’examiner.')}</p>)}
    </div>
  </aside>;
}
