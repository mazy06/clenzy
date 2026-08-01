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
import { cn } from '../../../utils/cn';
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
    // Surface/bordure via tokens de session → suit le thème (clair ou sombre) et
    // matche le reste du PMS. L'ombre reprend `alpha(common.black, .35)` : les deux
    // palettes du projet fixent common.black a #000000, elle est donc figeable.
    // Focus du champ → bordure au token d'accent de la session.
    <div
      className={
        'overflow-hidden rounded-[14px] border border-solid border-[var(--line)] bg-[var(--card)] ' +
        'backdrop-blur-[10px] shadow-[0_16px_40px_-22px_rgba(0,0,0,0.35)] ' +
        'transition-[border-color,box-shadow] duration-[160ms] ease-[ease] ' +
        'focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-soft)]'
      }
    >
      {/* Transcription */}
      {hasTranscript && (
        <div className="max-h-[220px] overflow-y-auto px-2.5 pt-2 pb-1.5 flex flex-col gap-1.5" ref={transcriptRef}>
          {conversation.map((turn) => (
            <ConversationBubble key={turn.id} turn={turn} />
          ))}
          {busy && <ThinkingRow label={t('supervision.chat.thinking', 'Les agents travaillent…')} />}
        </div>
      )}

      {/* Champ de saisie */}
      <div
        className={cn(
          'flex items-end gap-1.5 px-[7.5px] py-1.5',
          hasTranscript && 'border-t border-solid border-[var(--line)]',
        )}
      >
        <textarea
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
          className={
            'flex-1 resize-none border-none outline-none bg-transparent [font-family:inherit] ' +
            'max-h-[96px] px-[3px] py-[4.5px] text-[13.5px] leading-normal text-[var(--ink)] caret-[var(--accent)] ' +
            'placeholder:text-[var(--muted)] placeholder:opacity-100 ' +
            'disabled:cursor-not-allowed disabled:text-[var(--faint)]'
          }
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
      </div>
    </div>
  );
}

function ConversationBubble({ turn }: { turn: ConversationTurn }) {
  const isOperator = turn.role === 'operator';
  return (
    <div className={cn('flex flex-col', isOperator ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] border border-solid px-[7.5px] py-[4.5px] text-[13px] leading-normal',
          'text-[var(--ink)] whitespace-pre-wrap wrap-break-word',
          isOperator
            ? 'rounded-[12px_12px_4px_12px] border-[var(--accent)] bg-[var(--accent-soft)]'
            : 'rounded-[12px_12px_12px_4px] border-[var(--line)] bg-[var(--hover)]',
        )}
      >
        {turn.text || '…'}
      </div>
      {turn.at && (
        <div className="mt-0.5 text-[10.5px] text-muted-foreground opacity-60 tabular-nums">
          {formatTime(turn.at)}
        </div>
      )}
    </div>
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
      <span className="inline-flex gap-[3px] ms-[1.5px]">
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
      </span>
    </Box>
  );
}
