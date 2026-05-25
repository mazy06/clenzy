import React from 'react';
import { Box, Typography, useTheme, alpha, CircularProgress } from '@mui/material';
import type { DisplayMessage } from '../../../hooks/useAgent';
import { ToolCallCard } from './ToolCallCard';

interface MessageBubbleProps {
  message: DisplayMessage;
}

/**
 * Bulle de message individuelle. Alignement et palette adaptes au role :
 *   - user      : aligne a droite, bg primary subtil
 *   - assistant : aligne a gauche, bg surface secondaire
 *
 * Pas de border-radius uniforme : 16px sur 3 coins + 4px sur le coin "queue".
 * `text-wrap: balance` sur les paragraphes pour eviter les veuves.
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const theme = useTheme();
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isStreaming = message.streaming === true;

  // Tool messages (results) are hidden from the chat view — they live in ToolCallCard.
  if (message.role === 'tool') return null;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 1.5,
      }}
    >
      <Box
        sx={{
          maxWidth: '76%',
          minWidth: 60,
          px: 1.75,
          py: 1.25,
          borderRadius: isUser
            ? '16px 4px 16px 16px'
            : '4px 16px 16px 16px',
          bgcolor: isUser
            ? alpha(theme.palette.primary.main, 0.10)
            : alpha(theme.palette.text.primary, 0.04),
          color: theme.palette.text.primary,
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          // Streaming visual : subtle pulse via opacity
          opacity: isStreaming && !message.content ? 0.6 : 1,
          transition: 'opacity 200ms ease-out',
        }}
      >
        {/* Tool call cards rendered before the text (the LLM typically narrates after tool exec) */}
        {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
          <Box sx={{ mb: message.content ? 1 : 0 }}>
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.toolCallId} call={tc} />
            ))}
          </Box>
        )}

        {message.content && (
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textWrap: 'balance',
              lineHeight: 1.55,
            }}
          >
            {message.content}
          </Typography>
        )}

        {/* Streaming indicator when content is still empty */}
        {isStreaming && !message.content && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={12} thickness={5} />
            <Typography variant="caption" color="text.secondary">
              Reflechit...
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
