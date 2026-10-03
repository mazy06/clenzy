import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';

/** A failed request must never look like an empty portfolio. */
export function DashboardWidgetState({ title, error = false, onRetry }: {
  title: string;
  error?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  if (error) return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-col items-start gap-3">
        <strong>{title}</strong>
        <span>{t('dashboard.widgetState.error', 'Les données n’ont pas pu être chargées.')}</span>
        {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t('common.retry', 'Réessayer')}</Button>}
      </AlertDescription>
    </Alert>
  );
  return (
    <section aria-busy="true" aria-label={title} className="min-h-40 space-y-4 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
      <h3 className="m-0 text-sm font-semibold">{title}</h3>
      <div aria-hidden="true" className="space-y-3">
        {[80, 65, 90].map((width) => <Skeleton key={width} className="h-4 motion-reduce:animate-none" style={{ width: `${width}%` }} />)}
      </div>
    </section>
  );
}

/** Mount expensive imported reports once, shortly before they enter the viewport. */
export function DeferredDashboardWidget({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (visible || !ref.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);
  return <div ref={ref} className="db-widget-deferred">{visible ? children : <DashboardWidgetState title={title} />}</div>;
}
