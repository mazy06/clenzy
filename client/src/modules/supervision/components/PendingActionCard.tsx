/* ============================================================
   <PendingActionCard> — une action « Attend ta validation »

   Carte d'action posée sur le canvas. Compte à rebours d'expiration en
   direct, « Pourquoi ? » dépliable, Valider / Modifier.

   THÈME : la carte suit le thème de l'app (clair/sombre) via les tokens
   signature (var(--card)/--line/--ink/--muted/--warn/--err…). Elle s'assombrit
   donc en mode sombre au lieu de rester crème. Les couleurs d'agent (meta.color)
   et l'accent (bouton primaire) restent des tokens/valeurs de marque.

   SÉCURITÉ : `reasoning`/`motif`/`title` rendus en TEXTE BRUT (jamais de
   HTML). Le serveur a déjà nettoyé le « Pourquoi ? » (aucun token / prompt
   / nom de modèle / PII).
   ============================================================ */

import { useState } from 'react';
import { cn } from '../../../utils/cn';
import { Spinner } from '../../../components/ui';
import { Button, Collapsible, CollapsibleContent } from '../../../components/ui';
import { Check, ChevronDown, Timer, HomeWork, VisibilityOff, CreditCard, Schedule } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { Money } from '../../../components/Money';
import { useCountdown, type Countdown } from '../core/useCountdown';
import { AgentIcon } from '../renderers/agentIcon';
import { AGENT_META } from '../constants';
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
}

export function PendingActionCard({ action, onValidate, onEdit, onAdjustPrice }: PendingActionCardProps) {
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
    <div className={cn('w-full bg-[var(--card)] border border-solid border-[var(--line)] rounded-[12px] p-[13px 14px]', expired ? 'opacity-72' : 'opacity-100')} style={{ boxShadow: 'none' }} data-pending-action={action.id} data-expired={expired ? '1' : undefined}>
      {/* en-tête : agent + statut + expiration */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: `${meta.color}14`, color: meta.color }}>
          <AgentIcon token={meta.icon} size={16} />
        </div>
        <div className="min-w-0 flex-1 text-[12px] font-medium text-[var(--ink)] whitespace-nowrap overflow-hidden text-ellipsis">
          {t(meta.nameKey)}
        </div>
        {/* Statut à DROITE, sur la même ligne que le nom : « À régler »/« Rappel »
            pour paiement/rappel, sinon le compte à rebours d'expiration. */}
        {isPayment || isReminder ? (
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-[6px] h-[6px] rounded-[50%] shrink-0" style={{ background: 'var(--warn)' }} />
            <div className="text-[10.5px] font-medium tracking-[.01em] text-[var(--warn)] whitespace-nowrap">
              {isPayment ? t('supervision.payment.badge', 'À régler') : t('supervision.reminder.badge', 'Rappel')}
            </div>
          </div>
        ) : (
          <div className={cn('flex items-center gap-[3px] px-1.5 py-[3px] rounded-[7px] text-[10.5px] font-medium whitespace-nowrap tabular-nums shrink-0', expired ? 'bg-[var(--err-soft)]' : 'bg-[var(--warn-soft)]', expired ? 'text-[var(--err)]' : 'text-[var(--warn)]')}>
            <Timer size={12} />
            {expired ? t('supervision.hitl.expired') : t('supervision.hitl.expiresIn', { time: formatRemaining(cd, t) })}
          </div>
        )}
      </div>

      {propertyName && (
        <div className="flex items-center gap-0.5 mb-1 text-[11.5px] font-normal text-[var(--muted)]">
          <HomeWork size={13} />
          {propertyName}
        </div>
      )}

      {/* titre + motif (texte brut) — plus de gras (sobriété demandée) */}
      <div className={cn('text-[12.5px] font-medium text-[var(--ink)] leading-[1.35]', isPayment ? 'mb-[7.5px]' : 'mb-[3px]')}>
        {displayTitle}
      </div>
      {/* En 'payment' : plus de ligne « Montant à régler » — le montant est
          affiché DIRECTEMENT dans le bouton « Régler ». */}
      {!isPayment && <div className="text-[11.5px] text-[var(--muted)] mb-2">{action.motif}</div>}

      {/* actions */}
      {expired ? (
        <div className="text-[12px] font-medium text-[var(--err)]">{t('supervision.hitl.expired')}</div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Button
            variant="default"
            size="sm"
            disabled={resolving}
            onClick={isPriceAdjust ? () => onAdjustPrice!(action) : validate}
          >
            {resolving ? (
              <Spinner className="size-[13px]" />
            ) : isPayment ? (
              <CreditCard size={15} />
            ) : (
              <Check size={15} />
            )}
            {isPriceAdjust ? (
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
                {t('supervision.apply.action', 'Appliquer')}
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
            className="ms-auto text-[var(--accent)] hover:bg-transparent hover:text-[var(--accent)]"
          >
            <ChevronDown size={16} style={{ transform: why ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </Button>
        </div>
      )}

      {/* « Pourquoi ? » — raisonnement métier (texte brut, déjà nettoyé serveur) */}
      {/* Collapsible sans declencheur interne : la fleche « Pourquoi ? » vit dans
          la rangee d'actions au-dessus et pilote l'etat `why`. */}
      <Collapsible open={why} onOpenChange={setWhy}>
        <CollapsibleContent>
          <div className="mt-2 pt-2 border-t border-solid border-[var(--line)] text-[11.5px] leading-[1.5] text-[var(--muted)]">
            {displayReasoning}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
