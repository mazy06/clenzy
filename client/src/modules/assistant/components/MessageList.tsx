import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { MessageBubble } from './MessageBubble';
import type { DisplayMessage } from '../../../hooks/useAgent';

interface MessageListProps {
  messages: DisplayMessage[];
  emptyState?: React.ReactNode;
}

/**
 * Liste scrollable de messages avec auto-scroll en bas a chaque nouveau message
 * ou delta. Utilise le pattern "scroll anchor div" pour eviter les saccades.
 *
 * Conteneur flex column-reverse n'est PAS utilise volontairement : le pattern
 * scrollIntoView est plus previsible et permet a l'utilisateur de scroll-up
 * sans etre pousse en bas a chaque delta.
 */
export const MessageList: React.FC<MessageListProps> = ({ messages, emptyState }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userIsAtBottomRef = useRef(true);

  // Track whether the user has scrolled up
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      userIsAtBottomRef.current = distanceFromBottom < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-scroll only if user is near the bottom
  useEffect(() => {
    if (userIsAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  if (messages.length === 0 && emptyState) {
    return <Box sx={{ flex: 1, overflow: 'auto' }}>{emptyState}</Box>;
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        overflow: 'auto',
        px: 2,
        py: 2,
        // Smooth scrollbar styling
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': { width: 8 },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0,0,0,0.15)',
          borderRadius: 4,
        },
      }}
    >
      {messages.map((m, idx) => (
        <MessageBubble key={m.id ?? `pending-${idx}`} message={m} />
      ))}
      <div ref={bottomRef} />
    </Box>
  );
};
