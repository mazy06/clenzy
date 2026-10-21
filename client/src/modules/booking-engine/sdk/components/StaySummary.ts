import type { StateManager } from '../state';
import type { BookingI18n } from '../i18n';
import { createPriceSummary } from './PriceSummary';

/** Read-only journey recap, sharing the live selection and server quote with the form. */
export function createStaySummary(state: StateManager, baseUrl: string, i18n: BookingI18n): HTMLElement {
  const root = document.createElement('div');
  root.className = 'cb-stay-summary';
  const details = document.createElement('div');
  details.className = 'cb-stay-summary__details';
  root.append(details, createPriceSummary(state, i18n));
  let previous = '';
  const render = () => {
    const s = state.get();
    const p = s.selectedPropertyId == null ? s.properties[0] : s.properties.find((item) => item.id === s.selectedPropertyId);
    const key = JSON.stringify([p, s.checkIn, s.checkOut, s.adults, s.children, s.infants]);
    if (key === previous) return;
    previous = key;
    details.replaceChildren();
    if (!p) return;
    const photo = p.mainPhotoUrl || p.photoUrls?.[0];
    if (photo) {
      const image = document.createElement('img');
      image.className = 'cb-stay-summary__photo';
      image.src = photo.startsWith('/') ? `${baseUrl.replace(/\/$/, '')}${photo}` : photo;
      image.alt = p.name;
      details.append(image);
    }
    const heading = document.createElement('h3');
    heading.textContent = p.name;
    const place = document.createElement('p');
    place.textContent = [p.city, p.country].filter(Boolean).join(', ');
    const list = document.createElement('dl');
    const row = (label: string, value: string) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      list.append(dt, dd);
    };
    const date = (value: string | null) => value ? new Intl.DateTimeFormat(i18n.lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : i18n.t('searchBar.select');
    row(i18n.t('detail.checkIn'), date(s.checkIn));
    row(i18n.t('detail.checkOut'), date(s.checkOut));
    row(i18n.t('guests.title'), `${s.adults} ${i18n.t('guests.adults')}${s.children ? ` · ${s.children} ${i18n.t('guests.children')}` : ''}${s.infants ? ` · ${s.infants} ${i18n.t('guests.babies')}` : ''}`);
    details.append(heading, place, list);
  };
  state.on('*', render);
  render();
  return root;
}
