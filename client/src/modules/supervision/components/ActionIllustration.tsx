import { useState, type ReactNode } from 'react';
import { ACTION_ILLUSTRATIONS, actionIllustration, type ActionIllustrationKey } from '../core/actionIllustration';
import type { AgentId, PendingAction } from '../types';
import './action-illustration.css';

/** Decorative support for the adjacent title, never a status or proof of execution. */
export function ActionIllustration({ visual }: { visual: ActionIllustrationKey }) {
  const source = ACTION_ILLUSTRATIONS[visual];
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <span className="baitly-action-illustration" aria-hidden="true" data-action-visual={visual}>
    {failedSource !== source && <img src={source} alt="" width={80} height={80}
      loading="lazy" decoding="async" draggable={false} onError={() => setFailedSource(source)} />}
  </span>;
}

/** One shared layout for constellation, deck, list, live approval and modal headers. */
export function ActionIllustratedHeading({ action, agentId, children }: {
  action?: PendingAction; agentId?: AgentId; children: ReactNode;
}) {
  const visual = actionIllustration(action, agentId);
  return <div className="baitly-action-illustrated-heading" data-illustrated={visual ? true : undefined}>
    {visual && <ActionIllustration visual={visual} />}
    <div className="baitly-action-heading-copy">{children}</div>
  </div>;
}
