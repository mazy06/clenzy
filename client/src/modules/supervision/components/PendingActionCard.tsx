/* ============================================================
   <PendingActionCard> — une action « Attend ta validation »

   Carte d'action posée sur le canvas. Compte à rebours d'expiration en
   direct, « Pourquoi ? » dépliable, Valider / Modifier.

   THÈME : carte volontairement CLAIRE (crème) dans les deux modes — elle
   « poppe » sur le canvas indigo en sombre, et reste une carte claire en
   clair. Couleurs FIXES (pas de tokens) pour garantir un texte sombre
   lisible sur le crème quel que soit le thème de l'app.

   SÉCURITÉ : `reasoning`/`motif`/`title` rendus en TEXTE BRUT (jamais de
   HTML). Le serveur a déjà nettoyé le « Pourquoi ? » (aucun token / prompt
   / nom de modèle / PII).
   ============================================================ */

import { useState } from 'react';
import { Box, Button, Collapse, CircularProgress, IconButton } from '@mui/material';
import { Check, Edit, ChevronDown, Timer, HomeWork, VisibilityOff, CreditCard, Schedule } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
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
}

export function PendingActionCard({ action, onValidate, onEdit }: PendingActionCardProps) {
  const { t } = useTranslation();
  const cd = useCountdown(action.expiresAt);
  const [why, setWhy] = useState(false);
  const [resolving, setResolving] = useState(false);

  const meta = AGENT_META[action.agentId];
  const isReminder = action.kind === 'reminder';
  const isPayment = action.kind === 'payment';
  // Un rappel/paiement ne « périme » pas : ses 2 boutons restent toujours actionnables.
  const expired = !isReminder && !isPayment && cd.expired;
  const propertyName = 'propertyName' in action ? action.propertyName : undefined;

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
        bgcolor: '#FCFCFD',
        border: '1px solid #E9E9EE',
        borderRadius: '12px',
        p: '13px 14px',
        boxShadow: 'none',
        opacity: expired ? 0.72 : 1,
      }}
    >
      {/* en-tête : agent + statut + expiration */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
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
        <Box
          sx={{
            minWidth: 0,
            flex: 1,
            fontSize: 12,
            fontWeight: 500,
            color: '#1B2240',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {t(meta.nameKey)}
        </Box>
        {/* Statut à DROITE, sur la même ligne que le nom : « À régler »/« Rappel »
            pour paiement/rappel, sinon le compte à rebours d'expiration. */}
        {isPayment || isReminder ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#C6A15E', flexShrink: 0 }} />
            <Box sx={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '.01em', color: '#8A7250', whiteSpace: 'nowrap' }}>
              {isPayment ? t('supervision.payment.badge', 'À régler') : t('supervision.reminder.badge', 'Rappel')}
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: '7px',
              bgcolor: expired ? '#FBE3E3' : '#FBF0DF',
              color: expired ? '#C0392B' : '#B97C28',
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
      </Box>

      {propertyName && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, fontSize: 11.5, fontWeight: 400, color: '#6B7196' }}>
          <HomeWork size={13} />
          {propertyName}
        </Box>
      )}

      {/* titre + motif (texte brut) — plus de gras (sobriété demandée) */}
      <Box sx={{ fontSize: 12.5, fontWeight: 500, color: '#1B2240', lineHeight: 1.35, mb: isPayment ? 1.25 : 0.5 }}>
        {action.title}
      </Box>
      {/* En 'payment' : plus de ligne « Montant à régler » — le montant est
          affiché DIRECTEMENT dans le bouton « Régler ». */}
      {!isPayment && <Box sx={{ fontSize: 11.5, color: '#6B7196', mb: 1.25 }}>{action.motif}</Box>}

      {/* actions */}
      {expired ? (
        <Box sx={{ fontSize: 12, fontWeight: 500, color: '#C0392B' }}>{t('supervision.hitl.expired')}</Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            disableElevation
            disabled={resolving}
            onClick={validate}
            startIcon={
              resolving ? (
                <CircularProgress size={13} color="inherit" />
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
              boxShadow: 'none',
              bgcolor: 'var(--accent)',
              color: 'var(--on-accent)',
              '&:hover': { bgcolor: 'var(--accent-deep)', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: 'var(--accent-soft)', color: 'var(--accent)' },
            }}
          >
            {isPayment
              ? `${t('supervision.payment.settle', 'Régler')}${action.amountLabel ? ` ${action.amountLabel}` : ''}`
              : isReminder
                ? t('supervision.reminder.ack', 'Info reçue')
                : t('supervision.hitl.validate')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={resolving}
            onClick={edit}
            startIcon={isReminder ? <VisibilityOff size={14} /> : isPayment ? <Schedule size={14} /> : <Edit size={14} />}
            sx={{ textTransform: 'none', fontWeight: 500, fontSize: 12, color: '#5A5F73', borderColor: '#E4E4EA', '&:hover': { borderColor: '#CFCFD8', bgcolor: 'transparent' } }}
          >
            {isPayment
              ? t('supervision.payment.later', 'Plus tard')
              : isReminder
                ? t('supervision.reminder.mute', 'Ne plus afficher')
                : t('supervision.hitl.edit')}
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
        </Box>
      )}

      {/* « Pourquoi ? » — raisonnement métier (texte brut, déjà nettoyé serveur) */}
      <Collapse in={why} unmountOnExit>
        <Box sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid #ECECF1', fontSize: 11.5, lineHeight: 1.5, color: '#5A5F73' }}>
          {action.reasoning}
        </Box>
      </Collapse>
    </Box>
  );
}
