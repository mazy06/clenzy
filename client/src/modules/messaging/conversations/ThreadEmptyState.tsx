import React from 'react';
import { FirstUseStage, Packshot } from '../../../components/baitly/FirstUseStage';
import { STAGE_IMAGES } from '../../../components/baitly/stageImages';
import { Inbox, MessageSquare } from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';

interface ThreadEmptyStateProps {
  /** Conversations de la vue courante. */
  total: number;
  /** Conversations non lues de la vue courante. */
  unread: number;
}

/**
 * Volet droit tant que rien n'est ouvert : la scène bleu nuit des écrans de
 * première arrivée, pas une carte vide. Les deux pastilles disent où en est la
 * boîte — c'est la seule information utile avant de choisir une conversation.
 */
export default function ThreadEmptyState({ total, unread }: ThreadEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto">
      <FirstUseStage
        eyebrow={t('messagingHub.title', 'Messagerie')}
        icon={<MessageSquare aria-hidden />}
        headingId="messaging-select-heading"
        title={t('messagingHub.selectConversation', 'Sélectionnez une conversation')}
        lede={t('messagingHub.selectConversationHint', 'Choisissez une conversation à gauche.')}
        extra={
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="ns-chip">
              <Inbox aria-hidden />
              {t('messagingHub.conversationCount', { count: total })}
            </span>
            <span className="ns-chip" data-tone={unread > 0 ? 'alert' : undefined}>
              <MessageSquare aria-hidden />
              {t('messagingHub.unreadCount', { count: unread })}
            </span>
          </div>
        }
        visual={
          <div className="ns-art" aria-hidden>
            <Packshot src={STAGE_IMAGES.conversation} size="2xl" />
          </div>
        }
      />
    </div>
  );
}
