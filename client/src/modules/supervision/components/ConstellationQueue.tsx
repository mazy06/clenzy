/* ============================================================
   <ConstellationQueue> — file de l'agent sélectionné (projection)

   Cartes HITL Baitly : identité de l'agent et échéance en en-tête,
   contenu hiérarchisé, pied d'actions toujours visible. Le bleu nuit
   relie la décision au noyau de la constellation.

   Les GESTES restent ceux de la carte historique (PendingActionCard) :
   Régler (paiement Stripe), Appliquer (suggestion actionnable),
   Ajuster les tarifs (PRICE_DROP), Info reçue (rappel), Valider —
   et Ignorer / Plus tard / Ne plus afficher en secondaire, avec le
   « Pourquoi ? » (raisonnement métier) en repli.
   ============================================================ */

import { useId, useMemo, useState } from 'react';
import { Button, Spinner } from '../../../components/ui';
import { Check, ChevronDown, CreditCard, Edit, Schedule, VisibilityOff } from '../../../icons';
import NavCountBadge from '../../../components/NavCountBadge';
import ReviewReplyDialog from '../../../components/baitly/ReviewReplyDialog';
import { verbFor } from './actionVerbs';
import { ActionDescription } from './ActionDescription';
import { ActionIllustratedHeading } from './ActionIllustration';
import { descriptionTitle, parseReviewId, parseReviewMotif } from '../core/actionDescription';
export { parseReviewId, parseReviewMotif } from '../core/actionDescription';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
import { AGENT_META } from '../constants';
import { useCountdown, type Countdown } from '../core/useCountdown';
import { additionalActionReasoning } from '../core/actionReasoning';
import { familyOf, opensModal } from './actionRegistry';
import { AgentIcon } from '../renderers/agentIcon';
import type { AgentId, PendingAction, PortfolioPendingAction } from '../types';
import '../supervision-surfaces.css';

type AnyAction = PendingAction | PortfolioPendingAction;

function formatRemaining(cd: Countdown, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (cd.expired) return t('supervision.hitl.expired');
  if (cd.hours >= 1) return `${cd.hours} ${t('supervision.hitl.unitHour')} ${String(cd.minutes).padStart(2, '0')}`;
  if (cd.minutes >= 1) return `${cd.minutes} ${t('supervision.hitl.unitMin')}`;
  return t('supervision.hitl.lessThanMin');
}

export interface OpenReviewPayload {
  reviewId: number;
  actionId: string;
  guestName?: string;
  rating?: number;
}

interface QueueBlockProps {
  action: AnyAction;
  compact?: boolean;
  onValidate: (id: string) => void;
  onEdit: (id: string) => void;
  onAdjustPrice?: (action: AnyAction) => void;
  /** Cartes « Planifier » : ouvre la modale (date + intervenant) au lieu d'agir. */
  onSchedule?: (action: AnyAction) => void;
  /** Cartes dont l'action engage sans rien à choisir : ouvre la confirmation. */
  onOpenActionModal?: (action: AnyAction) => void;
  /** Carte d'avis : « Répondre » ouvre la modale de réponse (brouillon IA
   *  insérable OU réponse libre) au lieu de publier le brouillon à l'aveugle. */
  onOpenReview?: (payload: OpenReviewPayload) => void;
}

function QueueBlock({ action, compact, onValidate, onEdit, onAdjustPrice, onSchedule, onOpenActionModal, onOpenReview }: QueueBlockProps) {
  const { t } = useTranslation();
  const cd = useCountdown(action.expiresAt);
  const [why, setWhy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const titleId = useId();
  const reasoningId = useId();

  const meta = AGENT_META[action.agentId];
  const isReminder = action.kind === 'reminder';
  const isPayment = action.kind === 'payment';
  const isApply = !isPayment && !isReminder && Boolean(action.applyActionType);
  const isPriceAdjust = isApply && action.applyActionType === 'PRICE_DROP'
    && Boolean(action.actionParams) && Boolean(onAdjustPrice);
  // « Planifier » : la date et l'intervenant se choisissent avant la création.
  const isSchedule = isApply && familyOf(action.applyActionType) === 'schedule' && Boolean(onSchedule);
  // Le CTA ouvre une modale : confirmation quand l'effet engage sans rien à
  // choisir, saisie quand l'action porte des paramètres devinés par l'agent.
  // Les cartes de paiement y ont droit aussi : elles étaient les seules à partir
  // au clic — vers une fenêtre Stripe, sans rien annoncer au préalable.
  const isConfirm = (isApply || isPayment) && !isSchedule
    && Boolean(onOpenActionModal) && opensModal(action.applyActionType);
  // Un rappel/paiement/action applicable ne « périme » pas (cf. carte historique).
  const expired = !isReminder && !isPayment && !isApply && cd.expired;
  const urgent = !isPayment && !isReminder && !expired && cd.hours < 1;
  // Échéance ambre sous l'heure ou paiement/rappel. Les attaches utilisent
  // la même règle via data-urgent pour conserver la sémantique du diagramme.
  const requiresAttention = urgent || isPayment || isReminder;
  const propertyName = 'propertyName' in action ? action.propertyName : undefined;
  // Carte d'avis : motif re-structuré (étoiles, citation, conseil).
  const review = !isPayment && !isReminder ? parseReviewMotif(action.motif) : null;
  // Réponse à un avis : jamais de publication à l'aveugle du brouillon IA —
  // « Répondre » ouvre la modale du dashboard (brouillon insérable + saisie).
  const reviewId = action.applyActionType === 'REVIEW_DRAFT_REPLY' && onOpenReview
    ? parseReviewId(action.actionParams)
    : null;
  // Verbe CTA du type (grammaire des verbes, Phase 1) — « Appliquer » hors registre.
  const verb = verbFor(action.applyActionType);

  // i18n des cartes de paiement : libellé et raisonnement construits au rendu.
  const rawTitle = action.title?.trim() || t('supervision.payment.fallbackTitle', 'Demande de service');
  const displayTitle = isPayment && action.serviceCategory === 'maintenance'
    ? `${t('supervision.payment.maintenancePrefix', 'Maintenance')} - ${rawTitle}`
    : (isPayment ? rawTitle : descriptionTitle(action));
  const displayReasoning = isPayment
    ? t('supervision.payment.reason', {
        title: displayTitle,
        defaultValue: 'Cette demande de service ({{title}}) n’est pas réglée. « Régler » ouvre le paiement Stripe sécurisé. Aucun débit sans ta validation sur la page Stripe.',
      })
    : additionalActionReasoning(action.motif, action.reasoning);

  const validate = () => {
    setResolving(true);
    onValidate(action.id);
  };
  const edit = () => {
    setResolving(true);
    onEdit(action.id);
  };

  const deadline = (
    <span className="baitly-hitl-deadline inline-flex w-fit items-center gap-1.5 tabular-nums">
      <Schedule size={12} aria-hidden />
      {isPayment
        ? t('supervision.payment.badge', 'À régler')
        : isReminder
          ? t('supervision.reminder.badge', 'Rappel')
          : expired
            ? t('supervision.hitl.expired')
            : t('supervision.hitl.expiresIn', { time: formatRemaining(cd, t) })}
    </span>
  );

  return (
    <article
      data-pending-action={action.id}
      data-agent-id={action.agentId}
      data-urgent={requiresAttention || undefined}
      data-expired={expired || undefined}
      aria-labelledby={titleId}
      aria-busy={resolving}
      className="baitly-hitl-card"
    >
      <div className="baitly-hitl-content">
        {!compact && <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <span className="baitly-hitl-agent inline-flex items-center gap-2 font-medium">
            <span aria-hidden className="inline-flex shrink-0"><AgentIcon token={meta.icon} size={16} strokeWidth={1.75} /></span>
            {t(meta.nameKey)}
          </span>
          <span className="ms-auto inline-flex">{deadline}</span>
        </div>}
        {propertyName && <p dir="auto" className="m-0 mt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">{propertyName}</p>}

        <ActionIllustratedHeading action={action}>
          <h3 id={titleId} dir="auto" className="m-0 text-[15px] leading-snug font-semibold text-foreground [overflow-wrap:anywhere] [text-wrap:pretty]">
            {displayTitle}
          </h3>
          {compact && deadline}
        </ActionIllustratedHeading>
        <ActionDescription action={action} />
      </div>

      {/* Les actions restent visibles au clavier, à la souris et au tactile. */}
      {!expired && (
        // `flex-wrap` : dans le tiroir d'agent (etroit, ~307 px utiles) la
        // rangee action principale + secondaires deborde ; en colonne large
        // elle tient sur une ligne et rien ne bouge.
        <div className="baitly-hitl-actions flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="baitly-hitl-primary"
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
                  : isSchedule
                    ? () => onSchedule!(action)
                    : isConfirm
                      ? () => onOpenActionModal!(action)
                      : validate
            }
          >
            {resolving ? (
              <Spinner className="size-[13px]" aria-hidden aria-label={undefined} role={undefined} />
            ) : reviewId != null ? (
              <Edit size={15} />
            ) : isPayment ? (
              <CreditCard size={15} />
            ) : isApply && !isPriceAdjust ? (
              <verb.Icon size={15} />
            ) : (
              <Check size={15} />
            )}
            {reviewId != null ? (
              t('dashboard.actionItems.reviewsAction', 'Répondre')
            ) : isPriceAdjust ? (
              t('supervision.price.adjustCta', 'Ajuster les tarifs')
            ) : isPayment ? (
              t('supervision.payment.settle', 'Régler')
            ) : isApply ? (
              t(verb.labelKey, verb.fallback)
            ) : isReminder ? (
              t('supervision.reminder.ack', 'Info reçue')
            ) : (
              t('supervision.hitl.validate')
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="baitly-hitl-secondary"
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
              className="baitly-hitl-secondary ms-auto"
              aria-expanded={why}
              aria-controls={reasoningId}
              onClick={() => setWhy((w) => !w)}
            >
              {t('supervision.hitl.why')}
              <ChevronDown size={14} aria-hidden className={cn('baitly-hitl-chevron', why && 'rotate-180')} />
            </Button>
          )}
        </div>
      )}

      {/* « Pourquoi ? » — raisonnement métier (déjà nettoyé côté serveur). */}
      {displayReasoning && (
        <p id={reasoningId} dir="auto" hidden={!why} className="baitly-hitl-reasoning m-0 text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          {displayReasoning}
        </p>
      )}
    </article>
  );
}

export interface ConstellationQueueProps {
  /** La liste voisine porte déjà l'identité et le nombre de décisions. */
  compact?: boolean;
  /** Agent dont la file est ouverte (l'agent de tête du diagramme). */
  agent: AgentId | null;
  /** TOUTES les actions en attente — filtrées ici par agent, triées par échéance. */
  actions: AnyAction[];
  onValidate: (id: string) => void;
  onEdit: (id: string) => void;
  onAdjustPrice?: (action: AnyAction) => void;
  /** Cartes « Planifier » : ouvre la modale (date + intervenant) au lieu d'agir. */
  onSchedule?: (action: AnyAction) => void;
  /** Cartes dont l'action engage sans rien à choisir : ouvre la confirmation. */
  onOpenActionModal?: (action: AnyAction) => void;
}

export function ConstellationQueue({ agent, actions, compact = false, onValidate, onEdit, onAdjustPrice, onSchedule, onOpenActionModal }: ConstellationQueueProps) {
  const { t } = useTranslation();
  const headingId = useId();

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
    <section aria-labelledby={headingId} className={cn('baitly-supervision-surface baitly-hitl-queue flex min-w-0 flex-col gap-3', compact && 'baitly-hitl-queue-compact')}>
      <header className={compact ? 'sr-only' : 'flex items-center gap-3 px-0.5 pb-1'}>
        <h2 id={headingId} className="m-0 text-sm font-semibold text-foreground">
          {t('supervision.board.queueTitle', 'À valider')}
          <span className="font-normal text-muted-foreground"> · {t(AGENT_META[agent].nameKey)}</span>
        </h2>
        <NavCountBadge count={list.length} tone="warning" className="ms-auto" />
      </header>

      {list.map((action) => (
        <QueueBlock
          key={action.id}
          action={action}
          compact={compact}
          onValidate={onValidate}
          onEdit={onEdit}
          onAdjustPrice={onAdjustPrice}
          onSchedule={onSchedule}
          onOpenActionModal={onOpenActionModal}
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
