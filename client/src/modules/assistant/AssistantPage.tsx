import React from 'react';
import { Box, Typography, Paper, useTheme, alpha } from '@mui/material';
import { AutoAwesome as SparklesIcon } from '../../icons';
import PageHeader from '../../components/PageHeader';
import { useAgent } from '../../hooks/useAgent';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { ToolConfirmationDialog } from './components/ToolConfirmationDialog';

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
              px: 1.5,
              py: 1,
              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
              borderRadius: 2,
              bgcolor: 'transparent',
              color: theme.palette.text.primary,
              fontFamily: 'inherit',
              fontSize: '0.8125rem',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background-color 180ms ease-out, border-color 180ms ease-out',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                borderColor: theme.palette.primary.main,
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
    messages,
    status,
    error,
    pendingConfirmation,
    sendMessage,
    confirmTool,
    abort,
  } = useAgent({
    currentPage: 'assistant',
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PageHeader
        title="Assistant"
        subtitle="Pose tes questions, obtiens des reponses en temps reel a partir de tes donnees."
        iconBadge={<SparklesIcon size={18} strokeWidth={1.75} />}
      />

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          mx: { xs: 1, md: 2 },
          mb: { xs: 1, md: 2 },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 2,
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
        }}
      >
        <MessageList
          messages={messages}
          emptyState={<EmptyState onSuggest={(text) => sendMessage(text)} />}
        />

        {error && (
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: (t) => alpha(t.palette.error.main, 0.08),
              color: (t) => t.palette.error.main,
              fontSize: '0.8125rem',
              borderTop: (t) => `1px solid ${alpha(t.palette.error.main, 0.2)}`,
            }}
          >
            {error}
          </Box>
        )}

        <ChatInput
          status={status}
          onSend={sendMessage}
          onAbort={abort}
          autoFocus
        />
      </Paper>

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
