import { useEffect, useRef, useState } from 'react';
import { BAITLY_BOOKING_TEMPLATES } from '../data/baitlyBookingTemplates';
import { getBookingDemoExtras } from '../lib/bookingDemoExtras';
import {
  DEFAULT_BOOKING_DATES,
  addBookingDays,
  bookingDate,
  bookingNights,
  dateISO,
  getBookingDemoAccommodation,
  getBookingDemoProperties,
  isBookingDayUnavailable,
  isBookingRangeAvailable,
  type BookingDemoDates,
} from '../lib/bookingDemoStay';
import { useBaitlyDemoVisibility } from './useBaitlyDemoVisibility';

const END_PHASES = [
  { id: 'first-extra', step: 2, target: 'first-extra', duration: 2600 },
  { id: 'second-extra', step: 2, target: 'second-extra', duration: 2600 },
  { id: 'extras-ready', step: 2, target: 'continue', duration: 3800 },
  { id: 'guest', step: 3, target: 'guest', duration: 2400 },
  { id: 'card', step: 3, target: 'card', duration: 2400 },
  { id: 'pay', step: 3, target: 'pay', duration: 3200 },
  { id: 'processing', step: 3, target: null, duration: 1600 },
  { id: 'confirmation', step: 4, target: 'next-template', duration: 4800 },
] as const;
function getPhases(templateIndex: number) {
  const datesStep = templateIndex === 0 ? 1 : 0;
  const propertyStep = 1 - datesStep;
  const datePhases = [
    { id: 'arrival', step: datesStep, target: 'arrival', duration: 2400 },
    { id: 'departure', step: datesStep, target: 'departure', duration: 2400 },
    { id: 'dates-ready', step: datesStep, target: 'continue', duration: 3000 },
  ];
  const propertyPhases = [
    { id: 'property', step: propertyStep, target: 'property', duration: 2600 },
    {
      id: 'property-ready',
      step: propertyStep,
      target: 'continue',
      duration: 3200,
    },
  ];
  return [
    ...(templateIndex === 0
      ? [...propertyPhases, ...datePhases]
      : [...datePhases, ...propertyPhases]),
    ...END_PHASES,
  ];
}
const emptyExtras = (index: number) =>
  getBookingDemoExtras(index, 'fr').map(() => false);
const defaultProperties = (index: number) => [
  getBookingDemoProperties(index, 'fr')[0].id,
];

/** Ephemeral marketing demo state. Nothing is persisted or sent to the booking API. */
export function useBaitlyBookingDemo() {
  const [templateIndex, setTemplateIndex] = useState(0);
  const [beat, setBeat] = useState(0);
  const [extras, setExtras] = useState<boolean[]>(() => emptyExtras(0));
  const [playing, setPlaying] = useState(true);
  const [manualPayment, setManualPayment] = useState(false);
  const [navigationRequest, setNavigationRequest] = useState(0);
  const [dates, setDates] = useState<BookingDemoDates>(DEFAULT_BOOKING_DATES);
  const [propertyIds, setPropertyIds] = useState<string[]>(() =>
    defaultProperties(0),
  );
  const [calendarMonth, setCalendarMonth] = useState(0);
  const [dateError, setDateError] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const { visibilityRef, active, reduced } = useBaitlyDemoVisibility();
  const phases = getPhases(templateIndex);
  const phaseIndex = (id: string) =>
    phases.findIndex((phase) => phase.id === id);
  const phase = phases[beat];
  const step = phase.step;
  const datesStep = templateIndex === 0 ? 1 : 0;
  const propertyStep = 1 - datesStep;
  const nights = bookingNights(dates);
  const accommodation = getBookingDemoAccommodation(
    templateIndex,
    propertyIds,
    dates,
  );
  const canContinue = !!dates.departure && propertyIds.length > 0;
  const autoArrival = dateISO(
    new Date(Date.UTC(2026, 9 + calendarMonth, 12, 12)),
  );
  // A manual arrival stays in place when autoplay resumes; use the next available departure.
  let autoDeparture = addBookingDays(dates.arrival, 3);
  while (
    !isBookingRangeAvailable(dates.arrival, autoDeparture) &&
    autoDeparture > addBookingDays(dates.arrival, 1)
  ) {
    autoDeparture = addBookingDays(autoDeparture, -1);
  }
  const autoProperty = getBookingDemoProperties(templateIndex, 'fr')[
    templateIndex === 1 ? 0 : 1
  ].id;
  const running =
    playing &&
    active &&
    !dateError &&
    !(phase.id === 'property-ready' && !propertyIds.length) &&
    !(
      phase.id === 'departure' &&
      !isBookingRangeAvailable(dates.arrival, autoDeparture)
    );
  const processing = phase.id === 'processing';
  const extraIndex =
    phase.id === 'first-extra' ? 0 : phase.id === 'second-extra' ? 2 : -1;

  // Manual navigation brings the changed content into view, including on mobile.
  // Autoplay never moves focus or scrolls the guest's page.
  useEffect(() => {
    if (!navigationRequest) return;
    const heading = sceneRef.current?.querySelector<HTMLElement>('h4');
    if (!heading) return;
    heading.focus({ preventScroll: true });
    const bounds = heading.getBoundingClientRect();
    if (bounds.top < 110 || bounds.bottom > window.innerHeight) {
      heading.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    }
  }, [navigationRequest]);

  useEffect(() => {
    // A manually submitted demo payment also completes while autoplay is paused.
    if (!running && !(processing && manualPayment)) return;
    const timer = window.setTimeout(() => {
      if (beat === phases.length - 1) {
        const next = (templateIndex + 1) % BAITLY_BOOKING_TEMPLATES.length;
        setTemplateIndex(next);
        setBeat(0);
        setExtras(
          emptyExtras((templateIndex + 1) % BAITLY_BOOKING_TEMPLATES.length),
        );
        setManualPayment(false);
        setDates(DEFAULT_BOOKING_DATES);
        setPropertyIds(defaultProperties(next));
        setCalendarMonth(0);
        setDateError(false);
        return;
      }
      if (phase.id === 'arrival')
        setDates({ arrival: autoArrival, departure: null });
      if (phase.id === 'departure') {
        setDates({ arrival: dates.arrival, departure: autoDeparture });
        setDateError(false);
      }
      if (phase.id === 'property') setPropertyIds([autoProperty]);
      if (extraIndex >= 0)
        setExtras((current) =>
          current.map((selected, index) => index === extraIndex || selected),
        );
      setBeat(beat + 1);
    }, phase.duration);
    return () => window.clearTimeout(timer);
  }, [
    running,
    beat,
    templateIndex,
    extras,
    phase.duration,
    processing,
    manualPayment,
    extraIndex,
    phase.id,
    phases.length,
    autoArrival,
    autoDeparture,
    autoProperty,
    dates.arrival,
    dates.departure,
    propertyIds,
  ]);

  function selectTemplate(index: number) {
    setTemplateIndex(index);
    setBeat(0);
    setExtras(emptyExtras(index));
    setManualPayment(false);
    setDates(DEFAULT_BOOKING_DATES);
    setPropertyIds(defaultProperties(index));
    setCalendarMonth(0);
    setDateError(false);
  }

  function goToStep(next: number) {
    if (next >= 2 && !dates.departure) next = datesStep;
    else if (next >= 2 && !propertyIds.length) next = propertyStep;
    const nextBeat = phases.findIndex((item) => item.step === next);
    if (nextBeat < 0) return;
    setBeat(nextBeat);
    setManualPayment(false);
    setNavigationRequest((request) => request + 1);
  }

  function selectDate(iso: string) {
    if (isBookingDayUnavailable(iso)) return;
    setDateError(false);
    if (dates.departure || dateError || iso <= dates.arrival) {
      setDates({ arrival: iso, departure: null });
      setBeat(phaseIndex('departure'));
      const possibleEnd = bookingDate(addBookingDays(iso, 3));
      const endMonth =
        (possibleEnd.getUTCFullYear() - 2026) * 12 +
        possibleEnd.getUTCMonth() -
        9;
      if (endMonth > calendarMonth + 1)
        setCalendarMonth(Math.min(11, endMonth - 1));
    } else if (isBookingRangeAvailable(dates.arrival, iso)) {
      setDates({ arrival: dates.arrival, departure: iso });
      setBeat(phaseIndex('dates-ready'));
    } else {
      setDateError(true);
    }
  }

  function changeCalendarMonth(offset: number) {
    setCalendarMonth((month) => Math.max(0, Math.min(11, month + offset)));
    setBeat(phaseIndex(dates.departure ? 'arrival' : 'departure'));
    setDateError(false);
  }

  function selectProperty(id: string) {
    if (
      !getBookingDemoProperties(templateIndex, 'fr').some(
        (property) => property.id === id,
      )
    )
      return;
    setPropertyIds((current) =>
      templateIndex === 2
        ? current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
        : [id],
    );
    setBeat(phaseIndex('property-ready'));
  }

  function toggleExtra(index: number) {
    setExtras((current) =>
      current.map((value, i) => (i === index ? !value : value)),
    );
  }

  function togglePlayback() {
    setPlaying((current) => !current);
  }

  function nextTemplate() {
    selectTemplate((templateIndex + 1) % BAITLY_BOOKING_TEMPLATES.length);
    setNavigationRequest((request) => request + 1);
  }

  function fillGuest() {
    if (phase.id === 'guest') setBeat(phaseIndex('card'));
  }

  function fillCard() {
    if (phase.id === 'card') setBeat(phaseIndex('pay'));
  }

  function submitPayment() {
    if (phase.id !== 'pay' || !canContinue) return;
    setManualPayment(true);
    setBeat(phaseIndex('processing'));
  }

  function skipExtras() {
    setExtras(emptyExtras(templateIndex));
    goToStep(3);
  }

  return {
    templateIndex,
    step,
    extras,
    playing: playing && !reduced,
    running,
    reduced,
    dates,
    nights,
    datesStep,
    propertyStep,
    propertyIds,
    accommodation,
    calendarMonth,
    dateError,
    canContinue,
    pointer: {
      target: running ? phase.target : null,
      extraIndex: running ? extraIndex : -1,
      date: phase.id === 'arrival' ? autoArrival : autoDeparture,
      propertyId: autoProperty,
      duration: phase.duration,
      sequence: `${templateIndex}-${beat}-${navigationRequest}-${
        dates.arrival
      }-${dates.departure}-${propertyIds.join(',')}-${extras.join('-')}`,
    },
    guestFilled: beat >= phaseIndex('card'),
    cardFilled: beat >= phaseIndex('pay'),
    processing,
    sceneRef,
    visibilityRef,
    selectTemplate,
    goToStep,
    toggleExtra,
    togglePlayback,
    nextTemplate,
    fillGuest,
    fillCard,
    submitPayment,
    skipExtras,
    selectDate,
    changeCalendarMonth,
    selectProperty,
  };
}
