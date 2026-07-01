/* ============================================================
   <SupervisionChatBar> — entrée de chat opérateur (chemin live)

   Barre docked SOUS la constellation. L'opérateur écrit un message →
   `onSend` déclenche un run du moteur multi-agent (via provider.kickoff) :
   la constellation réagit (agentActivity → think/act/done) et la réponse
   texte de l'orchestrateur s'accumule dans `conversation`.

   N'est rendue qu'en mode live (le mock ne déclenche aucun run réel). Le
   registre visuel suit la constellation (deep-space), pas une carte produit :
   surface sombre translucide, accent indigo (#9B9BF6) cohérent avec le HUD.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Send, SmartToy } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ConversationTurn } from '../types';

export interface SupervisionChatBarProps {
  /** Transcription opérateur ⇄ orchestrateur (chrono croissant). */
  conversation: ConversationTurn[];
  /** true tant qu'un run est en cours → input désactivé + indicateur. */
  busy: boolean;
  /** Envoi d'un message opérateur (déclenche un run). */
  onSend: (message: string) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function SupervisionChatBar({ conversation, busy, onSend }: SupervisionChatBarProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll vers le dernier tour quand la conversation évolue.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation, busy]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setValue('');
  };

  const hasTranscript = conversation.length > 0;

  return (
    <Box
      sx={{
        // Surface/bordure via tokens MUI → suit le thème de la session (clair
        // ou sombre) et matche le reste du PMS. En flottant sur le canvas de la
        // constellation, elle reste lisible dans les deux modes.
        borderRadius: '14px',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        backdropFilter: 'blur(10px)',
        boxShadow: (t) => `0 16px 40px -22px ${alpha(t.palette.common.black, 0.35)}`,
        overflow: 'hidden',
        transition: 'border-color 160ms ease, box-shadow 160ms ease',
        // Focus du champ → bordure au token d'accent de la session.
        '&:focus-within': {
          borderColor: 'var(--accent)',
          boxShadow: '0 0 0 3px var(--accent-soft)',
        },
      }}
    >
      {/* Transcription */}
      {hasTranscript && (
        <Box
          ref={transcriptRef}
          sx={{
            maxHeight: 220,
            overflowY: 'auto',
            px: 1.75,
            pt: 1.5,
            pb: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {conversation.map((turn) => (
            <ConversationBubble key={turn.id} turn={turn} />
          ))}
          {busy && <ThinkingRow label={t('supervision.chat.thinking', 'Les agents travaillent…')} />}
        </Box>
      )}

      {/* Champ de saisie */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          px: 1.25,
          py: 1,
          borderTop: hasTranscript ? '1px solid' : 'none',
          borderColor: 'divider',
        }}
      >
        <Box
          component="textarea"
          rows={1}
          value={value}
          disabled={busy}
          placeholder={t('supervision.chat.placeholder', 'Demandez quelque chose aux agents…')}
          aria-label={t('supervision.chat.inputLabel', 'Message aux agents')}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Entrée = envoyer ; Maj+Entrée = nouvelle ligne.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          sx={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            bgcolor: 'transparent',
            color: 'text.primary',
            caretColor: 'var(--accent)',
            fontFamily: 'inherit',
            fontSize: 13.5,
            lineHeight: 1.5,
            maxHeight: 96,
            py: 0.75,
            px: 0.5,
            '&::placeholder': { color: 'text.secondary', opacity: 1 },
            '&:disabled': { color: 'text.disabled', cursor: 'not-allowed' },
          }}
        />
        <Tooltip title={t('supervision.chat.send', 'Envoyer')} arrow>
          {/* span : Tooltip a besoin d'un enfant montable même quand le bouton est désactivé */}
          <span>
            <IconButton
              onClick={submit}
              disabled={busy || value.trim().length === 0}
              aria-label={t('supervision.chat.send', 'Envoyer')}
              size="small"
              sx={{
                // Token d'accent de la session (var(--accent)) — pas le primary
                // MUI figé sur l'indigo par défaut.
                color: 'var(--on-accent)',
                bgcolor: 'var(--accent)',
                width: 34,
                height: 34,
                transition: 'background-color 180ms ease, opacity 180ms ease',
                '&:hover': { bgcolor: 'var(--accent-deep)' },
                '&.Mui-disabled': {
                  bgcolor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                },
              }}
            >
              <Send size={16} strokeWidth={2} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

function ConversationBubble({ turn }: { turn: ConversationTurn }) {
  const isOperator = turn.role === 'operator';
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOperator ? 'flex-end' : 'flex-start',
      }}
    >
      <Box
        sx={{
          maxWidth: '85%',
          px: 1.25,
          py: 0.75,
          borderRadius: isOperator ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          bgcolor: (t) => (isOperator ? 'var(--accent-soft)' : t.palette.action.hover),
          border: '1px solid',
          borderColor: (t) => (isOperator ? 'var(--accent)' : t.palette.divider),
          color: 'text.primary',
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {turn.text || '…'}
      </Box>
      {turn.at && (
        <Box
          sx={{
            mt: 0.25,
            fontSize: 10.5,
            color: 'text.disabled',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatTime(turn.at)}
        </Box>
      )}
    </Box>
  );
}

function ThinkingRow({ label }: { label: string }) {
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        color: 'var(--accent)',
        fontSize: 12,
        fontWeight: 600,
        '@keyframes supervisionDotPulse': {
          '0%, 80%, 100%': { opacity: 0.25 },
          '40%': { opacity: 1 },
        },
      }}
    >
      <SmartToy size={14} />
      <span>{label}</span>
      <Box component="span" sx={{ display: 'inline-flex', gap: '3px', ml: 0.25 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            component="span"
            sx={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              bgcolor: 'var(--accent)',
              animation: 'supervisionDotPulse 1.2s infinite ease-in-out',
              animationDelay: `${i * 0.16}s`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.6 },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
