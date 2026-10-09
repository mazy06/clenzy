import React from 'react';
import { Check, CheckCheck, CircleAlert, FileText, NotebookPen } from '../../../icons/glyphs';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
import { deliveryState, type MessageRun } from './messagingModel';
import { formatMsgTime } from './unified';

interface MessageBubbleProps {
  run: MessageRun;
  /** Nom de repli quand l'expéditeur d'un message reçu n'est pas renseigné. */
  fallbackSender: string;
}

/**
 * Une bulle du fil.
 *
 * <p>Quatre états qui se lisent d'un coup d'œil, sans lire le contenu :
 * reçu (carte claire, à gauche, avec avatar), envoyé (bleu nuit, à droite),
 * note d'équipe (tirets ambrés : jamais transmise au voyageur), et message à
 * carte (devis, acompte) qui garde la colonne de son côté.</p>
 *
 * <p>Une série du même auteur ne répète ni l'avatar, ni le nom, ni l'heure :
 * l'avatar ouvre la série, l'heure et l'état de livraison la ferment.</p>
 */
export default function MessageBubble({ run, fallbackSender }: MessageBubbleProps) {
  const { t } = useTranslation();
  const { message, first, last } = run;
  const { out, internalNote } = message;
  const delivery = out && !internalNote ? deliveryState(message.delivery) : null;
  const sender = message.sender || fallbackSender;

  // Le coin de la « queue » ne se resserre que sur la dernière bulle d'une série.
  const shape = cn(
    'rounded-2xl',
    last && (out ? 'rounded-ee-md' : 'rounded-es-md'),
  );

  return (
    <div
      data-message-id={message.id}
      data-direction={out ? 'out' : 'in'}
      className={cn('flex gap-2', out ? 'justify-end' : 'justify-start', first ? 'mt-3 first:mt-0' : 'mt-0.5')}
    >
      {!out && (
        <div className="w-7 shrink-0 self-end">
          {last && <GuestAvatar name={sender} size={28} />}
        </div>
      )}

      <div className={cn('flex min-w-0 max-w-[80%] flex-col', out ? 'items-end' : 'items-start')}>
        {first && !out && message.sender && (
          <span dir="auto" className="mb-0.5 px-1 text-2xs font-semibold text-muted-foreground">
            {message.sender}
          </span>
        )}

        {internalNote && first && (
          <span className="mb-0.5 inline-flex items-center gap-1 px-1 text-2xs font-semibold text-warning-ink">
            <NotebookPen className="size-3" aria-hidden />
            {t('messagingHub.internalNoteBadge', 'Note interne')}
          </span>
        )}

        {message.text && (
          <div
            dir="auto"
            className={cn(
              shape,
              'px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap',
              internalNote
                ? 'border border-dashed border-warning/60 bg-warning-soft text-foreground'
                : out
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-foreground',
            )}
          >
            {message.text}
          </div>
        )}

        {/* Une carte est un contenu de message : même colonne, même côté,
            même largeur bornée. */}
        {message.card && (
          <div className="mt-1 w-full overflow-hidden rounded-2xl border border-border bg-card">{message.card}</div>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            {message.attachments.map((name) => (
              <li
                key={name}
                className="flex max-w-64 items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 truncate">{name}</span>
              </li>
            ))}
          </ul>
        )}

        {message.extra}

        {last && (
          <span className="mt-0.5 flex items-center gap-1 px-1 text-2xs tabular-nums text-faint">
            {formatMsgTime(message.at)}
            {delivery === 'sent' && <Check className="size-3" aria-label={t('messagingHub.delivery.sent', 'Envoyé')} />}
            {delivery === 'delivered' && (
              <CheckCheck className="size-3" aria-label={t('messagingHub.delivery.delivered', 'Remis')} />
            )}
            {delivery === 'read' && (
              <CheckCheck className="size-3 text-info" aria-label={t('messagingHub.delivery.read', 'Lu')} />
            )}
            {delivery === 'failed' && (
              <span className="inline-flex items-center gap-0.5 font-medium text-destructive-ink">
                <CircleAlert className="size-3" aria-hidden />
                {t('messagingHub.delivery.failed', 'Échec de l’envoi')}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
