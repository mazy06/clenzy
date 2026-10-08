import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Badge } from '../ui/badge';
import { activeIntlLocale } from '../../utils/activeLocale';
import { cn } from '../../utils/cn';
import './widgetPanel.css';

/** Fixed header and footer, with the same density as the dashboard's operation queues. */
export function WidgetPanel({ title, caption, count, action, children, footer, className }: {
  title: string;
  caption?: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const titleId = React.useId();
  return <section className={cn('bui-widget-panel db-widget-surface', className)} aria-labelledby={titleId}>
    <header className="bui-widget-panel__header">
      <div className="bui-widget-panel__heading">
        <h3 id={titleId}>{title}{' '}{count != null && <Badge variant="secondary">{count.toLocaleString(activeIntlLocale())}</Badge>}</h3>
        {caption && <p>{caption}</p>}
      </div>
      {action && <div className="bui-widget-panel__actions">{action}</div>}
    </header>
    {children}
    {footer && <footer className="bui-widget-panel__footer">{footer}</footer>}
  </section>;
}

export function WidgetPanelToggle({ expanded, onToggle, controls, moreLabel, lessLabel }: {
  expanded: boolean;
  onToggle: () => void;
  controls: string;
  moreLabel: string;
  lessLabel: string;
}) {
  return <button type="button" className="bui-widget-panel__link" onClick={onToggle} aria-expanded={expanded} aria-controls={controls}>
    {expanded ? lessLabel : moreLabel}
    <ChevronDownIcon aria-hidden="true" style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
  </button>;
}
