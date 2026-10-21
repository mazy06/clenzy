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
 * reçu (surface papier, à gauche, avec avatar), envoyé (bleu doux, à droite),
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

  return (
    <div
      data-message-id={message.id}
      data-direction={out ? 'out' : 'in'}
      data-note={internalNote || undefined}
      className={cn('baitly-message', out ? 'justify-end' : 'justify-start', first ? 'mt-4 first:mt-0' : 'mt-1')}
    >
      {!out && (
        <div className="w-7 shrink-0 self-end">
          {last && <GuestAvatar name={sender} size={28} className="baitly-message-avatar" />}
        </div>
      )}

      <div className={cn('baitly-message-content', out ? 'items-end' : 'items-start')}>
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
            className="baitly-message-text"
          >
            {message.text}
          </div>
        )}

        {/* Une carte est un contenu de message : même colonne, même côté,
            même largeur bornée. */}
        {message.card && (
          <div className="baitly-message-card">{message.card}</div>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            {message.attachments.map((name) => (
              <li
                key={name}
                className="baitly-message-file"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 truncate">{name}</span>
              </li>
            ))}
          </ul>
        )}

        {message.extra}

        {last && (
          <span className="baitly-message-time">
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
