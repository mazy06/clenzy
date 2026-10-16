import { useId } from 'react';
import { Button, Input, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui';
import { CalendarDays, RotateCcw, X } from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';
import { validMapDay, type BaitlyMapContext, type MapPeriod } from './baitlyMapContext';

export default function BaitlyMapFilters({ context, onChange, onReset, hasArea, onClearArea, issuePeriod = false }: {
  context: BaitlyMapContext; onChange: (next: Partial<BaitlyMapContext>) => void;
  onReset: () => void; hasArea: boolean; onClearArea: () => void;
  issuePeriod?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const invalid = context.period === 'custom' && (!validMapDay(context.from) || !validMapDay(context.to) || context.from > context.to);
  const active = context.period !== 'all' || context.quick !== 'all' || hasArea;
  const periodLabels = { all: 'Toutes les dates', today: 'Aujourd’hui', tomorrow: 'Demain', week: '7 prochains jours', custom: 'Dates personnalisées' };
  const label = t('mapPilot.filters', 'Filtres de la carte');
  const periodLabel = t(`mapPilot.periods.${context.period}`, periodLabels[context.period]);
  return <>
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="baitly-map-tool baitly-map-filter-tool" data-active={active || undefined}
          aria-label={label} title={`${label} · ${periodLabel}`}>
          <CalendarDays size={18} aria-hidden />
          {active && <span aria-hidden className="baitly-map-filter-tool__dot" data-invalid={invalid || undefined} />}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" sideOffset={10} collisionPadding={12}
        className="w-80 max-w-[calc(100vw-24px)] space-y-3 p-3 text-xs" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="m-0 text-sm font-semibold text-foreground">{label}</h3>
      <label htmlFor={`${id}-period`} className="block font-medium text-muted-foreground">{t('mapPilot.period', 'Période')}</label>
    <Select value={context.period} onValueChange={period => onChange({ period: period as MapPeriod })}>
      <SelectTrigger id={`${id}-period`} className="h-9 w-full min-w-0 text-xs" aria-label={t('mapPilot.period', 'Période')}><SelectValue /></SelectTrigger>
      <SelectContent>
        {(['all', 'today', 'tomorrow', 'week', 'custom'] as const).map(period => <SelectItem key={period} value={period}>
          {t(`mapPilot.periods.${period}`, periodLabels[period])}
        </SelectItem>)}
      </SelectContent>
    </Select>
    {context.period === 'custom' && <div className="space-y-2">
      <label htmlFor={`${id}-from`} className="block font-medium text-muted-foreground">{t('mapPilot.from', 'Date de début')}</label>
      <Input id={`${id}-from`} type="date" className="h-9 w-full min-w-0 text-xs" value={context.from} max={context.to || undefined}
        aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} onChange={e => onChange({ from: e.target.value })} />
      <label htmlFor={`${id}-to`} className="block font-medium text-muted-foreground">{t('mapPilot.to', 'Date de fin')}</label>
      <Input id={`${id}-to`} type="date" className="h-9 w-full min-w-0 text-xs" value={context.to} min={context.from || undefined}
        aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} onChange={e => onChange({ to: e.target.value })} />
      {invalid && <p id={`${id}-error`} role="status" className="m-0 text-[var(--bui-warning-ink)]">{t('mapPilot.invalidDates', 'Choisissez une période valide.')}</p>}
    </div>}
    {issuePeriod && <p className="m-0 text-muted-foreground">{t('mapPilot.issuePeriod', 'Anomalies signalées pendant la période sélectionnée.')}</p>}
    {(hasArea || context.quick !== 'all') && <div className="flex flex-wrap gap-2 border-t border-border pt-3">
    {hasArea && <Button variant="outline" size="sm" onClick={onClearArea} className="h-8 text-xs">
      <X className="size-3.5" />{t('mapPilot.clearArea', 'Effacer la zone')}
    </Button>}
    {context.quick !== 'all' && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onChange({ quick: 'all' })}>
      <X className="size-3.5" />{t(`mapPilot.quick.${context.quick}`)}
    </Button>}
    </div>}
      </PopoverContent>
    </Popover>
    <button type="button" className="baitly-map-tool" onClick={onReset}
      aria-label={t('mapPilot.reset', 'Réinitialiser la carte')} title={t('mapPilot.reset', 'Réinitialiser la carte')}>
      <RotateCcw size={18} aria-hidden />
    </button>
  </>;
}
