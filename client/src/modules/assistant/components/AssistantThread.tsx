import React, { useEffect, useRef } from 'react';
import { MessageGroup } from '../../../components/ui';
import { AssistantMessage } from './AssistantMessage';
import type { DisplayMessage } from '../../../hooks/useAgent';

interface AssistantThreadProps {
  messages: DisplayMessage[];
  emptyState?: React.ReactNode;
}

/**
 * Fil de conversation — la boîte bordée de la projection, posée directement sur
 * le fond du panneau : c'est le SEUL niveau de surface entre le panneau et les
 * bulles (cf. la note d'aplatissement dans {@code AssistantSurface}).
 *
 * <p>Le fond reste {@code background}, comme dans la projection : ce sont les
 * bulles et les widgets qui portent la teinte {@code card}, et les inverser
 * pour gagner un contraste avec le panneau les ferait disparaître. Ici c'est
 * le filet qui détache le fil, pas le fond.</p>
 *
 * <p>Auto-défilement CONDITIONNEL : on ne repousse en bas que si l'opérateur
 * s'y trouve déjà (marge de 80 px). Sans cette garde, relire un message plus
 * haut pendant que la réponse arrive en flux deviendrait impossible.</p>
 */
export const AssistantThread: React.FC<AssistantThreadProps> = ({ messages, emptyState }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
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
    if (userIsAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-background p-3 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-2"
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
          <div ref={bottomRef} />
        </>
      )}
    </div>
  );
};
