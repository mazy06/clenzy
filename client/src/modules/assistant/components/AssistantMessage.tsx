import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Message,
  MessageAvatar,
  MessageContent,
} from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { SmartToy as BotIcon } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import type { DisplayMessage } from '../../../hooks/useAgent';
import { AssistantToolActivity } from './AssistantToolActivity';
import { ToolResultWidget } from '../widgets/ToolResultWidget';
import { AssistantMarkdown } from './AssistantMarkdown';
import { isArabicHeavy, arabicTextSx, arabicDirProp } from '../../../utils/textDirection';

interface AssistantMessageProps {
  message: DisplayMessage;
}

/**
 * Bulles de conversation — grammaire de la projection « Assistant Baitly »
 * (galerie design-system, {@code BAssistantSectionDemo}).
 *
 * <p>Les deux locuteurs se distinguent par la SURFACE, pas par la couleur :
 * teinte de marque diluée côté opérateur ({@code bg-primary-soft}), carte
 * bordée côté assistant. Le coin redressé du côté de l'interlocuteur fait
 * office d'amorce, sans queue dessinée — et il est posé en rayon LOGIQUE
 * ({@code rounded-ee-*} / {@code rounded-es-*}) pour rester juste en arabe.</p>
 *
 * <p>Les widgets riches (KPI, tableaux, graphiques) restent HORS bulle, en
 * pleine largeur de la colonne : ce sont des documents, pas de la parole.</p>
 */

/** Bulle de l'opérateur : coin bas-fin redressé (droite en LTR, gauche en RTL). */
const ASK_BUBBLE = 'w-fit max-w-[82%] rounded-2xl rounded-ee-md bg-primary-soft px-3 py-2 text-foreground';
/** Bulle de l'assistant : carte bordée, coin bas-début redressé. */
const BOT_BUBBLE = 'w-fit max-w-[88%] rounded-2xl rounded-es-md border border-border bg-card px-3 py-2';

/** Avatar de l'assistant — badge rond teinte de marque, comme la projection. */
const AssistantAvatar: React.FC = () => (
  <MessageAvatar className="size-7 bg-primary-soft text-primary">
    <BotIcon className="size-4" />
  </MessageAvatar>
);

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message }) => {
  const { t } = useTranslation();
  const [fullSizeUrl, setFullSizeUrl] = useState<string | null>(null);
  const [fullSizeAlt, setFullSizeAlt] = useState<string>('');

  // Les résultats d'outils ne sont pas des tours de parole : ils vivent dans
  // les pastilles d'activité et les widgets du message assistant.
  if (message.role === 'tool') return null;

  const isStreaming = message.streaming === true;

  // ── Opérateur ───────────────────────────────────────────────────────────
  if (message.role === 'user') {
    const attachments = message.attachments ?? [];
    // arabicTextSx (taille +30 %, interligne, pile de polices arabes) est une
    // constante partagée de utils/textDirection : posée en style inline, elle
    // bat les classes comme le faisait le spread dans l'ancien sx.
    const arabicHeavy = isArabicHeavy(message.content);
    return (
      <>
        <Message align="end">
          <MessageContent className={ASK_BUBBLE}>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {attachments.map((att) => (
                  <button
                    key={att.storageKey}
                    type="button"
                    onClick={() => {
                      setFullSizeUrl(att.url);
                      setFullSizeAlt(att.name ?? t('assistant.thread.attachedImage'));
                    }}
                    aria-label={t('assistant.thread.viewFullSize', {
                      name: att.name ?? t('assistant.thread.attachedImage'),
                    })}
                    className="size-[100px] cursor-pointer overflow-hidden rounded-lg border-0 bg-muted p-0 transition-opacity duration-150 hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                  >
                    <img
                      className="block size-full object-cover"
                      src={att.url}
                      alt={att.name ?? t('assistant.thread.attachedImage')}
                    />
                  </button>
                ))}
              </div>
            )}

            {message.content && (
              <p
                dir={arabicDirProp(message.content)}
                className={cn('whitespace-pre-wrap break-words', arabicHeavy && 'text-end')}
                style={arabicHeavy ? arabicTextSx : undefined}
              >
                {message.content}
              </p>
            )}
          </MessageContent>
        </Message>

        {/* Aperçu plein écran d'une pièce jointe */}
        <Dialog open={fullSizeUrl !== null} onOpenChange={(next) => { if (!next) setFullSizeUrl(null); }}>
          <DialogContent aria-describedby={undefined} className="max-w-[1200px] p-2">
            <DialogTitle className="mb-1.5 block text-xs text-muted-foreground">
              {fullSizeAlt}
            </DialogTitle>
            {fullSizeUrl && (
              <img className="mx-auto block max-h-[80vh] max-w-full rounded-lg" src={fullSizeUrl} alt={fullSizeAlt} />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── Assistant ───────────────────────────────────────────────────────────
  const toolCalls = message.toolCalls ?? [];
  const hasNothingYet = !message.content && toolCalls.length === 0;

  return (
    <Message>
      <AssistantAvatar />
      {/* Colonne de contenu : activité, widgets pleine largeur, puis la parole. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {toolCalls.length > 0 && <AssistantToolActivity calls={toolCalls} />}

        {toolCalls.map((call) => (
          <ToolResultWidget key={`widget-${call.toolCallId}`} call={call} />
        ))}

        {message.content && (
          <MessageContent className={BOT_BUBBLE}>
            <AssistantMarkdown text={message.content} />
          </MessageContent>
        )}

        {/* « Réfléchit » : trois points qui rebondissent dans une bulle assistant
            (projection), plutôt qu'un rouage — l'attente ressemble à quelqu'un
            qui rédige, pas à un chargement. */}
        {isStreaming && hasNothingYet && (
          <MessageContent className={BOT_BUBBLE}>
            <span className="flex items-center gap-1 py-0.5" aria-label={t('assistant.thread.thinking')}>
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none"
                  style={{ animationDelay: `${dot * 140}ms` }}
                />
              ))}
            </span>
          </MessageContent>
        )}
      </div>
    </Message>
  );
};
