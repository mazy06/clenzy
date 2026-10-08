import type { ReactNode } from 'react';
import EmptyState from '../../components/EmptyState';
import { Skeleton } from '../../components/ui';
import './propertyTabs.css';

export function PropertyTabHeading({ art, title, description, actions }: {
  art: string; title: string; description?: string; actions?: ReactNode;
}) {
  return <header className="pdt-heading">
    <img src={art} alt="" width={48} height={48} decoding="async" />
    <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
    {actions && <div className="pdt-heading__actions">{actions}</div>}
  </header>;
}

export function PropertyTabEmpty({ art, title, description, action }: {
  art: string; title: string; description?: string; action?: ReactNode;
}) {
  return <EmptyState variant="transparent" icon={<img src={art} alt="" className="pdt-empty-art" />}
    title={title} description={description} action={action} />;
}

export function PropertyTabLoading() {
  return <div className="pdt-loading" aria-busy="true"><Skeleton className="h-16 w-full" />
    <Skeleton className="h-56 w-full" /><Skeleton className="h-16 w-full" /></div>;
}
