import React, { useEffect, useState } from 'react';
import { Button, Skeleton } from '../../../components/ui';
import { Packshot } from '../../../components/baitly/FirstUseStage';
import { STAGE_IMAGES } from '../../../components/baitly/stageImages';
import {
  Check,
  Languages,
  RefreshCw,
  SendHorizontal,
  Sparkles,
  TriangleAlert,
  X,
  Zap,
} from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ConversationAnalysis } from '../../../services/api/conversationApi';
import { cn } from '../../../utils/cn';
import { sentimentPosition, sentimentTone } from './messagingModel';

/**
 * Copilote IA de la messagerie : lit le dernier message du voyageur, propose un
 * brouillon, le traduit. Il ASSISTE — rien ne part sans que l'opérateur ait
 * relu et envoyé lui-même.
 */

// ─── Sentiment et urgence ───────────────────────────────────────────────────

/**
 * Pastilles d'attention : seul ce qui demande un geste s'affiche. Un voyageur
 * neutre ou content ne mérite pas un badge de plus dans l'entête.
 */
export function AttentionBadges({ analysis }: { analysis?: ConversationAnalysis | null }) {
  const { t } = useTranslation();
  if (!analysis) return null;
  const tone = sentimentTone(analysis.sentiment);
  if (!analysis.urgent && tone !== 'negative') return null;
  return (
    <>
      {analysis.urgent && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-2xs font-semibold text-warning-ink">
          <Zap className="size-3" aria-hidden />
          {t('messagingHub.ai.urgent', 'Urgent')}
        </span>
      )}
      {tone === 'negative' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive-soft px-2 py-0.5 text-2xs font-semibold text-destructive-ink">
          <TriangleAlert className="size-3" aria-hidden />
          {t('messagingHub.ai.sentiment.negative', 'Mécontent')}
        </span>
      )}
    </>
  );
}

/** Jauge de sentiment (0 = très mécontent, 100 = très satisfait) pour le panneau de contexte. */
export function SentimentGauge({ analysis }: { analysis: ConversationAnalysis }) {
  const { t } = useTranslation();
  const tone = sentimentTone(analysis.sentiment);
  const position = sentimentPosition(analysis.score);
  const label = t(`messagingHub.ai.sentiment.${tone}`, tone === 'negative' ? 'Mécontent' : tone === 'positive' ? 'Satisfait' : 'Neutre');
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        {analysis.urgent && (
          <span className="inline-flex items-center gap-1 font-semibold text-warning-ink">
            <Zap className="size-3" aria-hidden />
            {t('messagingHub.ai.urgent', 'Urgent')}
          </span>
        )}
      </div>
      <div
        role="meter"
        aria-label={t('messagingHub.ai.sentiment.label', 'Sentiment du voyageur')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={position}
        aria-valuetext={label}
        className="relative h-1.5 rounded-full bg-gradient-to-r from-destructive/60 via-muted to-success/60"
      >
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-sm"
          style={{ insetInlineStart: `${position}%` }}
        />
      </div>
    </div>
  );
}

// ─── Barre d'actions ────────────────────────────────────────────────────────

interface CopilotBarProps {
  onSuggest: () => void;
  suggesting: boolean;
  onTranslate?: () => void;
  translating?: boolean;
  /** La traduction est déjà affichée : le bouton la masque. */
  translated?: boolean;
  disabled?: boolean;
}

/** Les deux gestes du copilote, au-dessus de la composition. */
export function CopilotBar({ onSuggest, suggesting, onTranslate, translating = false, translated = false, disabled = false }: CopilotBarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="cursor-pointer rounded-full border-primary/30 bg-primary-soft text-foreground hover:bg-primary-soft/70"
        onClick={onSuggest}
        disabled={disabled || suggesting}
      >
        <Sparkles className="size-3.5" aria-hidden />
        {suggesting ? t('messagingHub.ai.writing', 'Rédaction en cours…') : t('messagingHub.ai.suggest', 'Suggérer une réponse')}
      </Button>
      {onTranslate && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="cursor-pointer rounded-full text-muted-foreground"
          aria-pressed={translated}
          onClick={onTranslate}
          disabled={translating}
        >
          <Languages className="size-3.5" aria-hidden />
          {translated ? t('messagingHub.ai.hideTranslation', 'Masquer la traduction') : t('messagingHub.ai.translate', 'Traduire')}
        </Button>
      )}
    </div>
  );
}

// ─── Brouillon ──────────────────────────────────────────────────────────────

/** Attente de la génération : la carte garde sa place pour que le fil ne saute pas. */
export function AiDraftSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t('messagingHub.ai.writing', 'Rédaction en cours…')}
      className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-soft p-3"
    >
      <Packshot src={STAGE_IMAGES.assistant} size="sm" bare />
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

/** Échec de génération : on dit quoi faire (réessayer) plutôt que de se taire. */
export function AiDraftError({ onRetry, onDismiss }: { onRetry: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
      <span className="min-w-0 flex-1">{t('messagingHub.aiUnavailable', 'Suggestion IA indisponible')}</span>
      <Button type="button" size="xs" variant="ghost" className="cursor-pointer" onClick={onRetry}>
        <RefreshCw className="size-3.5" aria-hidden />
        {t('messagingHub.ai.retry', 'Réessayer')}
      </Button>
      <Button type="button" size="icon-xs" variant="ghost" className="cursor-pointer" onClick={onDismiss} aria-label={t('common.close', 'Fermer')}>
        <X className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}

interface AiDraftCardProps {
  /** `suggestion` : généré à la demande. `concierge` : pré-rédigé par le concierge IA. */
  kind: 'suggestion' | 'concierge';
  text: string;
  alternatives?: string[];
  tone?: string | null;
  language?: string | null;
  /** Reprend le texte dans la composition, où l'on peut l'éditer avant l'envoi. */
  onUse?: (text: string) => void;
  /** Concierge : envoie tel quel après validation de l'opérateur. */
  onSend?: () => void;
  sending?: boolean;
  sendDisabled?: boolean;
  onRegenerate?: () => void;
  regenerating?: boolean;
  onDismiss: () => void;
  dismissing?: boolean;
}

/**
 * Carte de brouillon. Elle se distingue d'un message envoyé par sa teinte et
 * son avatar de l'assistant, sans passer pour une alerte.
 *
 * <p>Une suggestion peut porter des variantes : on les parcourt sans rien
 * perdre, et c'est la variante affichée qui est reprise dans la composition.</p>
 */
export function AiDraftCard({
  kind,
  text,
  alternatives = [],
  tone,
  language,
  onUse,
  onSend,
  sending = false,
  sendDisabled = false,
  onRegenerate,
  regenerating = false,
  onDismiss,
  dismissing = false,
}: AiDraftCardProps) {
  const { t } = useTranslation();
  const variants = [text, ...alternatives.filter((alt) => alt && alt !== text)];
  const [index, setIndex] = useState(0);

  // Une régénération ou un nouveau brouillon repart de la réponse principale.
  useEffect(() => setIndex(0), [text]);

  const current = variants[Math.min(index, variants.length - 1)];
  const toneLabel = tone ? t(`messagingHub.ai.tones.${tone}`, tone) : null;

  return (
    <section
      aria-label={kind === 'concierge' ? t('concierge.draftTitle', 'Brouillon Concierge IA') : t('messagingHub.ai.draftTitle', 'Réponse suggérée')}
      className="rounded-xl border border-primary/20 bg-primary-soft p-3"
    >
      <div className="flex items-start gap-3">
        <Packshot src={STAGE_IMAGES.assistant} size="sm" bare />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              {kind === 'concierge' ? t('concierge.draftTitle', 'Brouillon Concierge IA') : t('messagingHub.ai.draftTitle', 'Réponse suggérée')}
            </span>
            {toneLabel && (
              <span className="rounded-full bg-card px-2 py-0.5 text-2xs font-medium text-muted-foreground">{toneLabel}</span>
            )}
            {language && (
              <span className="rounded-full bg-card px-2 py-0.5 text-2xs font-medium uppercase text-muted-foreground">{language}</span>
            )}
            <button
              type="button"
              onClick={onDismiss}
              disabled={dismissing}
              aria-label={kind === 'concierge' ? t('common.reject', 'Rejeter') : t('common.close', 'Fermer')}
              className="ms-auto inline-flex size-6 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>

          <p dir="auto" className="m-0 max-h-40 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {current}
          </p>

          {variants.length > 1 && (
            <div className="mt-2 flex items-center gap-1" role="group" aria-label={t('messagingHub.ai.variants', 'Variantes')}>
              {variants.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={i === index}
                  aria-label={t('messagingHub.ai.variant', 'Variante {{n}}', { n: i + 1 })}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'inline-flex size-6 cursor-pointer items-center justify-center rounded-full border text-2xs font-semibold tabular-nums transition-colors motion-reduce:transition-none',
                    i === index
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {kind === 'concierge' ? (
              <>
                <Button type="button" size="sm" className="cursor-pointer" onClick={onSend} disabled={sending || sendDisabled}>
                  <SendHorizontal className="size-3.5 rtl:-scale-x-100" aria-hidden />
                  {t('common.send', 'Envoyer')}
                </Button>
                {onUse && (
                  <Button type="button" size="sm" variant="ghost" className="cursor-pointer" onClick={() => onUse(current)}>
                    {t('common.edit', 'Éditer')}
                  </Button>
                )}
              </>
            ) : (
              <>
                {onUse && (
                  <Button type="button" size="sm" className="cursor-pointer" onClick={() => onUse(current)}>
                    <Check className="size-3.5" aria-hidden />
                    {t('messagingHub.ai.use', 'Utiliser')}
                  </Button>
                )}
                {onRegenerate && (
                  <Button type="button" size="sm" variant="ghost" className="cursor-pointer" onClick={onRegenerate} disabled={regenerating}>
                    <RefreshCw className={cn('size-3.5', regenerating && 'animate-spin motion-reduce:animate-none')} aria-hidden />
                    {t('messagingHub.ai.regenerate', 'Régénérer')}
                  </Button>
                )}
              </>
            )}
            <span className="ms-auto text-2xs text-muted-foreground">
              {t('messagingHub.ai.reviewHint', 'À relire avant l’envoi')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
