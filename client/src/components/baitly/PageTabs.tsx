import * as React from 'react';
import { Badge, Tabs, TabsList, TabsTrigger } from '../ui';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/PageTabs.tsx (MUI), construit sur Tabs
 * (variante line = soulignement, fidèle aux onglets niveau 1 maison).
 * Même contrat : `value` omis sur une option → index VISIBLE utilisé.
 */
export interface PageTabItem<T extends string | number = number> {
  value?: T;
  /** Clé stable pour la navigation par URL (cf. tabKeyParam). */
  key?: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  badgeColor?: 'error' | 'warning' | 'primary' | 'info' | 'success';
  hidden?: boolean;
  disabled?: boolean;
}

export interface PageTabsProps<T extends string | number> {
  options: PageTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Slot rendu à droite des onglets (actions contextuelles). */
  inlineActions?: React.ReactNode;
  size?: 'comfortable' | 'compact';
  className?: string;
  ariaLabel?: string;
}

const BADGE_VARIANT: Record<NonNullable<PageTabItem['badgeColor']>, 'destructive' | 'warning' | 'default' | 'info' | 'success'> = {
  error: 'destructive',
  warning: 'warning',
  primary: 'default',
  info: 'info',
  success: 'success',
};

export default function PageTabs<T extends string | number = number>({
  options,
  value,
  onChange,
  inlineActions,
  size = 'comfortable',
  className,
  ariaLabel,
}: PageTabsProps<T>) {
  const visible = options.filter((opt) => !opt.hidden);
  const valueOf = (opt: PageTabItem<T>, index: number) => (opt.value ?? index) as T;
  const active = visible.findIndex((opt, index) => valueOf(opt, index) === value);

  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3 border-b border-border', className)}>
      <Tabs
        value={String(active >= 0 ? active : 0)}
        onValueChange={(next) => {
          const index = Number(next);
          const opt = visible[index];
          if (opt && !opt.disabled) onChange(valueOf(opt, index));
        }}
      >
        <TabsList variant="line" aria-label={ariaLabel} className="flex-wrap">
          {visible.map((opt, index) => (
            <TabsTrigger
              key={opt.key ?? String(valueOf(opt, index))}
              value={String(index)}
              disabled={opt.disabled}
              className={cn(size === 'compact' ? 'text-xs' : 'text-sm')}
            >
              {opt.icon}
              {opt.label}
              {opt.badge !== undefined && opt.badge > 0 && (
                <Badge variant={BADGE_VARIANT[opt.badgeColor ?? 'primary']} className="px-1.5 py-0 text-2xs">
                  {opt.badge}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {inlineActions && <div className="mb-1 flex items-center gap-2">{inlineActions}</div>}
    </div>
  );
}
