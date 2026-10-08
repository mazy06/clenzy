import { useId, useState, type CSSProperties } from 'react';
import { Check, Clock, Hourglass, MapPin, Send, TicketPercent, Key } from '../../icons/glyphs';
import { Packshot, StageCard } from '../../components/baitly/FirstUseStage';
import { STAGE_IMAGES, apartmentPhoto, villaPhoto } from '../../components/baitly/stageImages';
import { useTranslation } from '../../hooks/useTranslation';
import airbnbLogo from '../../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../assets/logo/booking-logo-small.svg';
import vrboLogo from '../../assets/logo/vrbo-logo-small.svg';

/**
 * Aperçus des écrans Propriétés, posés sur la scène bleu nuit.
 *
 * Le texte se réduit à ce qui ne peut pas se dessiner : un nom, un prix, une
 * heure. Le reste passe par l'illustration (les packshots générés des
 * indicateurs), les logos de canaux et les gestes (sélecteurs, curseur).
 * Données locales d'illustration : aucune mutation du portefeuille.
 */

export interface PropertyDemoProps { scene: number; onSelect: (scene: number) => void }

function useDemoFormatting() {
  const { currentLanguage } = useTranslation();
  return {
    number: (value: number) => value.toLocaleString(currentLanguage),
    money: (value: number) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value),
  };
}

const CHANNELS = [airbnbLogo, bookingLogo, vrboLogo];

/** Fiche logement : la scène active met en avant la zone qu'elle raconte. */
export function PropertyDemo({ scene, onSelect }: PropertyDemoProps) {
  const { t } = useTranslation();
  const { number, money } = useDemoFormatting();
  const [selected, setSelected] = useState(0);
  const prefix = 'propertiesFirstUse.properties.demo';
  const homes = [
    { name: t('propertiesFirstUse.exampleHome'), city: 'Paris', image: apartmentPhoto, guests: 4, rooms: 2, baths: 1, price: 100 },
    { name: t(`${prefix}.villa`), city: 'Marrakech', image: villaPhoto, guests: 6, rooms: 3, baths: 2, price: 180 },
  ];
  const home = homes[selected];
  const specs = [
    { key: 'guests', image: STAGE_IMAGES.capacity, value: home.guests, label: t(`${prefix}.guests`, { count: home.guests }) },
    { key: 'rooms', image: STAGE_IMAGES.bedrooms, value: home.rooms, label: t(`${prefix}.rooms`, { count: home.rooms }) },
    { key: 'baths', image: STAGE_IMAGES.bathrooms, value: home.baths, label: t(`${prefix}.baths`, { count: home.baths }) },
  ];
  return (
    <StageCard>
      <div className="mb-3 flex gap-2" role="group" aria-label={t(`${prefix}.choose`)}>
        {homes.map((item, index) => (
          <button key={item.name} type="button" aria-pressed={selected === index} className="pr-choice min-w-0 flex-1 truncate" onClick={() => { setSelected(index); onSelect(0); }}>
            {item.name}
          </button>
        ))}
      </div>

      <div key={selected} className="pr-cover ns-swap ns-hl" data-hl={scene === 0}>
        <img src={home.image} alt="" />
        <div className="pr-cover-top">
          <span className="pr-pill">{t(`${prefix}.active`)}</span>
          <span className="pr-logos ns-hl" data-hl={scene === 3} role="img" aria-label={t(`${prefix}.channels`)}>
            {CHANNELS.slice(0, 2).map((logo, index) => (
              <span key={logo}>
                <img src={logo} alt="" />
                {scene === 3 && (
                  <span className="ns-pop absolute -end-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-[var(--ns-ok)] text-[var(--ns-on-ok)]" style={{ '--d': `${index * 160}ms` } as CSSProperties}>
                    <Check size={9} strokeWidth={3} />
                  </span>
                )}
              </span>
            ))}
          </span>
        </div>
        <div className="pr-cover-bottom">
          <span className="min-w-0">
            <strong className="block truncate text-base font-semibold">{home.name}</strong>
            <span className="flex items-center gap-1 text-xs text-white/80"><MapPin className="size-3" aria-hidden />{home.city}</span>
          </span>
        </div>
      </div>

      <div className="pr-spec">
        {specs.map((spec) => (
          <span key={spec.key} className="pr-spec-item ns-hl" data-hl={scene === 1} role="img" aria-label={spec.label}>
            <Packshot src={spec.image} size="sm" bare />
            {number(spec.value)}
          </span>
        ))}
        <span className="pr-spec-item pr-spec-item--price ns-hl" data-hl={scene === 0} aria-label={`${money(home.price)} ${t(`${prefix}.night`)}`}>
          {money(home.price)}<small>{t(`${prefix}.night`)}</small>
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="ns-chip ns-hl" data-hl={scene === 2} role="img" aria-label={t(`${prefix}.arrival`)}>
          <Clock aria-hidden />15:00
        </span>
        <span className="ns-chip ns-hl" data-hl={scene === 2} aria-hidden><Key /></span>
      </div>
    </StageCard>
  );
}

/** Tarif de base, semaine, curseur : on règle une nuit et on voit le prix suivre. */
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
    <StageCard>
      <div className="flex items-center gap-3">
        <Packshot src={STAGE_IMAGES.adr} size="lg" bare className="ns-hl" />
        <div className="pr-price ns-hl rounded-lg" data-hl={scene === 0} aria-label={`${t(`${prefix}.base`)} ${money(100)}`}>
          <strong>{money(100)}</strong><span>{t(`${prefix}.night`)}</span>
        </div>
        <span className="ms-auto"><Packshot src={STAGE_IMAGES.pricingSeasons} size="lg" /></span>
      </div>

      <div className="my-3 grid grid-cols-7 gap-1 rounded-xl ns-hl" data-hl={scene === 1} role="group" aria-label={t(`${prefix}.week`)}>
        {Array.from({ length: 7 }, (_, index) => {
          const value = index === selectedDay ? price : scene > 0 && (index === 4 || index === 5) ? 125 : 100;
          return (
            <button key={index} type="button" className="pr-date" aria-pressed={selectedDay === index}
              aria-label={t(`${prefix}.selectDay`, { day: dateLabel(index), price: money(value) })}
              onClick={() => { setSelectedDay(index); setCustomPrice(null); setPublished(false); onSelect(1); }}>
              <span className="block text-[10px] opacity-70">{dateLabel(index)}</span>
              <span className="mt-0.5 block text-xs tabular-nums">{number(14 + index)}</span>
              <span className={`mt-2 block text-xs font-semibold tabular-nums ${value > 100 ? 'text-[var(--ns-brass-ink)]' : 'text-[var(--ns-text)]'}`}>{number(value)}</span>
            </button>
          );
        })}
      </div>

      <div>
        <label htmlFor={id} className="flex items-center justify-between gap-3 text-xs font-medium text-[var(--ns-soft)]">
          <span>{dateLabel(selectedDay)}</span>
          <output className="text-base tabular-nums text-[var(--ns-ink)]" htmlFor={id}>{money(price)}</output>
        </label>
        <input id={id} type="range" min={80} max={180} step={5} value={price} aria-valuetext={money(price)} aria-label={t(`${prefix}.adjust`, { day: dateLabel(selectedDay) })}
          className="pr-range mt-2 w-full cursor-pointer"
          onChange={(event) => { setCustomPrice(Number(event.target.value)); setPublished(false); onSelect(1); }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="ns-chip ns-hl" data-hl={scene === 2} role="img" aria-label={`${t(`${prefix}.minimum`)} ${t(`${prefix}.nights`, { count: 2 })}`}>
          <Hourglass aria-hidden />≥ {number(2)}
        </span>
        <button type="button" className="pr-send ns-hl" data-hl={scene === 3} disabled={published}
          aria-label={t(`${prefix}.${published ? 'done' : 'try'}`)} onClick={() => { setPublished(true); onSelect(3); }}>
          {published ? <Check className="size-4 text-[var(--ns-ok)]" aria-hidden /> : <Send className="size-4 rtl:-scale-x-100" aria-hidden />}
          {CHANNELS.map((logo) => <img key={logo} src={logo} alt="" />)}
        </button>
      </div>
      <span className="sr-only" role="status">{published ? t(`${prefix}.published`) : ''}</span>
    </StageCard>
  );
}

/** Une offre : le ticket, ce qu'il change sur un séjour, l'effet mesuré. */
export function VoucherDemo({ scene, onSelect }: PropertyDemoProps) {
  const { t } = useTranslation();
  const { number, money } = useDemoFormatting();
  const [discount, setDiscount] = useState(10);
  const [applied, setApplied] = useState(false);
  const prefix = 'propertiesFirstUse.vouchers.demo';
  const savings = applied ? (300 * discount) / 100 : 0;
  return (
    <StageCard>
      <div className="pr-ticket ns-hl" data-hl={scene === 0}>
        <Packshot src={STAGE_IMAGES.promotion} size="lg" />
        <div className="min-w-0">
          <span className="block text-xs text-[var(--ns-muted)]"><TicketPercent className="me-1 inline size-3.5 align-[-2px] text-[var(--ns-brass)]" aria-hidden />{t(`${prefix}.code`)}</span>
          <span className="pr-ticket-code" dir="ltr">BIENVENUE{discount}</span>
        </div>
        <strong className="pr-ticket-value">−{number(discount)} %</strong>
      </div>
      <div className="mt-3 flex gap-2" role="group" aria-label={t(`${prefix}.discount`)}>
        {[10, 20].map((value) => (
          <button key={value} type="button" className="pr-choice flex-1" aria-pressed={discount === value} onClick={() => { setDiscount(value); setApplied(false); onSelect(0); }}>
            {number(value)} %
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-xl p-2 ns-hl" data-hl={scene === 1}>
        <span className="relative block size-11 shrink-0 overflow-hidden rounded-lg"><img src={apartmentPhoto} alt="" className="size-full object-cover" /></span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ns-ink)]">{t('propertiesFirstUse.exampleHome')}</span>
        <Packshot src={STAGE_IMAGES.calendar} size="sm" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <dl className="pr-receipt rounded-xl p-2 ns-hl" data-hl={scene === 2}>
          <div><dt>{t(`${prefix}.stay`)}</dt><dd>{money(300)}</dd></div>
          <div className="pr-receipt-save"><dt>{t(`${prefix}.reduction`)}</dt><dd>{savings ? `−${money(savings)}` : '—'}</dd></div>
          <div><dt>{t(`${prefix}.total`)}</dt><dd aria-live="polite">{money(300 - savings)}</dd></div>
        </dl>
        <button type="button" className="pr-send justify-center" disabled={applied} onClick={() => { setApplied(true); onSelect(2); }}>
          {applied ? <Check className="size-4 text-[var(--ns-ok)]" aria-hidden /> : <TicketPercent className="size-4" aria-hidden />}
          <span className="text-xs font-medium">{t(`${prefix}.${applied ? 'applied' : 'apply'}`)}</span>
        </button>
      </div>

      {/* L'effet mesuré : toujours là, il se remplit à l'étape du suivi. */}
      <div className="pr-uses ns-hl mt-3 rounded-lg px-2 pt-2 transition-opacity duration-300" data-hl={scene === 3} style={{ opacity: scene === 3 ? 1 : 0.4 }} role="img" aria-label={t(`${prefix}.uses`)}>
        {[0.3, 0.5, 0.4, 0.75, 0.6, 0.95].map((height, index) => (
          <span key={`${scene === 3}-${index}`} className={scene === 3 ? 'ns-grow' : undefined} style={{ blockSize: `${height * 100}%`, '--d': `${index * 60}ms` } as CSSProperties} />
        ))}
      </div>
    </StageCard>
  );
}

export { default as DevicesDemo } from './ConnectedRoomsDemo';
