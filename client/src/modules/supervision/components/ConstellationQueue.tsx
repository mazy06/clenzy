/* ============================================================
   <ConstellationQueue> — file de l'agent sélectionné (projection)

   Reproduction du dessin de la file de la projection (ProposalQueue /
   ProposalBlock) sur les VRAIES actions HITL : blocs `bg-card` posés
   sur le fond de page (la surface signale l'action), en-tête « point
   d'état · agent · échéance », action principale toujours visible,
   secondaires révélées au survol/focus (toujours visibles au tactile).

   Les GESTES restent ceux de la carte historique (PendingActionCard) :
   Régler (paiement Stripe), Appliquer (suggestion actionnable),
   Ajuster les tarifs (PRICE_DROP), Info reçue (rappel), Valider —
   et Ignorer / Plus tard / Ne plus afficher en secondaire, avec le
   « Pourquoi ? » (raisonnement métier) en repli.
   ============================================================ */

import { useMemo, useState } from 'react';
import { Button, Spinner } from '../../../components/ui';
import { Check, CreditCard, Edit, Schedule, Star, VisibilityOff } from '../../../icons';
import { Money } from '../../../components/Money';
import ReviewReplyDialog from '../../../components/baitly/ReviewReplyDialog';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
import { AGENT_META } from '../constants';
import { useCountdown, type Countdown } from '../core/useCountdown';
import type { AgentId, PendingAction, PortfolioPendingAction } from '../types';

type AnyAction = PendingAction | PortfolioPendingAction;

function formatRemaining(cd: Countdown, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (cd.expired) return t('supervision.hitl.expired');
  if (cd.hours >= 1) return `${cd.hours} ${t('supervision.hitl.unitHour')} ${String(cd.minutes).padStart(2, '0')}`;
  if (cd.minutes >= 1) return `${cd.minutes} ${t('supervision.hitl.unitMin')}`;
  return t('supervision.hitl.lessThanMin');
}

// ─── Motif d'avis structuré ──────────────────────────────────────────────────

interface ReviewMotif {
  rating: number;
  /** « Thomas R. · 18 mai 2026 · Booking Engine » */
  meta: string;
  quote: string;
  /** Recommandation de l'agent, après la citation. */
  rest: string;
}

/**
 * Le scanner d'avis compose son motif en UNE chaîne stable :
 * « Avis N/5 de X le DATE (SOURCE), sans réponse hôte. « citation » conseil ».
 * On la re-structure au rendu (étoiles + méta, citation en bloc, conseil) —
 * repli sur le texte brut si la forme ne correspond pas.
 */
export function parseReviewMotif(motif: string | undefined): ReviewMotif | null {
  if (!motif) return null;
  const match = motif.match(
    /^Avis\s+(\d)\/5\s+de\s+(.+?)\s+le\s+(.+?)\s*(?:\(([^)]+)\))?,\s*sans réponse hôte\.\s*«\s*([\s\S]+?)\s*»\s*([\s\S]*)$/,
  );
  if (!match) return null;
  const [, rating, author, date, source, quote, rest] = match;
  // BOOKING_ENGINE → « Booking Engine » : le jeton technique devient lisible.
  const sourceLabel = source
    ? source.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
    : null;
  return {
    rating: Number(rating),
    meta: [author, date, sourceLabel].filter(Boolean).join(' · '),
    quote,
    rest: rest.trim(),
  };
}

/** `{"reviewId":42}` (ReviewModerationScanner) → 42. Null si illisible. */
export function parseReviewId(actionParams: string | undefined): number | null {
  if (!actionParams) return null;
  try {
    const parsed = JSON.parse(actionParams) as { reviewId?: unknown };
    return typeof parsed.reviewId === 'number' ? parsed.reviewId : null;
  } catch {
    return null;
  }
}

export interface OpenReviewPayload {
  reviewId: number;
  actionId: string;
  guestName?: string;
  rating?: number;
}

interface QueueBlockProps {
  action: AnyAction;
  onValidate: (id: string) => void;
  onEdit: (id: string) => void;
  onAdjustPrice?: (action: AnyAction) => void;
  /** Carte d'avis : « Répondre » ouvre la modale de réponse (brouillon IA
   *  insérable OU réponse libre) au lieu de publier le brouillon à l'aveugle. */
  onOpenReview?: (payload: OpenReviewPayload) => void;
}

function QueueBlock({ action, onValidate, onEdit, onAdjustPrice, onOpenReview }: QueueBlockProps) {
  const { t } = useTranslation();
  const cd = useCountdown(action.expiresAt);
  const [why, setWhy] = useState(false);
  const [resolving, setResolving] = useState(false);

  const meta = AGENT_META[action.agentId];
  const isReminder = action.kind === 'reminder';
  const isPayment = action.kind === 'payment';
  const isApply = !isPayment && !isReminder && Boolean(action.applyActionType);
  const isPriceAdjust = isApply && action.applyActionType === 'PRICE_DROP'
    && Boolean(action.actionParams) && Boolean(onAdjustPrice);
  // Un rappel/paiement/action applicable ne « périme » pas (cf. carte historique).
  const expired = !isReminder && !isPayment && !isApply && cd.expired;
  const urgent = !isPayment && !isReminder && !expired && cd.hours < 1;
  // Pastille ambre = échéance sous l'heure OU carte paiement/rappel (« À
  // régler », « Rappel »). L'ATTACHE porte la même règle (data-urgent) : la
  // pastille et le trait disent toujours la même chose.
  const warnDot = urgent || isPayment || isReminder;
  const propertyName = 'propertyName' in action ? action.propertyName : undefined;
  // Carte d'avis : motif re-structuré (étoiles, citation, conseil).
  const review = !isPayment && !isReminder ? parseReviewMotif(action.motif) : null;
  // Réponse à un avis : jamais de publication à l'aveugle du brouillon IA —
  // « Répondre » ouvre la modale du dashboard (brouillon insérable + saisie).
  const reviewId = action.applyActionType === 'REVIEW_DRAFT_REPLY' && onOpenReview
    ? parseReviewId(action.actionParams)
    : null;

  // i18n des cartes de paiement : libellé et raisonnement construits au rendu.
  const rawTitle = action.title?.trim() || t('supervision.payment.fallbackTitle', 'Demande de service');
  const displayTitle = isPayment && action.serviceCategory === 'maintenance'
    ? `${t('supervision.payment.maintenancePrefix', 'Maintenance')} - ${rawTitle}`
    : (isPayment ? rawTitle : action.title);
  const displayReasoning = isPayment
    ? t('supervision.payment.reason', {
        title: displayTitle,
        defaultValue: 'Cette demande de service ({{title}}) n’est pas réglée. « Régler » ouvre le paiement Stripe sécurisé — aucun débit sans ta validation sur la page Stripe.',
      })
    : action.reasoning;

  const validate = () => {
    setResolving(true);
    onValidate(action.id);
  };
  const edit = () => {
    setResolving(true);
    onEdit(action.id);
  };

  return (
    <article
      data-pending-action={action.id}
      data-agent-id={action.agentId}
      data-urgent={warnDot || undefined}
      className={cn('group/proposal rounded-md bg-card p-3.5', expired && 'opacity-70')}
    >
      {/* En-tête : point d'état + agent + échéance (+ logement en portefeuille). */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn('size-1.5 shrink-0 rounded-[2px]', warnDot ? 'bg-warning' : 'bg-muted-foreground/30')}
          aria-hidden
        />
        <span className="font-medium text-foreground">{t(meta.nameKey)}</span>
        {isPayment ? (
          <span className="text-warning-ink">{t('supervision.payment.badge', 'À régler')}</span>
        ) : isReminder ? (
          <span className="text-warning-ink">{t('supervision.reminder.badge', 'Rappel')}</span>
        ) : expired ? (
          <span className="text-destructive">{t('supervision.hitl.expired')}</span>
        ) : (
          <span className={cn('tabular-nums', urgent && 'text-warning-ink')}>
            {t('supervision.hitl.expiresIn', { time: formatRemaining(cd, t) })}
          </span>
        )}
        {propertyName && <span className="ms-auto min-w-0 truncate">{propertyName}</span>}
      </div>

      <h3 className="m-0 mt-2 text-sm font-medium text-foreground [text-wrap:balance]">
        {displayTitle}
      </h3>
      {!isPayment && (review ? (
        /* Avis structuré (dessin projection) : étoiles + méta, citation en
           bloc, recommandation de l'agent — au lieu du paragraphe compact. */
        <div className="mt-1.5 flex flex-col gap-1.5">
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5 text-warning" aria-hidden>
              {[0, 1, 2, 3, 4].map((index) => (
                <Star
                  key={index}
                  size={12}
                  strokeWidth={1.75}
                  className={index < review.rating ? 'fill-current' : 'opacity-30'}
                />
              ))}
            </span>
            <span className="sr-only">{review.rating}/5</span>
            {review.meta}
          </p>
          <blockquote className="m-0 rounded-sm bg-muted px-2.5 py-2 text-xs text-foreground">
            {review.quote}
          </blockquote>
          {review.rest && (
            <p className="m-0 max-w-[60ch] text-xs text-muted-foreground">{review.rest}</p>
          )}
        </div>
      ) : (
        <p className="m-0 mt-1 max-w-[60ch] text-xs text-muted-foreground">{action.motif}</p>
      ))}

      {/* Actions : la principale toujours visible, les secondaires au survol ou
          au focus clavier — visibles en permanence au tactile, sinon elles
          seraient inatteignables. Une carte expirée n'a plus d'actions. */}
      {!expired && (
        <div className="mt-3 flex items-center gap-1">
          <Button
            size="sm"
            disabled={resolving}
            onClick={
              reviewId != null
                ? () =>
                    onOpenReview!({
                      reviewId,
                      actionId: action.id,
                      guestName: review?.meta.split(' · ')[0],
                      rating: review?.rating,
                    })
                : isPriceAdjust
                  ? () => onAdjustPrice!(action)
                  : validate
            }
          >
            {resolving ? (
              <Spinner className="size-[13px]" />
            ) : reviewId != null ? (
              <Edit size={15} />
            ) : isPayment ? (
              <CreditCard size={15} />
            ) : (
              <Check size={15} />
            )}
            {reviewId != null ? (
              t('dashboard.actionItems.reviewsAction', 'Répondre')
            ) : isPriceAdjust ? (
              t('supervision.price.adjustCta', 'Ajuster les tarifs')
            ) : isPayment ? (
              <>
                {t('supervision.payment.settle', 'Régler')}
                {action.amountEur != null && (
                  <span className="ms-0.5"><Money value={action.amountEur} from="EUR" /></span>
                )}
              </>
            ) : isApply ? (
              <>
                {t('supervision.apply.action', 'Appliquer')}
                {action.amountEur != null && (
                  <span className="ms-0.5">+<Money value={action.amountEur} from="EUR" decimals={0} /></span>
                )}
              </>
            ) : isReminder ? (
              t('supervision.reminder.ack', 'Info reçue')
            ) : (
              t('supervision.hitl.validate')
            )}
          </Button>
          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-focus-within/proposal:opacity-100 group-hover/proposal:opacity-100 [@media(hover:none)]:opacity-100">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              disabled={resolving}
              onClick={edit}
            >
              {isPayment ? <Schedule size={14} /> : <VisibilityOff size={14} />}
              {isPayment
                ? t('supervision.payment.later', 'Plus tard')
                : isReminder
                  ? t('supervision.reminder.mute', 'Ne plus afficher')
                  : t('supervision.apply.dismiss', 'Ignorer')}
            </Button>
            {displayReasoning && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                aria-expanded={why}
                onClick={() => setWhy((w) => !w)}
              >
                {t('supervision.hitl.why')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* « Pourquoi ? » — raisonnement métier (déjà nettoyé côté serveur). */}
      {why && displayReasoning && (
        <p className="m-0 mt-2 border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">
          {displayReasoning}
        </p>
      )}
    </article>
  );
}

export interface ConstellationQueueProps {
  /** Agent dont la file est ouverte (l'agent de tête du diagramme). */
  agent: AgentId | null;
  /** TOUTES les actions en attente — filtrées ici par agent, triées par échéance. */
  actions: AnyAction[];
  onValidate: (id: string) => void;
  onEdit: (id: string) => void;
  onAdjustPrice?: (action: AnyAction) => void;
}

export function ConstellationQueue({ agent, actions, onValidate, onEdit, onAdjustPrice }: ConstellationQueueProps) {
  const { t } = useTranslation();

  // Modale de réponse à un avis (composant du dashboard, réutilisé tel quel).
  // Montée SEULEMENT ouverte : elle porte des hooks liés au Router.
  const [openReview, setOpenReview] = useState<OpenReviewPayload | null>(null);

  const list = useMemo(
    () =>
      agent
        ? actions
            .filter((action) => action.agentId === agent)
            .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
        : [],
    [agent, actions],
  );

  if (!agent) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {t('supervision.board.queueTitle', 'À valider')} · {t(AGENT_META[agent].nameKey)} · {list.length}
      </h2>

      {list.map((action) => (
        <QueueBlock
          key={action.id}
          action={action}
          onValidate={onValidate}
          onEdit={onEdit}
          onAdjustPrice={onAdjustPrice}
          onOpenReview={setOpenReview}
        />
      ))}

      {list.length === 0 && (
        <p className="m-0 px-1 py-2 text-xs text-muted-foreground">
          {t('supervision.hitl.emptyAgent', 'Rien à valider pour cet agent. Il continue en autonomie.')}
        </p>
      )}

      {openReview && (
        <ReviewReplyDialog
          reviewId={openReview.reviewId}
          preview={{ guestName: openReview.guestName, rating: openReview.rating }}
          onClose={() => setOpenReview(null)}
          // Réponse publiée : la carte HITL est remplie, on l'écarte (dismiss
          // serveur) — surtout PAS onValidate, qui publierait le brouillon IA
          // une seconde fois par-dessus la réponse choisie.
          onPublished={() => onEdit(openReview.actionId)}
        />
      )}
    </section>
  );
}
