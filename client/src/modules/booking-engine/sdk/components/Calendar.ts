import type { StateManager } from '../state';
import type { WidgetState, DayAvailability } from '../types';
import { chevronLeft, chevronRight } from './icons';

interface I18n {
  t: (key: string) => string;
  tArray: (key: string) => string[];
}

export function createCalendar(state: StateManager, i18n: I18n, currency: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'cb-calendar-wrapper';
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-label', i18n.t('searchBar.selectDates'));

  const inner = document.createElement('div');
  inner.className = 'cb-calendar';
  wrapper.appendChild(inner);

  function render(s: WidgetState): void {
    wrapper.classList.toggle('cb-open', s.calendarOpen);
    if (!s.calendarOpen) return;

    inner.textContent = '';

    // Header with nav
    const header = document.createElement('div');
    header.className = 'cb-calendar-header';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'cb-calendar-nav';
    prevBtn.setAttribute('type', 'button');
    prevBtn.setAttribute('aria-label', 'Previous month');
    prevBtn.appendChild(chevronLeft());
    prevBtn.addEventListener('click', () => {
      const [y, m] = s.calendarBaseMonth.split('-').map(Number);
      const prev = new Date(y, m - 2, 1);
      const now = new Date();
      if (prev < new Date(now.getFullYear(), now.getMonth(), 1)) return;
      state.set({
        calendarBaseMonth: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`,
      });
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'cb-calendar-nav';
    nextBtn.setAttribute('type', 'button');
    nextBtn.setAttribute('aria-label', 'Next month');
    nextBtn.appendChild(chevronRight());
    nextBtn.addEventListener('click', () => {
      const [y, m] = s.calendarBaseMonth.split('-').map(Number);
      const next = new Date(y, m, 1);
      state.set({
        calendarBaseMonth: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
      });
    });

    // Check if prev is disabled (can't go before current month)
    const [baseY, baseM] = s.calendarBaseMonth.split('-').map(Number);
    const nowDate = new Date();
    if (baseY === nowDate.getFullYear() && baseM === nowDate.getMonth() + 1) {
      prevBtn.setAttribute('disabled', '');
    }

    const titleSpan = document.createElement('span');
    titleSpan.className = 'cb-calendar-title';

    header.appendChild(prevBtn);
    header.appendChild(titleSpan);
    header.appendChild(nextBtn);
    inner.appendChild(header);

    // Months container
    const monthsContainer = document.createElement('div');
    monthsContainer.className = 'cb-calendar-months';

    const month1 = buildMonth(baseY, baseM - 1, s, i18n, currency, state);
    const month2Date = new Date(baseY, baseM, 1);
    const month2 = buildMonth(month2Date.getFullYear(), month2Date.getMonth(), s, i18n, currency, state);

    const months = i18n.tArray('months');
    titleSpan.textContent = `${months[baseM - 1]} ${baseY}  —  ${months[month2Date.getMonth()]} ${month2Date.getFullYear()}`;

    monthsContainer.appendChild(month1);
    monthsContainer.appendChild(month2);
    inner.appendChild(monthsContainer);
  }

  state.on('*', render);

  return wrapper;
}

function buildMonth(
  year: number,
  month: number,
  state: WidgetState,
  i18n: I18n,
  currency: string,
  mgr: StateManager,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-calendar-month';

  // Weekday headers
  const weekdays = document.createElement('div');
  weekdays.className = 'cb-calendar-weekdays';
  const weekdayNames = i18n.tArray('weekdays');
  weekdayNames.forEach(name => {
    const wd = document.createElement('span');
    wd.className = 'cb-calendar-weekday';
    wd.textContent = name;
    weekdays.appendChild(wd);
  });
  container.appendChild(weekdays);

  // Day grid
  const grid = document.createElement('div');
  grid.className = 'cb-calendar-grid';

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Empty cells for days before the 1st (Monday-based week)
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1; // convert Sun=0 to Mon=0
  for (let i = 0; i < startDow; i++) {
    const empty = document.createElement('span');
    empty.className = 'cb-calendar-day';
    grid.appendChild(empty);
  }

  // Day cells
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cellDate = new Date(year, month, d);
    const dayInfo = state.availability.get(dateStr);
    const isPast = cellDate < today;
    const isUnavailable = dayInfo ? !dayInfo.available : false;
    const isDisabled = isPast || isUnavailable;
    const isToday = cellDate.getTime() === today.getTime();

    const isCheckIn = state.checkIn === dateStr;
    const isCheckOut = state.checkOut === dateStr;
    const isSelected = isCheckIn || isCheckOut;

    let isInRange = false;
    if (state.checkIn && state.checkOut) {
      const ciDate = new Date(state.checkIn);
      const coDate = new Date(state.checkOut);
      isInRange = cellDate > ciDate && cellDate < coDate;
    }

    const cell = document.createElement('button');
    cell.className = 'cb-calendar-day';
    cell.setAttribute('type', 'button');
    cell.setAttribute('aria-label', `${d} ${i18n.tArray('months')[month]}`);

    if (isDisabled) cell.classList.add('cb-disabled');
    if (isToday) cell.classList.add('cb-today');
    if (isSelected) cell.classList.add('cb-selected');
    if (isInRange) cell.classList.add('cb-in-range');
    if (isCheckIn) cell.classList.add('cb-range-start');
    if (isCheckOut) cell.classList.add('cb-range-end');

    if (isDisabled) {
      cell.setAttribute('disabled', '');
      cell.setAttribute('aria-disabled', 'true');
    }

    // Day number
    const dayNum = document.createElement('span');
    dayNum.textContent = String(d);
    cell.appendChild(dayNum);

    // Price under day number (only if available)
    if (dayInfo?.minPrice && !isDisabled) {
      const priceEl = document.createElement('span');
      priceEl.className = 'cb-calendar-day__price';
      priceEl.textContent = formatMinPrice(dayInfo.minPrice, currency);
      cell.appendChild(priceEl);
    }

    // Click handler
    if (!isDisabled) {
      cell.addEventListener('click', () => handleDayClick(dateStr, mgr));
    }

    grid.appendChild(cell);
  }

  container.appendChild(grid);
  return container;
}

function handleDayClick(dateStr: string, state: StateManager): void {
  const s = state.get();

  if (!s.checkIn || (s.checkIn && s.checkOut)) {
    // Start new selection
    state.set({ checkIn: dateStr, checkOut: null }, 'dateSelected');
  } else {
    // Set check-out
    if (dateStr <= s.checkIn) {
      // Clicked before check-in → swap
      state.set({ checkIn: dateStr, checkOut: s.checkIn }, 'dateSelected');
    } else {
      state.set({ checkOut: dateStr, calendarOpen: false }, 'dateSelected');
    }
  }
}

function formatMinPrice(price: number, currency: string): string {
  if (price >= 1000) return `${Math.round(price / 100) / 10}k`;
  return `${currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency}${Math.round(price)}`;
}
