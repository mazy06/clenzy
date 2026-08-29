/* ============================================================
   <PendingActionCard> — une action « Attend ta validation »

   Carte d'action posée sur le canvas. Compte à rebours d'expiration en
   direct, « Pourquoi ? » dépliable, Valider / Modifier.

   THÈME : la carte suit le thème de l'app (clair/sombre) via les jetons
   Baitly UI (bg-card / border-border / text-foreground / text-muted-foreground /
   warning / destructive). Elle s'assombrit donc en mode sombre au lieu de rester
   crème. Les couleurs d'agent (meta.color) restent des valeurs de marque.

   SÉCURITÉ : `reasoning`/`motif`/`title` rendus en TEXTE BRUT (jamais de
   HTML). Le serveur a déjà nettoyé le « Pourquoi ? » (aucun token / prompt
   / nom de modèle / PII).
   ============================================================ */

import { useState } from 'react';
import { cn } from '../../../utils/cn';
import { Spinner } from '../../../components/ui';
import { Badge, Button, Collapsible, CollapsibleContent } from '../../../components/ui';
import { Check, ChevronDown, Edit, Timer, HomeWork, VisibilityOff, CreditCard, Schedule } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { Money } from '../../../components/Money';
import { useCountdown, type Countdown } from '../core/useCountdown';
import { AgentIcon } from '../renderers/agentIcon';
import { AGENT_META } from '../constants';
import { parseReviewId, parseReviewMotif, type OpenReviewPayload } from './ConstellationQueue';
import { verbFor } from './actionVerbs';
import { familyOf, opensModal } from './actionRegistry';
import type { PendingAction, PortfolioPendingAction } from '../types';

function formatRemaining(cd: Countdown, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (cd.expired) return t('supervision.hitl.expired');
  if (cd.hours >= 1) return `${cd.hours} ${t('supervision.hitl.unitHour')} ${String(cd.minutes).padStart(2, '0')}`;
  if (cd.minutes >= 1) return `${cd.minutes} ${t('supervision.hitl.unitMin')}`;
  return t('supervision.hitl.lessThanMin');
}

export interface PendingActionCardProps {
  action: PendingAction | PortfolioPendingAction;
  onValidate: (id: string) => void;
  onEdit: (id: string) => void;
  /** Ouvre la modale d'ajustement tarifaire (cartes PRICE_DROP multi-segment). */
  onAdjustPrice?: (action: PendingAction | PortfolioPendingAction) => void;
  /** Carte d'avis : « Répondre » ouvre la modale de réponse (brouillon IA
   *  insérable OU réponse libre) au lieu de publier le brouillon à l'aveugle. */
  onOpenReview?: (payload: OpenReviewPayload) => void;
  /**
   * Cartes « Planifier » : ouvre la modale de planification au lieu de créer
   * l'intervention séance tenante. Sans elle, la date (lendemain 10 h) et
   * l'absence d'intervenant se corrigeaient APRÈS coup, dans un autre écran.
   */
  onSchedule?: (action: PendingAction | PortfolioPendingAction) => void;
  /**
   * Cartes dont l'action n'a rien à choisir mais engage (argent, annulation,
   * effacement, envoi vers un tiers) : ouvre la confirmation, qui nomme la
   * conséquence. Sans elle, le libellé du bouton était tout ce que l'opérateur
   * avait pour juger.
   */
  onOpenActionModal?: (action: PendingAction | PortfolioPendingAction) => void;
}

export function PendingActionCard({ action, onValidate, onEdit, onAdjustPrice, onOpenReview, onSchedule, onOpenActionModal }: PendingActionCardProps) {
  const { t } = useTranslation();
  const cd = useCountdown(action.expiresAt);
  const [why, setWhy] = useState(false);
  const [resolving, setResolving] = useState(false);

  const meta = AGENT_META[action.agentId];
  const isReminder = action.kind === 'reminder';
  const isPayment = action.kind === 'payment';
  // Suggestion actionnable (ex. baisse de prix) : « Appliquer » exécute l'action serveur.
  const isApply = !isPayment && !isReminder && Boolean(action.applyActionType);
  // Baisse tarifaire multi-segment : « Ajuster » ouvre une modale (revue + prévision + apply),
  // au lieu d'appliquer directement, pour laisser l'opérateur éditer les plages/remises.
  const isPriceAdjust = isApply && action.applyActionType === 'PRICE_DROP'
    && Boolean(action.actionParams) && Boolean(onAdjustPrice);
  // Réponse à un avis : jamais de publication à l'aveugle du brouillon IA —
  // « Répondre » ouvre la modale du dashboard (brouillon insérable + saisie).
  const reviewId = isApply && action.applyActionType === 'REVIEW_DRAFT_REPLY' && onOpenReview
    ? parseReviewId(action.actionParams)
    : null;
  // « Planifier » : la date et l'intervenant se choisissent AVANT de créer la
  // mission, pas après. Même parti que l'ajustement tarifaire ci-dessus.
  const isSchedule = isApply && familyOf(action.applyActionType) === 'schedule' && Boolean(onSchedule);
  // Le CTA ouvre une modale : confirmation quand l'effet engage sans rien à
  // choisir, saisie quand l'action porte des paramètres devinés par l'agent.
  // Les cartes de paiement y ont droit aussi : elles étaient les seules à partir
  // au clic — vers une fenêtre Stripe, sans rien annoncer au préalable.
  const isConfirm = (isApply || isPayment) && !isSchedule
    && Boolean(onOpenActionModal) && opensModal(action.applyActionType);
  // Verbe CTA du type (grammaire des verbes, Phase 1) — « Appliquer » hors registre.
  const verb = verbFor(action.applyActionType);
  // Un rappel/paiement/action applicable ne « périme » pas : boutons toujours actionnables.
  const expired = !isReminder && !isPayment && !isApply && cd.expired;
  const propertyName = 'propertyName' in action ? action.propertyName : undefined;

  // i18n des cartes de paiement (demande de service) : le backend ne renvoie que
  // des données (titre brut + catégorie), le libellé et le raisonnement sont
  // construits ici et se re-traduisent au changement de langue.
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
    <div
      className={cn('w-full rounded-lg border border-border bg-card p-3.5', expired ? 'opacity-70' : 'opacity-100')}
      data-pending-action={action.id}
      data-expired={expired ? '1' : undefined}
      // Ancrages de l'overlay d'attaches (SupervisionTethers) : agent porteur
      // et signal ambre — même règle que la pastille de la carte : échéance
      // sous l'heure OU carte paiement/rappel (« À régler », « Rappel »).
      data-agent-id={action.agentId}
      data-urgent={(isPayment || isReminder || (!expired && cd.hours < 1)) || undefined}
    >
      {/* en-tête : agent + statut + expiration */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="size-[30px] rounded-md flex items-center justify-center shrink-0" style={{ background: `${meta.color}14`, color: meta.color }}>
          <AgentIcon token={meta.icon} size={16} />
        </div>
        <div className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {t(meta.nameKey)}
        </div>
        {/* Statut à DROITE, sur la même ligne que le nom : « À régler »/« Rappel »
            pour paiement/rappel, sinon le compte à rebours d'expiration. */}
        {isPayment || isReminder ? (
          <div className="flex items-center gap-1 shrink-0">
            <div className="size-1.5 rounded-full shrink-0 bg-warning" />
            <div className="text-2xs font-medium whitespace-nowrap text-warning-ink">
              {isPayment ? t('supervision.payment.badge', 'À régler') : t('supervision.reminder.badge', 'Rappel')}
            </div>
          </div>
        ) : (
          <Badge variant={expired ? 'destructive' : 'warning'} className="shrink-0 tabular-nums">
            <Timer size={12} />
            {expired ? t('supervision.hitl.expired') : t('supervision.hitl.expiresIn', { time: formatRemaining(cd, t) })}
          </Badge>
        )}
      </div>

      {propertyName && (
        <div className="flex items-center gap-0.5 mb-1 text-2xs text-muted-foreground">
          <HomeWork size={13} />
          {propertyName}
        </div>
      )}

      {/* titre + motif (texte brut) — plus de gras (sobriété demandée) */}
      <div className={cn('text-xs font-medium leading-snug text-foreground', isPayment ? 'mb-2' : 'mb-0.5')}>
        {displayTitle}
      </div>
      {/* En 'payment' : plus de ligne « Montant à régler » — le montant est
          affiché DIRECTEMENT dans le bouton « Régler ». */}
      {!isPayment && <div className="mb-2 text-2xs text-muted-foreground">{action.motif}</div>}

      {/* actions */}
      {expired ? (
        <div className="text-xs font-medium text-destructive-ink">{t('supervision.hitl.expired')}</div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Button
            variant="default"
            size="sm"
            disabled={resolving}
            onClick={
              reviewId != null
                ? () => {
                    const review = parseReviewMotif(action.motif);
                    onOpenReview!({
                      reviewId,
                      actionId: action.id,
                      guestName: review?.meta.split(' · ')[0],
                      rating: review?.rating,
                    });
                  }
                : isPriceAdjust
                  ? () => onAdjustPrice!(action)
                  : isConfirm
                    ? () => onOpenActionModal!(action)
                    : isSchedule
                    ? () => onSchedule!(action)
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
              <>
                {t('supervision.payment.settle', 'Régler')}
                {action.amountEur != null && (
                  <span className="ms-0.5">
                    <Money value={action.amountEur} from="EUR" />
                  </span>
                )}
              </>
            ) : isApply ? (
              <>
                {t(verb.labelKey, verb.fallback)}
                {action.amountEur != null && (
                  <span className="ms-0.5">
                    +<Money value={action.amountEur} from="EUR" decimals={0} />
                  </span>
                )}
              </>
            ) : isReminder ? (
              t('supervision.reminder.ack', 'Info reçue')
            ) : (
              t('supervision.hitl.validate')
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={resolving}
            onClick={edit}
          >
            {isPayment ? <Schedule size={14} /> : <VisibilityOff size={14} />}
            {/* Le bouton secondaire ÉCARTE la suggestion (dismiss serveur) : aucun éditeur
                métier n'est câblé (onEditAction non fourni). On l'étiquette donc honnêtement
                « Ignorer » pour toute carte non-paiement/non-rappel — jamais « Modifier »,
                qui laissait croire à une édition et faisait disparaître la carte. */}
            {isPayment
              ? t('supervision.payment.later', 'Plus tard')
              : isReminder
                ? t('supervision.reminder.mute', 'Ne plus afficher')
                : t('supervision.apply.dismiss', 'Ignorer')}
          </Button>
          {/* « Pourquoi ? » réduit à la flèche seule, sur la MÊME ligne que les
              deux boutons (poussée à droite). Le libellé passe en aria-label. */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setWhy((w) => !w)}
            aria-expanded={why}
            aria-label={t('supervision.hitl.why')}
            className="ms-auto text-muted-foreground"
          >
            <ChevronDown size={16} style={{ transform: why ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </Button>
        </div>
      )}

      {/* Échéancier : l'acompte est une ÉTAPE de ce montant, pas une seconde
          demande. Il avait sa propre carte sur un autre agent, et rien ne disait
          que les deux sommes portaient sur le même chantier. */}
      {isPayment && action.depositEur != null && action.amountEur != null && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-2xs">
          <span className="text-muted-foreground">
            {action.paymentStage === 'deposit'
              ? t('supervision.payment.depositStage', 'Acompte, avant le début des travaux')
              : action.depositPaid
                ? t('supervision.payment.depositPaid', 'Acompte déjà versé')
                : t('supervision.payment.depositDue', 'Dont acompte à verser')}
          </span>
          <span className={cn('tabular-nums font-medium', action.depositPaid && 'line-through opacity-60')}>
            <Money value={action.depositEur} from="EUR" />
          </span>
        </div>
      )}

      {/* « Pourquoi ? » — raisonnement métier (texte brut, déjà nettoyé serveur) */}
      {/* Collapsible sans declencheur interne : la fleche « Pourquoi ? » vit dans
          la rangee d'actions au-dessus et pilote l'etat `why`. */}
      <Collapsible open={why} onOpenChange={setWhy}>
        <CollapsibleContent>
          <div className="mt-2 border-t border-border pt-2 text-2xs leading-relaxed text-muted-foreground">
            {displayReasoning}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
