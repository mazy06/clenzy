import React, { useMemo, useState } from 'react';
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
import { Close as CloseIcon, FullscreenExit as MinimizeIcon, History } from '../../../icons';
import { AssistantSurface } from './AssistantSurface';
import { ConversationSidebar } from './ConversationSidebar';
import { AssistantUsageBadge } from './AssistantUsageBadge';
import { useTranslation } from '../../../hooks/useTranslation';
import { useConversations } from '../hooks/useConversations';
import { useAssistantUsage } from '../hooks/useAssistantUsage';
import type { UseAgentResult } from '../../../hooks/useAgent';

/** Same conversation and draft in fullscreen, with accessible history on every screen size. */
type AgentProps = Pick<
  UseAgentResult,
  'conversationId' | 'messages' | 'status' | 'error' | 'sendMessage' | 'abort' | 'reset' | 'loadConversation'
>;

interface AssistantExpandedDialogProps extends AgentProps {
  open: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  /** Revenir au panneau docké, sans perdre la conversation. */
  onMinimize: () => void;
  /** Fermer entièrement l'assistant. */
  onClose: () => void;
}

const AssistantExpandedDialog: React.FC<AssistantExpandedDialogProps> = ({
  open,
  draft,
  onDraftChange,
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
  const [historyOpen, setHistoryOpen] = useState(false);

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
    if (id !== conversationId) { void loadConversation(id); onDraftChange(''); }
    setHistoryOpen(false);
  };

  const handleArchive = async (id: number) => {
    await archive(id);
    if (id === conversationId) { reset(); onDraftChange(''); }
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
        className="baitly-supervision-surface inset-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0"
      >
        {/* Le gabarit de modale exige un titre et une description accessibles :
            l'en-tête visible vit dans AssistantSurface, on les pose donc hors
            écran plutôt que de dédoubler le bandeau. */}
        <DialogTitle className="sr-only">{t('assistant.dockLabel')}</DialogTitle>
        <DialogDescription className="sr-only">{t('assistant.subtitle')}</DialogDescription>

        <div className="baitly-assistant-expanded-layout">
          <div className="baitly-assistant-history-panel" data-open={historyOpen || undefined} id="baitly-assistant-history">
            <ConversationSidebar
              conversations={conversations}
              activeConversationId={conversationId}
              loading={conversationsLoading}
              onSelect={handleSelect}
              onNew={() => { reset(); onDraftChange(''); setHistoryOpen(false); }}
              onArchive={handleArchive}
            />
            <AssistantUsageBadge usage={usage} loading={usageLoading} error={usageError} />
          </div>

          <AssistantSurface
            autoFocus
            draft={draft}
            onDraftChange={onDraftChange}
            messages={messages}
            status={status}
            error={error}
            onSend={sendMessage}
            onAbort={abort}
            headerActions={
              <>
                <Button variant="ghost" size="icon-sm" className="baitly-assistant-history-toggle min-[900px]:hidden" aria-label={t('assistant.history.title')} aria-expanded={historyOpen} aria-controls="baitly-assistant-history" onClick={() => setHistoryOpen(!historyOpen)}><History size={18} /></Button>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssistantExpandedDialog;
