import React, { useEffect, useMemo } from 'react';
import { Box, Typography, Paper, useTheme, alpha } from '@mui/material';
import { AutoAwesome as SparklesIcon } from '../../icons';
import PageHeader from '../../components/PageHeader';
import { useAgent } from '../../hooks/useAgent';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { ToolConfirmationDialog } from './components/ToolConfirmationDialog';
import { AssistantUsageBadge } from './components/AssistantUsageBadge';
import { ConversationSidebar } from './components/ConversationSidebar';
import { useAssistantUsage } from './hooks/useAssistantUsage';
import { useConversations } from './hooks/useConversations';
import { ASSISTANT_QUICK_REPLY_EVENT } from './widgets/WorkflowWidget';

const SUGGESTED_PROMPTS = [
  'Donne-moi le snapshot KPI actuel.',
  'Combien de reservations arrivent cette semaine ?',
  'Liste mes proprietes a Paris.',
  'Quels menages sont prevus aujourd\'hui ?',
];

const EmptyState: React.FC<{ onSuggest: (text: string) => void }> = ({ onSuggest }) => {
  const theme = useTheme();
  return (
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
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.palette.primary.main,
        }}
      >
        <SparklesIcon size={28} strokeWidth={1.75} />
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
          Comment puis-je t&apos;aider ?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
          Pose-moi une question sur tes proprietes, reservations, menages ou KPIs.
          J&apos;utilise tes donnees Clenzy en temps reel.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 640 }}>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Box
            key={prompt}
            component="button"
            onClick={() => onSuggest(prompt)}
            sx={{
              // L4 chips suggerees : bg neutre subtil → bg primary teinte au hover.
              // Pas de border, c'est le bg qui donne la presence visuelle.
              px: 1.75,
              py: 1,
              border: 'none',
              borderRadius: 999, // pill shape — plus elegant que rectangle arrondi
              bgcolor: alpha(theme.palette.text.primary, 0.04),
              color: theme.palette.text.primary,
              fontFamily: 'inherit',
              fontSize: '0.8125rem',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background-color 180ms ease-out, color 180ms ease-out',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.dark,
              },
              '&:focus-visible': {
                outline: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                outlineOffset: 2,
              },
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
              },
            }}
          >
            {prompt}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const AssistantPage: React.FC = () => {
  const {
    conversationId,
    messages,
    status,
    error,
    pendingConfirmation,
    sendMessage,
    confirmTool,
    loadConversation,
    reset,
    abort,
  } = useAgent({
    currentPage: 'assistant',
  });

  // Refetch usage : a chaque fois qu'un nouveau message assistant termine
  // (status: idle apres avoir ete streaming). Granularite = nombre de messages
  // assistant — augmente uniquement quand un tour LLM se termine.
  const assistantMessageCount = useMemo(
    () => messages.filter((m) => m.role === 'assistant').length,
    [messages],
  );
  const { usage, loading: usageLoading, error: usageError } = useAssistantUsage({
    period: 'month',
    refreshKey: assistantMessageCount,
  });

  // Liste des conversations pour la sidebar — refresh quand :
  // - une nouvelle conv est creee (conversationId passe de null a une valeur)
  // - un message assistant arrive (le titre peut changer au 1er tour)
  const {
    conversations,
    loading: conversationsLoading,
    archive: archiveConversation,
  } = useConversations({
    refreshKey: `${conversationId ?? 'new'}-${assistantMessageCount}`,
  });

  const handleSelectConversation = (id: number) => {
    if (id === conversationId) return; // deja active
    void loadConversation(id);
  };

  const handleArchive = async (id: number) => {
    await archiveConversation(id);
    // Si la conv archivee etait celle active, reset pour repartir sur "Nouvelle"
    if (id === conversationId) reset();
  };

  // Quick replies emis par les widgets (ex: WorkflowWidget : Oui / Non) :
  // on rebranche sur sendMessage pour que l'agent puisse enchainer.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = detail?.text;
      if (text && text.trim()) {
        void sendMessage(text);
      }
    };
    window.addEventListener(ASSISTANT_QUICK_REPLY_EVENT, handler);
    return () => window.removeEventListener(ASSISTANT_QUICK_REPLY_EVENT, handler);
  }, [sendMessage]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PageHeader
        title="Assistant"
        subtitle="Pose tes questions, obtiens des reponses en temps reel a partir de tes donnees."
        iconBadge={<SparklesIcon size={18} strokeWidth={1.75} />}
        actions={
          <AssistantUsageBadge
            usage={usage}
            loading={usageLoading}
            error={usageError}
          />
        }
      />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          mx: { xs: 1, md: 2 },
          mb: { xs: 1, md: 2 },
          gap: { xs: 1, md: 1.5 },
        }}
      >
        {/* Sidebar conversations — masquee sur mobile pour ne pas voler l'espace
            (TODO : drawer collapsible si feedback user) */}
        <Paper
          elevation={0}
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <ConversationSidebar
            conversations={conversations}
            activeConversationId={conversationId}
            loading={conversationsLoading}
            onSelect={handleSelectConversation}
            onNew={reset}
            onArchive={handleArchive}
          />
        </Paper>

        {/* Chat principal */}
        <Paper
          elevation={0}
          sx={{
            // Surface L1 (background.paper = white) sur fond L0 (background.default
            // = light gray) : contraste de bg suffit pour delimiter la zone, pas de
            // border. Approche Linear/Notion/Vercel.
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 3,
            minWidth: 0,
          }}
        >
          <MessageList
            messages={messages}
            emptyState={<EmptyState onSuggest={(text) => sendMessage(text)} />}
          />

          {error && (
            <Box
              sx={{
                // Aligne avec la colonne de lecture (maxWidth 760)
                maxWidth: 760,
                mx: 'auto',
                width: '100%',
                px: { xs: 2, md: 3 },
                mb: 1,
              }}
            >
              <Box
                sx={{
                  px: 1.75,
                  py: 1,
                  bgcolor: (t) => alpha(t.palette.error.main, 0.10),
                  color: (t) => t.palette.error.dark,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderRadius: 2,
                }}
              >
                {error}
              </Box>
            </Box>
          )}

          <ChatInput
            status={status}
            onSend={sendMessage}
            onAbort={abort}
            autoFocus
          />
        </Paper>
      </Box>

      {/* Tool confirmation dialog (write tools, requiresConfirmation=true) */}
      <ToolConfirmationDialog
        pending={pendingConfirmation}
        onConfirm={() => confirmTool(true)}
        onCancel={() => confirmTool(false)}
      />
    </Box>
  );
};

export default AssistantPage;
