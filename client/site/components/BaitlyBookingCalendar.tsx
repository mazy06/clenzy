import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import {
  dateISO,
  formatBookingDate,
  formatBookingNights,
  getBookingDemoProperties,
  isBookingDayUnavailable,
} from '../lib/bookingDemoStay';
import { BOOKING_STAY_COPY } from '../lib/messages/baitlyBookingStay';
import { BOOKING_STOREFRONT_COPY } from '../lib/messages/baitlyBookingStorefront';
import { useSiteLanguage } from '../lib/siteLanguage';
import BaitlyDemoPointer from './BaitlyDemoPointer';
import type { StepProps } from './BaitlyBookingSteps';
import '../baitly-booking-stay.css';

export default function BaitlyBookingCalendar({ demo, m, money }: StepProps) {
  const { language } = useSiteLanguage();
  const c = BOOKING_STAY_COPY[language];
  const s = BOOKING_STOREFRONT_COPY[language];
  const properties = getBookingDemoProperties(demo.templateIndex, language);
  const nightly =
    properties
      .filter((property) => demo.propertyIds.includes(property.id))
      .reduce((sum, property) => sum + property.nightly, 0) ||
    properties[0].nightly;
  const pickingDeparture = !demo.dates.departure;
  return (
    <div className="bb-stay-calendar">
      <span className="bb-section-kicker">{c.calendar}</span>
      <h4 tabIndex={-1}>{m.dates}</h4>
      <p className="bb-small-copy">{c.dateIntro}</p>
      <div className="bb-calendar-inputs">
        <div data-active={!pickingDeparture}>
          <CalendarDaysIcon />
          <span>
            {m.arrival}
            <strong>{formatBookingDate(demo.dates.arrival, language)}</strong>
          </span>
        </div>
        <ArrowRightIcon aria-hidden="true" />
        <div data-active={pickingDeparture}>
          <CalendarDaysIcon />
          <span>
            {m.departure}
            <strong>
              {demo.dates.departure
                ? formatBookingDate(demo.dates.departure, language)
                : c.chooseDeparture}
            </strong>
          </span>
        </div>
      </div>
      <div className="bb-calendar-controls">
        <span role="status" aria-live={demo.playing ? 'off' : 'polite'}>
          {pickingDeparture ? c.chooseDeparture : c.chooseArrival}
        </span>
        <div>
          <button
            type="button"
            aria-label={c.previousMonth}
            disabled={demo.calendarMonth === 0}
            onClick={() => demo.changeCalendarMonth(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            aria-label={c.nextMonth}
            disabled={demo.calendarMonth === 11}
            onClick={() => demo.changeCalendarMonth(1)}
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
      <div className="bb-calendar-months" role="group" aria-label={c.calendar}>
        {[0, 1].map((offset) => {
          const month = new Date(
            Date.UTC(2026, 9 + demo.calendarMonth + offset, 1, 12),
          );
          const monthLabel = new Intl.DateTimeFormat(language, {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(month);
          const blankCount = (month.getUTCDay() + 6) % 7;
          const dayCount = new Date(
            Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
          ).getUTCDate();
          return (
            <section
              className="bb-calendar-page"
              key={month.toISOString()}
              aria-label={monthLabel}
            >
              <h5>{monthLabel}</h5>
              <div className="bb-date-grid">
                {s.weekdays.map((weekday, i) => (
                  <small aria-hidden="true" key={`weekday-${i}`}>
                    {weekday}
                  </small>
                ))}
                {Array.from({ length: blankCount }, (_, i) => (
                  <span aria-hidden="true" key={`blank-${i}`} />
                ))}
                {Array.from({ length: dayCount }, (_, i) => {
                  const date = new Date(
                    Date.UTC(
                      month.getUTCFullYear(),
                      month.getUTCMonth(),
                      i + 1,
                      12,
                    ),
                  );
                  const iso = dateISO(date);
                  const unavailable = isBookingDayUnavailable(iso);
                  const endpoint =
                    iso === demo.dates.arrival || iso === demo.dates.departure;
                  const inRange =
                    !!demo.dates.departure &&
                    iso > demo.dates.arrival &&
                    iso < demo.dates.departure;
                  return (
                    <button
                      type="button"
                      key={iso}
                      className="bb-date-cell bb-demo-target"
                      data-range={inRange}
                      data-endpoint={endpoint}
                      aria-pressed={endpoint || inRange}
                      aria-label={`${formatBookingDate(
                        iso,
                        language,
                        true,
                      )} · ${unavailable ? c.unavailable : money.label(nightly)}`}
                      disabled={unavailable}
                      onClick={() => demo.selectDate(iso)}
                      onKeyDown={(event) => {
                        const rtl = language === 'ar';
                        const delta =
                          event.key === 'ArrowRight'
                            ? rtl
                              ? -1
                              : 1
                            : event.key === 'ArrowLeft'
                            ? rtl
                              ? 1
                              : -1
                            : event.key === 'ArrowDown'
                            ? 7
                            : event.key === 'ArrowUp'
                            ? -7
                            : 0;
                        if (!delta) return;
                        event.preventDefault();
                        const cells = Array.from(
                          event.currentTarget
                            .closest('.bb-calendar-months')!
                            .querySelectorAll<HTMLButtonElement>(
                              '.bb-date-cell',
                            ),
                        );
                        let target = cells.indexOf(event.currentTarget) + delta;
                        while (cells[target]?.disabled)
                          target += Math.sign(delta);
                        cells[target]?.focus();
                      }}
                    >
                      <span>
                        {new Intl.NumberFormat(language).format(i + 1)}
                      </span>
                      <small>{unavailable ? '·' : money(nightly)}</small>
                      <BaitlyDemoPointer
                        {...demo.pointer}
                        show={
                          ['arrival', 'departure'].includes(
                            demo.pointer.target ?? '',
                          ) && demo.pointer.date === iso
                        }
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <div className="bb-calendar-legend">
        <span>
          <i />
          {c.unavailable}
        </span>
        <span>
          {c.nightPrice} · {c.sample}
        </span>
      </div>
      {demo.dateError && (
        <p className="bb-calendar-error" role="alert">
          {c.rangeError}
        </p>
      )}
      <div
        className="bb-calendar-result"
        aria-live={demo.playing ? 'off' : 'polite'}
      >
        <span>
          <CheckIcon />
          {demo.dates.departure
            ? formatBookingNights(demo.nights, language)
            : c.chooseDeparture}
        </span>
        {demo.dates.departure && (
          <strong>{money(nightly * demo.nights)}</strong>
        )}
      </div>
      <button
        type="button"
        className="bb-scene-action bb-demo-target"
        disabled={!demo.dates.departure}
        onClick={() => demo.goToStep(demo.datesStep + 1)}
      >
        {demo.templateIndex === 0 ? c.confirmDates : m.availability}
        <ArrowRightIcon />
        <BaitlyDemoPointer
          {...demo.pointer}
          show={demo.pointer.target === 'continue'}
        />
      </button>
    </div>
  );
}
