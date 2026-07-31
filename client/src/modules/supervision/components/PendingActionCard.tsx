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
import { Spinner } from '../../../components/ui';
import { Box, Button, Collapse, IconButton } from '@mui/material';
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
    <Box
      data-pending-action={action.id}
      data-expired={expired ? '1' : undefined}
      sx={{
        width: '100%',
        bgcolor: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '12px',
        p: '13px 14px',
        boxShadow: 'none',
        opacity: expired ? 0.72 : 1,
      }}
    >
      {/* en-tête : agent + statut + expiration */}
      <div className="flex items-center gap-2 mb-1.5">
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: '9px',
            background: `${meta.color}14`,
            color: meta.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AgentIcon token={meta.icon} size={16} />
        </Box>
        <div className="min-w-0 flex-1 text-[12px] font-medium text-[var(--ink)] whitespace-nowrap overflow-hidden text-ellipsis">
          {t(meta.nameKey)}
        </div>
        {/* Statut à DROITE, sur la même ligne que le nom : « À régler »/« Rappel »
            pour paiement/rappel, sinon le compte à rebours d'expiration. */}
        {isPayment || isReminder ? (
          <div className="flex items-center gap-1 shrink-0">
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
            <div className="text-[10.5px] font-medium tracking-[.01em] text-[var(--warn)] whitespace-nowrap">
              {isPayment ? t('supervision.payment.badge', 'À régler') : t('supervision.reminder.badge', 'Rappel')}
            </div>
          </div>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: '7px',
              bgcolor: expired ? 'var(--err-soft)' : 'var(--warn-soft)',
              color: expired ? 'var(--err)' : 'var(--warn)',
              fontSize: 10.5,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}
          >
            <Timer size={12} />
            {expired ? t('supervision.hitl.expired') : t('supervision.hitl.expiresIn', { time: formatRemaining(cd, t) })}
          </Box>
        )}
      </div>

      {propertyName && (
        <div className="flex items-center gap-0.5 mb-1 text-[11.5px] font-normal text-[var(--muted)]">
          <HomeWork size={13} />
          {propertyName}
        </div>
      )}

      {/* titre + motif (texte brut) — plus de gras (sobriété demandée) */}
      <Box sx={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35, mb: isPayment ? 1.25 : 0.5 }}>
        {displayTitle}
      </Box>
      {/* En 'payment' : plus de ligne « Montant à régler » — le montant est
          affiché DIRECTEMENT dans le bouton « Régler ». */}
      {!isPayment && <div className="text-[11.5px] text-[var(--muted)] mb-2">{action.motif}</div>}

      {/* actions */}
      {expired ? (
        <div className="text-[12px] font-medium text-[var(--err)]">{t('supervision.hitl.expired')}</div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Button
            size="small"
            variant="contained"
            disableElevation
            disabled={resolving}
            onClick={isPriceAdjust ? () => onAdjustPrice!(action) : validate}
            startIcon={
              resolving ? (
                <Spinner className="size-[13px]" />
              ) : isPayment ? (
                <CreditCard size={15} />
              ) : (
                <Check size={15} />
              )
            }
            // Couleur = token d'accent de la session (var(--accent)), pas le
            // primary MUI figé sur l'indigo par défaut.
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              fontSize: 12,
              px: 1.5,
              boxShadow: 'none',
              bgcolor: 'var(--accent)',
              color: 'var(--on-accent)',
              // Icône collée au bord gauche par la marge négative par défaut de
              // MUI : on la neutralise pour un espacement icône/texte régulier.
              '& .MuiButton-startIcon': { ml: 0, mr: 0.75 },
              '&:hover': { bgcolor: 'var(--accent-deep)', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: 'var(--accent-soft)', color: 'var(--accent)' },
            }}
          >
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
            size="small"
            variant="outlined"
            color="inherit"
            disabled={resolving}
            onClick={edit}
            startIcon={isPayment ? <Schedule size={14} /> : <VisibilityOff size={14} />}
            sx={{ textTransform: 'none', fontWeight: 500, fontSize: 12, color: 'var(--ink)', borderColor: 'var(--line-2)', '&:hover': { borderColor: 'var(--muted)', bgcolor: 'transparent' } }}
          >
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
          <IconButton
            size="small"
            onClick={() => setWhy((w) => !w)}
            aria-expanded={why}
            aria-label={t('supervision.hitl.why')}
            sx={{ ml: 'auto', color: 'var(--accent)', '&:hover': { bgcolor: 'transparent' } }}
          >
            <ChevronDown size={16} style={{ transform: why ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </IconButton>
        </div>
      )}

      {/* « Pourquoi ? » — raisonnement métier (texte brut, déjà nettoyé serveur) */}
      <Collapse in={why} unmountOnExit>
        <div className="mt-2 pt-2 border-t border-[var(--line)] text-[11.5px] leading-[1.5] text-[var(--muted)]">
          {displayReasoning}
        </div>
      </Collapse>
    </Box>
  );
}
