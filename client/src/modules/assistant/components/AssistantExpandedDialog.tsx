import React, { useEffect, useMemo } from 'react';
import { Dialog, Box, Typography, IconButton, Tooltip, Paper, useTheme } from '@mui/material';
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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: { xs: 1.5, md: 2.5 },
          py: 1.25,
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}
      >
        <BaitlyMarkLogo variant="mark" size={22} idleAnimation={false} active={isWorking} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            Assistant
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
            Pose tes questions, reponses en temps reel sur tes donnees.
          </Typography>
        </Box>
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
      </Box>

      {/* Corps : sidebar historique + chat */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          mx: { xs: 1, md: 2 },
          my: { xs: 1, md: 1.5 },
          gap: { xs: 1, md: 1.5 },
        }}
      >
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
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '14px',
            border: '1px solid var(--line)',
            bgcolor: 'var(--card)',
            minWidth: 0,
          }}
        >
          <MessageList
            messages={messages}
            emptyState={
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  py: 6,
                  px: 3,
                  textAlign: 'center',
                  height: '100%',
                }}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    bgcolor: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BaitlyMarkLogo variant="mark" size={52} />
                </Box>
                <Box>
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
                  <Typography sx={{ maxWidth: 480, fontSize: 13, lineHeight: 1.55, color: 'var(--muted)' }}>
                    Pose-moi une question sur tes proprietes, reservations, menages ou KPIs.
                    J&apos;utilise tes donnees Baitly en temps reel.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 640 }}>
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <Box
                      key={prompt}
                      component="button"
                      onClick={() => sendMessage(prompt)}
                      sx={{
                        px: '14px',
                        py: '8px',
                        border: 'none',
                        borderRadius: 999,
                        bgcolor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        fontFamily: 'inherit',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background .15s, color .15s, transform .12s',
                        '&:hover': { bgcolor: 'var(--accent)', color: 'var(--on-accent)' },
                        '&:active': { transform: 'scale(.97)' },
                        '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                      }}
                    >
                      {prompt}
                    </Box>
                  ))}
                </Box>
              </Box>
            }
          />

          {error && (
            <Box sx={{ maxWidth: 760, mx: 'auto', width: '100%', px: { xs: 2, md: 3 }, mb: 1 }}>
              <Box
                sx={{
                  px: 1.75,
                  py: 1,
                  bgcolor: 'var(--err-soft)',
                  color: 'var(--err)',
                  border: '1px solid color-mix(in srgb, var(--err) 30%, transparent)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  borderRadius: '10px',
                }}
              >
                {error}
              </Box>
            </Box>
          )}

          <ChatInput status={status} onSend={sendMessage} onAbort={abort} autoFocus />
        </Paper>
      </Box>
    </Dialog>
  );
};

export default AssistantExpandedDialog;
