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
import { Box, Button, Collapse, CircularProgress } from '@mui/material';
import { Check, Edit, ChevronDown, Timer, HomeWork } from '../../../icons';
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
  const expired = cd.expired;
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
        bgcolor: '#FFFDF8',
        border: '1px solid #F0E0C2',
        borderRadius: '14px',
        p: '14px 15px',
        boxShadow: '0 22px 48px -16px rgba(12,18,40,.45)',
        opacity: expired ? 0.72 : 1,
      }}
    >
      {/* en-tête : agent + statut + expiration */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: meta.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 0 0 3px ${meta.color}22`,
          }}
        >
          <AgentIcon token={meta.icon} size={18} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              fontSize: 13,
              fontWeight: 800,
              color: '#1B2240',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {t(meta.nameKey)}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#F0B24B', flexShrink: 0 }} />
            <Box sx={{ fontSize: 11, fontWeight: 700, color: '#B97C28' }}>{t('supervision.hitl.toValidate')}</Box>
          </Box>
        </Box>
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
            fontWeight: 700,
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Timer size={12} />
          {expired ? t('supervision.hitl.expired') : t('supervision.hitl.expiresIn', { time: formatRemaining(cd, t) })}
        </Box>
      </Box>

      {propertyName && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, fontSize: 11.5, fontWeight: 600, color: '#6B7196' }}>
          <HomeWork size={13} />
          {propertyName}
        </Box>
      )}

      {/* titre + motif (texte brut) */}
      <Box sx={{ fontSize: 14, fontWeight: 800, color: '#1B2240', lineHeight: 1.35, mb: 0.5 }}>{action.title}</Box>
      <Box sx={{ fontSize: 12, color: '#6B7196', mb: 1.25 }}>{action.motif}</Box>

      {/* actions */}
      {expired ? (
        <Box sx={{ fontSize: 12, fontWeight: 700, color: '#C0392B' }}>{t('supervision.hitl.expired')}</Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="contained"
            disableElevation
            disabled={resolving}
            onClick={validate}
            startIcon={resolving ? <CircularProgress size={13} color="inherit" /> : <Check size={15} />}
            sx={{ textTransform: 'none', fontWeight: 800, color: '#fff', bgcolor: '#2FA37E', '&:hover': { bgcolor: '#268A6A' } }}
          >
            {t('supervision.hitl.validate')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={resolving}
            onClick={edit}
            startIcon={<Edit size={14} />}
            sx={{ textTransform: 'none', fontWeight: 700, color: '#4A4F6B', borderColor: '#E2DCC8' }}
          >
            {t('supervision.hitl.edit')}
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => setWhy((w) => !w)}
            aria-expanded={why}
            endIcon={<ChevronDown size={14} style={{ transform: why ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
            sx={{ textTransform: 'none', fontWeight: 700, color: '#5B5BD6', ml: 'auto' }}
          >
            {t('supervision.hitl.why')}
          </Button>
        </Box>
      )}

      {/* « Pourquoi ? » — raisonnement métier (texte brut, déjà nettoyé serveur) */}
      <Collapse in={why} unmountOnExit>
        <Box sx={{ mt: 1.25, pt: 1.25, borderTop: '1px solid #F0E6D0', fontSize: 12.5, lineHeight: 1.5, color: '#4A4F6B' }}>
          {action.reasoning}
        </Box>
      </Collapse>
    </Box>
  );
}
