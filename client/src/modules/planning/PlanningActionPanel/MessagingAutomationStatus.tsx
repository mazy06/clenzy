import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bolt, CheckCircle, Close, Settings, Warning, AccessTime } from '../../../icons';
import { guestMessagingApi } from '../../../services/api/guestMessagingApi';

// ─── Messagerie automatique (maquette Signature — onglet Opérations) ─────────
//
// Section « MESSAGERIE AUTOMATIQUE » : overline var(--faint) + lignes
// ✓ var(--ok) (ou ✕ var(--faint)) + libellé + détail à droite. Reprend tel
// quel l'état config (check-in / check-out / destinataire) historiquement
// affiché dans l'onglet Infos — déplacé ici, aucune logique nouvelle.

const OVERLINE_SX = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--faint)',
};

interface MessagingAutomationStatusProps {
  guestEmail?: string | null;
  source?: string | null;
}

const MessagingAutomationStatus: React.FC<MessagingAutomationStatusProps> = ({ guestEmail, source }) => {
  const navigate = useNavigate();
  const { data: config, isLoading } = useQuery({
    queryKey: ['messaging-automation-config'],
    queryFn: () => guestMessagingApi.getConfig(),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const hasEmail = Boolean(guestEmail && guestEmail.trim() && guestEmail.includes('@'));
  const isAnonymizedIcal = (source || '').toLowerCase() === 'airbnb'
    || (source || '').toLowerCase() === 'booking'
    || (source || '').toLowerCase().includes('ical');

  const checkInOk = config?.autoSendCheckIn && config?.checkInTemplateId != null;
  const checkOutOk = config?.autoSendCheckOut && config?.checkOutTemplateId != null;

  const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: '5px' }}>
      <Box component="span" sx={{ display: 'inline-flex', color: ok ? 'var(--ok)' : 'var(--faint)', flexShrink: 0 }}>
        {ok ? <CheckCircle size={13} strokeWidth={2} /> : <Close size={13} strokeWidth={2} />}
      </Box>
      <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink)', flexShrink: 0 }}>
        {label}
      </Box>
      <Box
        component="span"
        sx={{
          ml: 'auto',
          fontSize: '0.6875rem',
          color: 'var(--muted)',
          textAlign: 'right',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {detail}
      </Box>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)' }}>
          <Bolt size={13} strokeWidth={1.75} />
        </Box>
        <Box component="span" sx={{ ...OVERLINE_SX, flex: 1 }}>Messagerie automatique</Box>
        <Tooltip title="Configurer dans Paramètres">
          <IconButton
            size="small"
            onClick={() => navigate('/settings?section=messaging')}
            sx={{ p: 0.375, color: 'var(--muted)', '&:hover': { color: 'var(--ink)', backgroundColor: 'var(--hover)' } }}
          >
            <Settings size={13} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </Box>

      {isLoading ? (
        <Box sx={{ fontSize: '0.6875rem', color: 'var(--faint)' }}>Chargement…</Box>
      ) : (
        <Box>
          <Row
            ok={Boolean(checkInOk)}
            label="Check-in"
            detail={checkInOk
              ? `automatique · J–${config?.hoursBeforeCheckIn ?? 24}h`
              : 'désactivé (envoi manuel uniquement)'}
          />
          <Row
            ok={Boolean(checkOutOk)}
            label="Check-out"
            detail={checkOutOk
              ? `automatique · ${config?.hoursBeforeCheckOut ?? 12}h avant départ`
              : 'désactivé (envoi manuel uniquement)'}
          />

          {/* Destinataire */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: 0.75, pt: 0.75, borderTop: '1px dashed var(--line)' }}>
            <Box component="span" sx={{ display: 'inline-flex', color: hasEmail ? 'var(--ok)' : 'var(--warn)', mt: '1px' }}>
              {hasEmail
                ? <CheckCircle size={13} strokeWidth={2} />
                : <Warning size={13} strokeWidth={2} />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box component="span" sx={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: hasEmail ? 'var(--ok)' : 'var(--warn)' }}>
                {hasEmail ? `Email guest disponible (${guestEmail})` : 'Pas d\'email guest'}
              </Box>
              {!hasEmail && (
                <Box component="span" sx={{ display: 'block', fontSize: '0.625rem', color: 'var(--muted)', mt: 0.25, lineHeight: 1.35 }}>
                  {isAnonymizedIcal
                    ? `Réservation importée via iCal (${source}) — l'email du voyageur n'est pas exposé par le canal. Renseigne-le manuellement dans la fiche client pour activer les envois.`
                    : 'Aucun message automatique ne pourra être envoyé tant que l\'email n\'est pas renseigné.'}
                </Box>
              )}
              {hasEmail && !checkInOk && !checkOutOk && (
                <Box component="span" sx={{ display: 'block', fontSize: '0.625rem', color: 'var(--muted)', mt: 0.25, lineHeight: 1.35 }}>
                  Active l'automation dans Paramètres › Messagerie pour que les emails partent sans intervention.
                </Box>
              )}
            </Box>
          </Box>

          {(checkInOk || checkOutOk) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, color: 'var(--faint)' }}>
              <AccessTime size={10} strokeWidth={1.75} />
              <Box component="span" sx={{ fontSize: '0.625rem', fontStyle: 'italic' }}>
                Scheduler : déclenchement horaire
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default MessagingAutomationStatus;
