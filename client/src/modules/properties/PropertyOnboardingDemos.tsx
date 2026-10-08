import { useId, useState, type ReactNode } from 'react';
import { BedDoubleIcon, UsersIcon, MapPinIcon, CheckIcon, LinkIcon, LockKeyholeIcon, LockKeyholeOpenIcon, Volume2Icon, ThermometerIcon, BatteryIcon, ArrowRightIcon } from '../../icons/glyphs';
import { Button, Card } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import apartmentImage from '../../assets/images/appartement.png';
import villaImage from '../../assets/images/villa.png';
import { cn } from '../../utils/cn';

export interface PropertyDemoProps { scene: number; onSelect: (scene: number) => void }

function Panel({ active, children, className }: { active?: boolean; children: ReactNode; className?: string }) {
  return <Card className={cn('pr-empty-panel min-w-0 p-3', className)} data-active={active}>{children}</Card>;
}

function useDemoFormatting() {
  const { currentLanguage } = useTranslation();
  return {
    number: (value: number) => value.toLocaleString(currentLanguage),
    money: (value: number) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value),
  };
}

/** Données locales d'illustration : aucune mutation du portefeuille ni des objets. */
export function PropertyDemo({ scene, onSelect }: PropertyDemoProps) {
  const { t } = useTranslation();
  const { number, money } = useDemoFormatting();
  const [selected, setSelected] = useState(0);
  const prefix = 'propertiesFirstUse.properties.demo';
  const homes = [
    { name: t('propertiesFirstUse.exampleHome'), city: 'Paris', image: apartmentImage, guests: 4, rooms: 2, price: 100 },
    { name: t(`${prefix}.villa`), city: 'Marrakech', image: villaImage, guests: 6, rooms: 3, price: 180 },
  ];
  const home = homes[selected];
  return (
    <div className="pr-empty-demo-body">
      <div className="mb-3 flex gap-2" role="group" aria-label={t(`${prefix}.choose`)}>
        {homes.map((item, index) => <button key={item.name} type="button" aria-pressed={selected === index} className="pr-empty-choice min-w-0 flex-1 truncate" onClick={() => { setSelected(index); onSelect(0); }}>{item.name}</button>)}
      </div>
      <Panel active={scene === 0} className="overflow-hidden p-0">
        <div className="pr-empty-home-cover">
          <img src={home.image} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div><h4 className="m-0 text-base font-semibold text-foreground">{home.name}</h4><p className="m-0 mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPinIcon className="size-3" aria-hidden />{home.city}</p></div>
            <span className="rounded-md bg-success-soft px-2 py-1 text-[11px] font-medium text-success-ink">{t(`${prefix}.active`)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><UsersIcon className="size-3.5" aria-hidden />{t(`${prefix}.guests`, { count: home.guests })}</span>
            <span className="flex items-center gap-1.5"><BedDoubleIcon className="size-3.5" aria-hidden />{t(`${prefix}.rooms`, { count: home.rooms })}</span>
            <span className="ms-auto font-medium tabular-nums text-foreground">{money(home.price)}<span className="font-normal text-muted-foreground"> {t(`${prefix}.night`)}</span></span>
          </div>
        </div>
      </Panel>
      <div className="mt-3" key={scene}>
        <Panel active className="pr-empty-appear">
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-foreground">
            <span>{t(`${prefix}.focus.${scene}.label`)}</span>
            {scene === 3 ? <LinkIcon className="size-4 text-success-ink" aria-hidden /> : <span className="tabular-nums text-muted-foreground">{scene === 2 ? '15:00' : `${number(home.rooms)} / ${number(home.rooms)}`}</span>}
          </div>
          <p className="m-0 mt-2 text-xs leading-relaxed text-muted-foreground">{t(`${prefix}.focus.${scene}.detail`)}</p>
        </Panel>
      </div>
    </div>
  );
}

export function PricingDemo({ scene, onSelect }: PropertyDemoProps) {
  const { t, currentLanguage } = useTranslation();
  const { number, money } = useDemoFormatting();
  const id = useId();
  const [selectedDay, setSelectedDay] = useState(4);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [published, setPublished] = useState(false);
  const prefix = 'propertiesFirstUse.pricing.demo';
  const price = customPrice ?? (selectedDay >= 4 && selectedDay <= 5 && scene > 0 ? 125 : 100);
  const dateLabel = (day: number) => new Intl.DateTimeFormat(currentLanguage, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 8, 14 + day)));
  return (
    <div className="pr-empty-demo-body">
      <Panel active={scene === 0}>
        <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium text-foreground">{t('propertiesFirstUse.exampleHome')}</span><span className="text-muted-foreground">{t(`${prefix}.base`)}</span></div>
        <div className="mt-2 flex items-baseline gap-1.5"><strong className="text-2xl font-semibold tabular-nums">{money(100)}</strong><span className="text-xs text-muted-foreground">{t(`${prefix}.night`)}</span></div>
      </Panel>
      <div className="my-3 grid grid-cols-7 gap-1" role="group" aria-label={t(`${prefix}.week`)}>
        {Array.from({ length: 7 }, (_, index) => {
          const value = index === selectedDay ? price : scene > 0 && (index === 4 || index === 5) ? 125 : 100;
          return <button key={index} type="button" className="pr-empty-date" aria-pressed={selectedDay === index} aria-label={t(`${prefix}.selectDay`, { day: dateLabel(index), price: money(value) })} onClick={() => { setSelectedDay(index); setCustomPrice(null); setPublished(false); onSelect(1); }}>
            <span className="block text-[10px] text-muted-foreground">{dateLabel(index)}</span>
            <span className="mt-1 block text-xs tabular-nums text-foreground">{number(14 + index)}</span>
            <span className="mt-3 block text-xs font-semibold tabular-nums text-primary">{number(value)}</span>
          </button>;
        })}
      </div>
      <Panel active={scene === 1}>
        <label htmlFor={id} className="flex items-center justify-between gap-3 text-xs font-medium text-foreground"><span>{t(`${prefix}.adjust`, { day: dateLabel(selectedDay) })}</span><output className="text-base tabular-nums" htmlFor={id}>{money(price)}</output></label>
        <input id={id} type="range" min={80} max={180} step={5} value={price} aria-valuetext={money(price)} className="pr-empty-range mt-3 w-full cursor-pointer" onChange={(event) => { setCustomPrice(Number(event.target.value)); setPublished(false); onSelect(1); }} />
        <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground"><span>{money(80)}</span><span>{money(180)}</span></div>
      </Panel>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-3 py-2.5" data-active={scene === 2}>
        <span className={cn('text-xs', scene === 2 ? 'font-medium text-foreground' : 'text-muted-foreground')}>{t(`${prefix}.minimum`)}</span>
        <span className="text-xs font-medium tabular-nums text-foreground">{t(`${prefix}.nights`, { count: 2 })}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground" role="status">{t(`${prefix}.${published ? 'published' : 'channels'}`)}</span>
        <Button size="sm" variant="outline" onClick={() => { setPublished(true); onSelect(3); }} disabled={published}>{published ? <CheckIcon className="size-3.5" aria-hidden /> : <ArrowRightIcon className="size-3.5 rtl:rotate-180" aria-hidden />}{t(`${prefix}.${published ? 'done' : 'try'}`)}</Button>
      </div>
    </div>
  );
}

export function VoucherDemo({ scene, onSelect }: PropertyDemoProps) {
  const { t } = useTranslation();
  const { number, money } = useDemoFormatting();
  const [discount, setDiscount] = useState(10);
  const [applied, setApplied] = useState(false);
  const prefix = 'propertiesFirstUse.vouchers.demo';
  const savings = applied ? 300 * discount / 100 : 0;
  return (
    <div className="pr-empty-demo-body">
      <Panel active={scene === 0}>
        <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{t(`${prefix}.code`)}</span><span className="rounded-md bg-info-soft px-2 py-1 text-[11px] text-info-ink">{t(`${prefix}.draft`)}</span></div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><span className="font-mono text-lg font-semibold tracking-wider text-foreground" dir="ltr">BIENVENUE{discount}</span><strong className="text-xl font-semibold tabular-nums text-primary">−{number(discount)} %</strong></div>
        <div className="mt-3 flex gap-2" role="group" aria-label={t(`${prefix}.discount`)}>{[10, 20].map((value) => <button key={value} type="button" className="pr-empty-choice flex-1" aria-pressed={discount === value} onClick={() => { setDiscount(value); setApplied(false); onSelect(0); }}>{number(value)} %</button>)}</div>
      </Panel>
      <div className="my-3"><Panel active={scene === 1}><div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">{t(`${prefix}.scope`)}</span><span className="font-medium text-foreground">{t('propertiesFirstUse.exampleHome')}</span></div><p className="m-0 mt-2 text-[11px] leading-relaxed text-muted-foreground">{t(`${prefix}.conditions`)}</p></Panel></div>
      <Panel active={scene === 2}>
        <h4 className="m-0 text-xs font-medium text-foreground">{t(`${prefix}.stay`)}</h4>
        <dl className="m-0 mt-3 flex flex-col gap-2 text-xs">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t(`${prefix}.subtotal`)}</dt><dd className="m-0 tabular-nums">{money(300)}</dd></div>
          <div className="flex justify-between gap-3 text-success-ink"><dt>{t(`${prefix}.reduction`)}</dt><dd className="m-0 tabular-nums">−{money(savings)}</dd></div>
          <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold"><dt>{t(`${prefix}.total`)}</dt><dd className="m-0 text-base tabular-nums" aria-live="polite">{money(300 - savings)}</dd></div>
        </dl>
        <Button size="sm" variant="outline" className="mt-3 self-start" onClick={() => { setApplied(true); onSelect(2); }} disabled={applied}>{applied && <CheckIcon className="size-3.5" aria-hidden />}{t(`${prefix}.${applied ? 'applied' : 'apply'}`)}</Button>
      </Panel>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" key={scene}><span className="pr-empty-appear">{t(`${prefix}.${scene === 3 ? 'tracking' : 'note'}`)}</span></div>
    </div>
  );
}

export function DevicesDemo({ scene, onSelect }: PropertyDemoProps) {
  const { t } = useTranslation();
  const { number } = useDemoFormatting();
  const [locked, setLocked] = useState(true);
  const [sensor, setSensor] = useState<'noise' | 'climate'>('noise');
  const prefix = 'propertiesFirstUse.connected-objects.demo';
  const LockIcon = locked ? LockKeyholeIcon : LockKeyholeOpenIcon;
  return (
    <div className="pr-empty-demo-body">
      <div className="mb-3 flex items-center justify-between gap-2 px-1 text-xs"><span className="font-medium text-foreground">{t('propertiesFirstUse.exampleHome')}</span><span className="text-success-ink">{t(`${prefix}.online`, { count: 3 })}</span></div>
      <Panel active={scene === 0}>
        <div className="flex items-start gap-3"><LockIcon className="pr-empty-lock mt-1 size-6 shrink-0 text-primary" key={String(locked)} aria-hidden /><div className="flex-1"><h4 className="m-0 text-sm font-medium text-foreground">{t(`${prefix}.entrance`)}</h4><p className="m-0 mt-1 text-xs text-success-ink" aria-live="polite">{t(`${prefix}.${locked ? 'locked' : 'unlocked'}`)}</p></div><span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground"><BatteryIcon className="size-4" aria-hidden />{number(86)} %</span></div>
        <Button size="sm" variant="outline" className="mt-3 self-start" onClick={() => { setLocked(!locked); onSelect(0); }}>{t(`${prefix}.${locked ? 'unlock' : 'lock'}`)}</Button>
      </Panel>
      <div className="my-3"><Panel active={scene === 1}>
        <div className="flex gap-2" role="group" aria-label={t(`${prefix}.sensors`)}>
          {[{ key: 'noise' as const, Icon: Volume2Icon }, { key: 'climate' as const, Icon: ThermometerIcon }].map(({ key, Icon }) => <button key={key} type="button" className="pr-empty-choice flex flex-1 items-center justify-center gap-2" aria-pressed={sensor === key} onClick={() => { setSensor(key); onSelect(1); }}><Icon className="size-3.5" aria-hidden />{t(`${prefix}.${key}`)}</button>)}
        </div>
        <div className="mt-3 flex items-baseline gap-2"><strong className="text-2xl font-semibold tabular-nums text-foreground">{number(sensor === 'noise' ? 44 : 22)}</strong><span className="text-xs text-muted-foreground">{sensor === 'noise' ? 'dB' : '°C'}</span><span className="ms-auto text-xs text-success-ink">{t(`${prefix}.normal`)}</span></div>
        <div className="pr-empty-sensor-track mt-3" aria-hidden><span key={`${scene}-${sensor}`} className={scene === 1 ? 'pr-empty-sensor-fill pr-empty-sensor-animated' : 'pr-empty-sensor-fill'} /></div>
      </Panel></div>
      <Panel active={scene === 2} className={scene === 2 ? 'bg-warning-soft' : ''}>
        <div className="flex items-start gap-2"><BatteryIcon className={cn('mt-0.5 size-4 shrink-0', scene === 2 ? 'text-warning-ink' : 'text-muted-foreground')} aria-hidden /><div><h4 className={cn('m-0 text-xs font-medium', scene === 2 ? 'text-warning-ink' : 'text-foreground')}>{t(`${prefix}.${scene === 2 ? 'batteryAlert' : 'monitoring'}`)}</h4><p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground">{t(`${prefix}.${scene === 2 ? 'batteryDetail' : 'monitoringDetail'}`)}</p></div></div>
      </Panel>
      <p className="m-0 mt-3 text-[11px] leading-relaxed text-muted-foreground">{t(`${prefix}.${scene === 3 ? 'grouping' : 'simulation'}`)}</p>
    </div>
  );
}
