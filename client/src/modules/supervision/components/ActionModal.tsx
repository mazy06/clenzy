import type { ComponentProps, ReactNode } from 'react';
import {
  Button, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Skeleton,
} from '../../../components/ui';
import { X } from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
import { AGENT_META } from '../constants';
import { AgentIcon } from '../renderers/agentIcon';
import type { AgentId, PendingAction } from '../types';
import { DescriptionNarrative } from './ActionDescription';
import { ActionIllustratedHeading } from './ActionIllustration';
import '../supervision-surfaces.css';
import './action-modal.css';

/** The portal owns its palette; it cannot inherit the queue's DOM scope. */
export function ActionModalContent({ className, style, children, showCloseButton = true, ...props }: ComponentProps<typeof DialogContent>) {
  const { t } = useTranslation();
  return <DialogContent className={cn('baitly-supervision-surface baitly-action-modal', className)}
    style={{ width: 'calc(100% - var(--bui-modal-gutter, 32px))', ...style }} showCloseButton={false} {...props}>
    {children}
    {showCloseButton && <DialogClose asChild>
      <Button variant="ghost" size="icon-sm" className="cn-dialog-close" aria-label={t('common.close', 'Fermer')}><X size={16} /></Button>
    </DialogClose>}
  </DialogContent>;
}

export function ActionModalHeader({ action, agentId = action?.agentId, title, description, children }: {
  action?: PendingAction;
  agentId?: AgentId;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const meta = agentId ? AGENT_META[agentId] : null;
  return (
    <DialogHeader className="baitly-action-modal-header">
      {meta && <div className="baitly-action-modal-agent">
        <AgentIcon token={meta.icon} size={16} strokeWidth={1.75} />
        <span>{t(meta.nameKey)}</span>
      </div>}
      <ActionIllustratedHeading action={action} agentId={agentId}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description ?? action?.title}</DialogDescription>
      </ActionIllustratedHeading>
      {children}
    </DialogHeader>
  );
}

export function ActionModalBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('baitly-action-modal-body', className)} {...props} />;
}

export function ActionModalFooter({ className, ...props }: ComponentProps<typeof DialogFooter>) {
  return <DialogFooter className={cn('flex-row flex-wrap', className)} {...props} />;
}

export function ActionModalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="baitly-action-modal-section"><h3>{title}</h3>{children}</section>;
}

/** Read-only facts stay as text; emphasis never relies on unsafe HTML. */
export function ActionModalFacts({ facts }: { facts: string[] }) {
  return <ul className="baitly-action-modal-facts">{[...new Set(facts)].map((fact) => (
    <li key={fact}><DescriptionNarrative text={fact} /></li>
  ))}</ul>;
}

export function ActionModalLoading() {
  const { t } = useTranslation();
  return <div className="baitly-action-modal-loading" role="status">
    <span className="sr-only">{t('common.loading', 'Chargement…')}</span>
    <Skeleton className="h-4 w-1/3" /><Skeleton className="h-7 w-2/3" />
    <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" />
  </div>;
}
