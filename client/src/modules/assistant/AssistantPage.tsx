import React, { useEffect, useMemo } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
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
          // Container 64px conserve (taille initiale), mais mark a l'interieur
          // agrandi de 32 -> 52 pour qu'il occupe ~81% du container et soit
          // bien visible (6px padding visuel de chaque cote). Le mark a
          // overflow:visible donc le radial translate des nodes au peak
          // (~2.5 SVG units) peut deborder sans etre coupe.
          width: 64,
          height: 64,
          borderRadius: '50%',
          bgcolor: 'var(--accent-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
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
            onClick={() => onSuggest(prompt)}
            sx={{
              // Chips suggérées : accent-soft (réf FilterChipRow actif),
              // hover = pilule accent pleine (réf .mg-subtab actif).
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
              '&:hover': {
                bgcolor: 'var(--accent)',
                color: 'var(--on-accent)',
              },
              '&:active': { transform: 'scale(.97)' },
              '&:focus-visible': {
                outline: '2px solid var(--accent)',
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
        iconBadge={<BaitlyMarkLogo variant="mark" size={22} />}
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
            onSelect={handleSelectConversation}
            onNew={reset}
            onArchive={handleArchive}
          />
        </Paper>

        {/* Chat principal */}
        <Paper
          elevation={0}
          sx={{
            // Carte hairline r14 (réf MuiCard Signature) — délimite la zone chat.
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
