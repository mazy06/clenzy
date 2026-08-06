/* ============================================================
   <SupervisionChatBar> — entrée de chat opérateur (chemin live)

   Barre docked SOUS la constellation. L'opérateur écrit un message →
   `onSend` déclenche un run du moteur multi-agent (via provider.kickoff) :
   la constellation réagit (agentActivity → think/act/done) et la réponse
   texte de l'orchestrateur s'accumule dans `conversation`.

   N'est rendue qu'en mode live (le mock ne déclenche aucun run réel). Le
   registre visuel est celui du PMS : surface de carte Baitly UI, accent de
   marque, et bulles de conversation du kit (Bubble/BubbleContent).
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import {
  Bubble,
  BubbleContent,
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
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
    // Surface/bordure sur les tokens Baitly UI → suit le thème (clair ou sombre)
    // et matche le reste du PMS. Le focus du champ reprend l'anneau du kit
    // (border-ring + ring/50), le même que les champs de formulaire.
    <div
      className={
        'overflow-hidden rounded-xl border border-solid border-border bg-card shadow-lg ' +
        'transition-[border-color,box-shadow] duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)] ' +
        'motion-reduce:transition-none ' +
        'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50'
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
          hasTranscript && 'border-t border-solid border-border',
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
            'max-h-[96px] px-[3px] py-[4.5px] text-sm leading-normal text-foreground caret-primary ' +
            'placeholder:text-muted-foreground placeholder:opacity-100 ' +
            'disabled:cursor-not-allowed disabled:text-faint'
          }
        />
        <Tooltip>
          {/* span : le trigger a besoin d'un enfant montable qui porte une ref,
              meme quand le bouton est desactive */}
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                onClick={submit}
                disabled={busy || value.trim().length === 0}
                aria-label={t('supervision.chat.send', 'Envoyer')}
                // Le gabarit `default` porte deja bg-primary / text-primary-foreground
                // et son survol. Seuls le disque et l'etat desactive sont locaux :
                // desactive, le bouton reste lisible (aplat doux) plutot que fondu.
                className={
                  'size-[34px] rounded-full ' +
                  'transition-[background-color,opacity] duration-[180ms] motion-reduce:transition-none ' +
                  'disabled:opacity-100 disabled:bg-primary-soft disabled:text-primary'
                }
              >
                <Send size={16} strokeWidth={2} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('supervision.chat.send', 'Envoyer')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function ConversationBubble({ turn }: { turn: ConversationTurn }) {
  const isOperator = turn.role === 'operator';
  return (
    <div className={cn('flex flex-col', isOperator ? 'items-end' : 'items-start')}>
      {/* Bulle du kit : l'operateur porte la teinte de marque, l'agent la
          surface neutre. La pointe se dit par un coin LOGIQUE (ee/es), qui
          suit le sens de lecture — l'ancien raccourci physique ne le faisait pas. */}
      <Bubble
        variant={isOperator ? 'tinted' : 'muted'}
        align={isOperator ? 'end' : 'start'}
      >
        <BubbleContent
          className={cn(
            'whitespace-pre-wrap text-foreground',
            isOperator ? 'rounded-ee-sm' : 'rounded-es-sm',
          )}
        >
          {turn.text || '…'}
        </BubbleContent>
      </Bubble>
      {turn.at && (
        <div className="mt-0.5 text-2xs text-muted-foreground opacity-60 tabular-nums">
          {formatTime(turn.at)}
        </div>
      )}
    </div>
  );
}

function ThinkingRow({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-[4.5px] text-primary text-xs font-semibold">
      <SmartToy size={14} />
      <span>{label}</span>
      <span className="inline-flex gap-[3px] ms-[1.5px]">
        {/* Les keyframes maison vivaient dans le `sx` Emotion : on reprend la
            pulsation `pulse` fournie par Tailwind, au meme rythme (1,2 s). Le
            decalage depend de l'index a l'execution → style inline. */}
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-[4px] rounded-full bg-primary animate-[pulse_1.2s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:opacity-60"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </span>
    </div>
  );
}
