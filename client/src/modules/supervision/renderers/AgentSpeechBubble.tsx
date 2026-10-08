import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '../../../components/ui/popover';
import { AgentSpeechSurface } from './AgentSpeechSurface';
import { AGENT_SPEECH_MORPH_MS } from './agentSpeechGeometry';
import './agent-speech-bubble.css';

/** The notification is the bubble's anchor; the whole agent remains its target. */
export function AgentSpeechBubble({
  agentId, status, selected, label, badge, children, content, onSelect, rtl,
}: {
  agentId: string;
  status: string;
  selected: boolean;
  label: string;
  badge: ReactNode;
  children: ReactNode;
  content: ReactNode;
  onSelect: () => void;
  rtl: boolean;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const timer = useRef<number>();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [align, setAlign] = useState<'start' | 'end'>('start');
  const clearTimer = () => window.clearTimeout(timer.current);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const reveal = () => {
    const box = anchorRef.current?.getBoundingClientRect();
    if (box) {
      const roomAfter = rtl ? box.right : window.innerWidth - box.left;
      const roomBefore = rtl ? window.innerWidth - box.left : box.right;
      // Keep the tail near a corner, including for agents against the viewport edge.
      setAlign(roomAfter < 316 && roomBefore > roomAfter ? 'end' : 'start');
    }
    setOpen(true);
  };
  const show = () => {
    clearTimer();
    timer.current = window.setTimeout(reveal, 180);
  };
  const hide = () => {
    clearTimer();
    // Allow crossing the short gap from the agent to its hoverable bubble.
    timer.current = window.setTimeout(() => setOpen(false), 140);
  };
  const close = () => {
    clearTimer();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <button
        type="button"
        data-agent={agentId}
        data-status={status}
        data-bubble-open={open || undefined}
        aria-pressed={selected}
        aria-label={label}
        aria-describedby={open ? contentId : undefined}
        className="baitly-orbit-node"
        onPointerEnter={(event) => { if (event.pointerType !== 'touch') show(); }}
        onPointerLeave={(event) => { if (event.pointerType !== 'touch') hide(); }}
        onFocus={() => { clearTimer(); reveal(); }}
        onBlur={close}
        onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
        onClick={() => { close(); onSelect(); }}
      >
        {children}
        <PopoverAnchor asChild>
          <span ref={anchorRef} className="baitly-agent-bubble-anchor" aria-hidden="true">{badge}</span>
        </PopoverAnchor>
      </button>
      <PopoverContent
        id={contentId}
        role="tooltip"
        dir={rtl ? 'rtl' : 'ltr'}
        // Popper may flip below the badge, but never to a lateral edge.
        side="top"
        align={align}
        alignOffset={-36}
        sideOffset={24}
        collisionPadding={16}
        className="baitly-supervision-surface baitly-agent-speech"
        style={{ animationDuration: `${AGENT_SPEECH_MORPH_MS}ms` }}
        data-status={status}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={clearTimer}
        onPointerLeave={hide}
      >
        <AgentSpeechSurface anchorRef={anchorRef} open={open} badge={badge}>{content}</AgentSpeechSurface>
      </PopoverContent>
    </Popover>
  );
}
