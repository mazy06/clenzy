import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { ContentCopy, Check } from '../../../icons';
import { AssistantAvatar } from './AssistantAvatar';
import { useTranslation } from '../../../hooks/useTranslation';
import type { DisplayMessage } from '../../../hooks/useAgent';
import { AssistantToolActivity } from './AssistantToolActivity';
import { ToolResultWidget } from '../widgets/ToolResultWidget';
import { AssistantMarkdown } from './AssistantMarkdown';
import { isArabicHeavy, arabicTextSx, arabicDirProp } from '../../../utils/textDirection';

interface AssistantMessageProps {
  message: DisplayMessage;
}

/** Replies leave the full column available for reports and tool widgets. */
const ASK_BUBBLE = 'baitly-assistant-user-message';
const BOT_BUBBLE = 'baitly-assistant-response';

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message }) => {
  const { t } = useTranslation();
  const [fullSizeUrl, setFullSizeUrl] = useState<string | null>(null);
  const [fullSizeAlt, setFullSizeAlt] = useState<string>('');
  const [copyState, setCopyState] = useState<'copy' | 'copied' | 'copyFailed'>('copy');

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
        <div className="baitly-assistant-turn baitly-assistant-turn-user">
          <span className="baitly-assistant-speaker">{t('assistant.thread.you')}</span>
          <div className={ASK_BUBBLE}>
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
          </div>
        </div>

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
    <div className="baitly-assistant-turn">
      <div className="baitly-assistant-speaker"><AssistantAvatar /><span>Baitly</span></div>
      {/* Colonne de contenu : activité, widgets pleine largeur, puis la parole. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {toolCalls.length > 0 && <AssistantToolActivity calls={toolCalls} />}

        {toolCalls.map((call) => (
          <ToolResultWidget key={`widget-${call.toolCallId}`} call={call} />
        ))}

        {message.content && (
          <div className={BOT_BUBBLE}>
            <AssistantMarkdown text={message.content} />
          </div>
        )}

        {isStreaming && hasNothingYet && (
          <div className={BOT_BUBBLE}>
            <span className="baitly-assistant-thinking" role="status">
              {t('assistant.thread.thinking')}
            </span>
          </div>
        )}
      </div>
      {message.content && !isStreaming && (
        <button type="button" className="baitly-assistant-copy" aria-label={t('assistant.thread.' + copyState)} onClick={async () => {
          try { await navigator.clipboard.writeText(message.content); setCopyState('copied'); }
          catch { setCopyState('copyFailed'); }
        }}>
          {copyState === 'copied' ? <Check size={14} /> : <ContentCopy size={14} />}
          <span role="status">{t(`assistant.thread.${copyState}`)}</span>
        </button>
      )}
    </div>
  );
};
