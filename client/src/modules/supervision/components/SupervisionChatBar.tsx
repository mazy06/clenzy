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

const ACCENT = '#9B9BF6';
const SURFACE = 'rgba(20,24,58,.92)';
const BORDER = '1px solid rgba(255,255,255,.12)';

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
        mt: 1.25,
        borderRadius: '14px',
        bgcolor: SURFACE,
        border: BORDER,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 16px 40px -22px rgba(0,0,0,.7)',
        overflow: 'hidden',
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
          borderTop: hasTranscript ? BORDER : 'none',
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
            color: '#E7E9FB',
            fontFamily: 'inherit',
            fontSize: 13.5,
            lineHeight: 1.5,
            maxHeight: 96,
            py: 0.75,
            px: 0.5,
            '&::placeholder': { color: 'rgba(231,233,251,.5)' },
            '&:disabled': { color: 'rgba(231,233,251,.4)', cursor: 'not-allowed' },
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
                color: '#0c0e2a',
                bgcolor: ACCENT,
                width: 34,
                height: 34,
                transition: 'background-color 180ms ease, opacity 180ms ease',
                '&:hover': { bgcolor: '#B4B4F9' },
                '&.Mui-disabled': { bgcolor: 'rgba(155,155,246,.28)', color: 'rgba(12,14,42,.5)' },
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
          bgcolor: isOperator ? 'rgba(155,155,246,.18)' : 'rgba(255,255,255,.06)',
          border: isOperator ? '1px solid rgba(155,155,246,.32)' : '1px solid rgba(255,255,255,.08)',
          color: '#E7E9FB',
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
            color: 'rgba(231,233,251,.45)',
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
        color: ACCENT,
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
              bgcolor: ACCENT,
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
