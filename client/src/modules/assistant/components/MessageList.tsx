import React, { useEffect, useRef } from 'react';
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
    return <div className="flex-1 overflow-auto bg-[var(--bg)]">{emptyState}</div>;
  }

  return (
    <div
      ref={containerRef}
      // Fond du fil (ref .mg-thread) : --bg pour faire ressortir les bulles carte.
      className="flex-1 overflow-auto bg-[var(--bg)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[var(--line-2)] [&::-webkit-scrollbar-thumb]:rounded-[4px]"
    >
      {/* Centered reading column — pattern Claude.ai/ChatGPT : conversation
          contrainte en largeur (max ~760px) pour preserver la longueur de
          ligne optimale (60-80 caracteres). Hors-zone: bg L1 du Paper. */}
      <div className="max-w-[760px] mx-auto px-3 min-[900px]:px-[18px] py-[18px]">
        {messages.map((m, idx) => (
          <MessageBubble key={m.id ?? `pending-${idx}`} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
