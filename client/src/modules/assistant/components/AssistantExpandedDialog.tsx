import React, { useEffect, useMemo } from 'react';
import { Card } from '../../../components/ui';
import { Dialog, Typography, IconButton, Tooltip, Paper, useTheme } from '@mui/material';
import { Close as CloseIcon, FullscreenExit as MinimizeIcon } from '../../../icons';
import BaitlyMarkLogo from '../../../components/BaitlyMarkLogo';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ConversationSidebar } from './ConversationSidebar';
import { AssistantUsageBadge } from './AssistantUsageBadge';
import { useConversations } from '../hooks/useConversations';
import { useAssistantUsage } from '../hooks/useAssistantUsage';
import { ASSISTANT_QUICK_REPLY_EVENT } from '../widgets/WorkflowWidget';
import type { UseAgentResult } from '../../../hooks/useAgent';

const SUGGESTED_PROMPTS = [
  'Donne-moi le snapshot KPI actuel.',
  'Combien de reservations arrivent cette semaine ?',
  'Liste mes proprietes a Paris.',
  'Quels menages sont prevus aujourd\'hui ?',
];

/**
 * Vue "agrandie" de l'assistant : un Dialog plein ecran qui ajoute la sidebar
 * d'historique des conversations au chat, exactement comme l'ancienne page
 * dediee {@code /assistant} (vouee a disparaitre — cette vue la remplace).
 *
 * <p>Alimentee par le MEME {@code useAgent} que la bulle (passe en props) :
 * la conversation se poursuit sans rupture quand on agrandit ou reduit. Les
 * hooks d'historique ({@link useConversations}) et d'usage ({@link
 * useAssistantUsage}) ne tournent que lorsque cette vue est montee (= mode
 * plein ecran), pour ne pas fetcher inutilement sur chaque page.</p>
 */
type AgentProps = Pick<
  UseAgentResult,
  'conversationId' | 'messages' | 'status' | 'error' | 'sendMessage' | 'abort' | 'reset' | 'loadConversation'
>;

interface AssistantExpandedDialogProps extends AgentProps {
  open: boolean;
  /** Revenir au mode bulle (compact), sans perdre la conversation. */
  onMinimize: () => void;
  /** Fermer entierement l'assistant. */
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
  const theme = useTheme();
  const isWorking = status === 'sending' || status === 'streaming';

  // Granularite de refresh = nb de messages assistant (augmente a chaque tour
  // LLM termine), comme l'ancienne AssistantPage.
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

  // Quick replies emis par les widgets (ex: WorkflowWidget Oui/Non).
  useEffect(() => {
    const handler = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (text && text.trim()) void sendMessage(text);
    };
    window.addEventListener(ASSISTANT_QUICK_REPLY_EVENT, handler);
    return () => window.removeEventListener(ASSISTANT_QUICK_REPLY_EVENT, handler);
  }, [sendMessage]);

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          display: 'flex',
          flexDirection: 'column',
          bgcolor: theme.palette.background.default,
        },
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-[7.5px] px-[9px] min-[900px]:px-[15px] py-[7.5px] shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
        <BaitlyMarkLogo variant="mark" size={22} idleAnimation={false} active={isWorking} />
        <div className="flex-1 min-w-0">
          <h6 className="cn-text-subtitle1 font-semibold leading-[1.2]">
            Assistant
          </h6>
          <span className="cn-text-caption text-muted-foreground leading-[1]">
            Pose tes questions, reponses en temps reel sur tes donnees.
          </span>
        </div>
        <AssistantUsageBadge usage={usage} loading={usageLoading} error={usageError} />
        <Tooltip title="Reduire">
          <IconButton size="small" onClick={onMinimize} aria-label="Reduire" sx={{ cursor: 'pointer' }}>
            <MinimizeIcon size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fermer">
          <IconButton size="small" onClick={onClose} aria-label="Fermer" sx={{ cursor: 'pointer' }}>
            <CloseIcon size={18} />
          </IconButton>
        </Tooltip>
      </div>

      {/* Corps : sidebar historique + chat */}
      <div className="flex-1 min-h-0 flex flex-col min-[900px]:flex-row mx-1.5 min-[900px]:mx-3 my-1.5 min-[900px]:my-[9px] gap-1.5 min-[900px]:gap-[9px]">
        {/* Historique — masque sur mobile pour ne pas voler l'espace */}
        <Paper
          elevation={0}
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            borderRadius: '14px',
            border: '1px solid var(--line)',
            bgcolor: 'var(--card)',
            overflow: 'hidden',
          }}
        >
          <ConversationSidebar
            conversations={conversations}
            activeConversationId={conversationId}
            loading={conversationsLoading}
            onSelect={handleSelect}
            onNew={reset}
            onArchive={handleArchive}
          />
        </Paper>

        {/* Chat */}
        <Card className="gap-0 py-0 flex-1 flex flex-col overflow-hidden bg-[var(--card)] min-w-[0px]">
          <MessageList
            messages={messages}
            emptyState={
              <div className="flex flex-col items-center justify-center gap-4 py-9 px-4 text-center h-full">
                <div className="w-[64px] h-[64px] rounded-[50%] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                  <BaitlyMarkLogo variant="mark" size={52} />
                </div>
                <div>
                  <Typography
                    sx={{
                      mb: 0.5,
                      fontFamily: 'var(--font-display)',
                      fontSize: 18,
                      fontWeight: 600,
                      color: 'var(--ink)',
                      textWrap: 'balance',
                    }}
                  >
                    Comment puis-je t&apos;aider ?
                  </Typography>
                  <p className="cn-text-body1 max-w-[480px] text-[13px] leading-[1.55] text-[var(--muted)]">
                    Pose-moi une question sur tes proprietes, reservations, menages ou KPIs.
                    J&apos;utilise tes donnees Baitly en temps reel.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center max-w-[640px]">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="px-[14px] py-2 border-none rounded-[999px] bg-[var(--accent-soft)] text-[var(--accent)] font-[inherit] text-[12.5px] font-semibold text-left cursor-pointer [transition:background_.15s,color_.15s,transform_.12s] motion-reduce:[transition:none] hover:bg-[var(--accent)] hover:text-[var(--on-accent)] active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            }
          />

          {error && (
            <div className="max-w-[760px] mx-auto w-full px-3 min-[900px]:px-[18px] mb-1.5">
              <div className="px-[10.5px] py-1.5 bg-[var(--err-soft)] text-[var(--err)] border border-solid border-[color-mix(in_srgb,_var(--err)_30%,_transparent)] text-[12.5px] font-semibold rounded-[10px]">
                {error}
              </div>
            </div>
          )}

          <ChatInput status={status} onSend={sendMessage} onAbort={abort} autoFocus />
        </Card>
      </div>
    </Dialog>
  );
};

export default AssistantExpandedDialog;
