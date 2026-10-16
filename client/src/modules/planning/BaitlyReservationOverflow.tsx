import React from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui';

export interface BaitlyReservationDetail {
  key: string;
  label: string;
  color?: string;
  icon: React.ReactNode;
  alert?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}

/** Les détails repliés gardent leurs actions au doigt et au clavier. */
export function BaitlyReservationOverflow({ items, open, onOpenChange, className, color }: {
  items: BaitlyReservationDetail[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  color: string;
}) {
  const { t } = useTranslation();
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className={className} style={{ color }}
          aria-label={`${t('planning.hiddenIndicators', { count: items.length })} : ${items.map((item) => item.label).join(', ')}`}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}>
          +{items.length}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[min(320px,calc(100vw-24px))] p-2" align="end"
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        {[true, false].map((alert) => {
          const group = items.filter((item) => Boolean(item.alert) === alert);
          if (!group.length) return null;
          return <section key={String(alert)} className="mb-2 last:mb-0">
            <h3 className="text-xs font-medium text-[var(--bui-muted-foreground)] mb-1">
              {alert ? t('planning.bar.alerts', 'À vérifier') : t('planning.bar.details', 'Détails')}
            </h3>
            <ul className="list-none m-0 p-0 flex flex-col gap-1">
              {group.map((item) => <li key={item.key}>
                {item.onClick ? <button type="button"
                  className="flex items-center gap-2 w-full rounded-md p-1 text-start text-xs text-[var(--bui-foreground)] cursor-pointer hover:bg-[var(--bui-muted)] focus-visible:outline-2 focus-visible:outline-[var(--bui-primary)]"
                  onClick={(event) => { item.onClick?.(event); onOpenChange(false); }}>
                  <span className="inline-flex shrink-0" style={{ color: item.color }}>{item.icon}</span>{item.label}
                </button> : <div className="flex items-center gap-2 p-1 text-xs text-[var(--bui-foreground)]">
                  <span className="inline-flex shrink-0" style={{ color: item.color }}>{item.icon}</span>{item.label}
                </div>}
              </li>)}
            </ul>
          </section>;
        })}
      </PopoverContent>
    </Popover>
  );
}
