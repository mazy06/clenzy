import React, { useMemo } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { Close as CloseIcon, FullscreenExit as MinimizeIcon } from '../../../icons';
import { AssistantSurface } from './AssistantSurface';
import { ConversationSidebar } from './ConversationSidebar';
import { AssistantUsageBadge } from './AssistantUsageBadge';
import { useTranslation } from '../../../hooks/useTranslation';
import { useConversations } from '../hooks/useConversations';
import { useAssistantUsage } from '../hooks/useAssistantUsage';
import type { UseAgentResult } from '../../../hooks/useAgent';

/**
 * Vue plein écran de l'assistant : la même surface de conversation que le
 * panneau docké, plus l'historique des conversations à droite.
 *
 * <p>Alimentée par le MÊME {@code useAgent} que le panneau (passé en props) :
 * la conversation se poursuit sans rupture quand on agrandit ou réduit. Les
 * hooks d'historique ({@link useConversations}) et d'usage ({@link
 * useAssistantUsage}) ne tournent que lorsque cette vue est montée, pour ne pas
 * interroger le serveur depuis chaque page.</p>
 *
 * <p><b>Mise en page</b> : le contenu est borné en largeur et centré. Sans
 * cette borne, sur un écran large la colonne de conversation s'étirait sur
 * toute la dalle — des lignes interminables et un composeur d'un mètre de long.
 * La conversation occupe l'espace restant, l'historique une colonne fixe de
 * 280 px, masquée en dessous de 900 px pour ne pas voler la place au fil.</p>
 */
type AgentProps = Pick<
  UseAgentResult,
  'conversationId' | 'messages' | 'status' | 'error' | 'sendMessage' | 'abort' | 'reset' | 'loadConversation'
>;

interface AssistantExpandedDialogProps extends AgentProps {
  open: boolean;
  /** Revenir au panneau docké, sans perdre la conversation. */
  onMinimize: () => void;
  /** Fermer entièrement l'assistant. */
  onClose: () => void;
}

const AssistantExpandedDialog: React.FC<AssistantExpandedDialogProps> = ({
  open,
  onMinimize,
  onClose,
  conversationId,
  messages,
  status,
  error,
  sendMessage,
  abort,
  reset,
  loadConversation,
}) => {
  const { t } = useTranslation();

  // Granularité de rafraîchissement = nombre de messages assistant (augmente à
  // chaque tour LLM terminé).
  const assistantMessageCount = useMemo(
    () => messages.filter((m) => m.role === 'assistant').length,
    [messages],
  );

  const { usage, loading: usageLoading, error: usageError } = useAssistantUsage({
    period: 'month',
    refreshKey: assistantMessageCount,
  });

  const {
    conversations,
    loading: conversationsLoading,
    archive,
  } = useConversations({
    refreshKey: `${conversationId ?? 'new'}-${assistantMessageCount}`,
  });

  const handleSelect = (id: number) => {
    if (id !== conversationId) void loadConversation(id);
  };

  const handleArchive = async (id: number) => {
    await archive(id);
    if (id === conversationId) reset();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onMinimize(); }}>
      {/* `inset-0` et NON `top-0 start-0` : le gabarit pose `top-1/2 left-1/2`,
          et `start-*` est une propriete LOGIQUE que tailwind-merge ne considere
          pas en conflit avec `left`. Le `left: 50%` survivait donc, sans
          translation pour le compenser — le plein ecran demarrait au milieu de
          la dalle et debordait a droite. `inset-0` couvre les quatre cotes dans
          le meme groupe et neutralise les deux ancrages d'un coup. */}
      <DialogContent
        showCloseButton={false}
        className="inset-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0"
      >
        {/* Le gabarit de modale exige un titre et une description accessibles :
            l'en-tête visible vit dans AssistantSurface, on les pose donc hors
            écran plutôt que de dédoubler le bandeau. */}
        <DialogTitle className="sr-only">{t('assistant.dockLabel')}</DialogTitle>
        <DialogDescription className="sr-only">{t('assistant.subtitle')}</DialogDescription>

        <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 gap-4 px-2 min-[900px]:px-4">
          <AssistantSurface
            autoFocus
            messages={messages}
            status={status}
            error={error}
            onSend={sendMessage}
            onAbort={abort}
            headerActions={
              <>
                <AssistantUsageBadge usage={usage} loading={usageLoading} error={usageError} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* span : TooltipTrigger asChild pose une ref DOM que le Button
                        du kit (fonction, React 18) ne transmet pas. */}
                    <span className="inline-flex">
                      <Button variant="ghost" size="icon-sm" onClick={onMinimize} aria-label={t('assistant.minimize')} className="cursor-pointer">
                        <MinimizeIcon size={18} />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('assistant.minimize')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('assistant.close')} className="cursor-pointer">
                        <CloseIcon size={18} />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('assistant.close')}</TooltipContent>
                </Tooltip>
              </>
            }
          />

          {/* Historique — masqué sur mobile pour ne pas voler l'espace au fil.
              Le seuil md de MUI vaut 900 px, pas les 768 px de Tailwind. */}
          <div className="hidden w-[280px] shrink-0 py-4 min-[900px]:block">
            <ConversationSidebar
              conversations={conversations}
              activeConversationId={conversationId}
              loading={conversationsLoading}
              onSelect={handleSelect}
              onNew={reset}
              onArchive={handleArchive}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssistantExpandedDialog;
