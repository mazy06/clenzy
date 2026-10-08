import React, { useEffect, useRef } from 'react';
import { MessageGroup } from '../../../components/ui';
import { AssistantMessage } from './AssistantMessage';
import type { DisplayMessage } from '../../../hooks/useAgent';

interface AssistantThreadProps {
  messages: DisplayMessage[];
  emptyState?: React.ReactNode;
}

/** Auto-scroll only while the reader remains near the bottom of the thread. */
export const AssistantThread: React.FC<AssistantThreadProps> = ({ messages, emptyState }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userIsAtBottomRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      userIsAtBottomRef.current = distanceFromBottom < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      if (containerRef.current) containerRef.current.scrollTop = 0;
      userIsAtBottomRef.current = true;
      return;
    }
    if (userIsAtBottomRef.current) {
      // Scroll only this panel. Smooth scrolling on every streamed token jitters
      // and scrollIntoView can also move the underlying planning page.
      const container = containerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="baitly-assistant-thread"
    >
      {messages.length === 0 && emptyState ? (
        emptyState
      ) : (
        <>
          <MessageGroup>
            {messages.map((message, index) => (
              <AssistantMessage key={message.id ?? `pending-${index}`} message={message} />
            ))}
          </MessageGroup>
        </>
      )}
    </div>
  );
};
