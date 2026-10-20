/** Development-only full-page recipe. Native master templates and native SDK; every API call is real. */
import { BAITLY_JOURNEY_TEMPLATES, materializeBaitlyJourneyTemplate } from '../../src/modules/booking-engine/studio/grapes/import/baitlyJourneyTemplates';
import { BaitlyBookingCore } from '../../src/modules/booking-engine/sdk/core/BaitlyBookingCore';
import { mountPrimitive, type MountContext } from '../../src/modules/booking-engine/sdk/primitives/mountPrimitive';
import { enhanceHospitality } from '../../src/modules/booking-engine/sdk/hospitality';
import { sanitizeHtml } from '../../src/modules/booking-engine/studio/grapes/import/sanitizeHtml';

if (!import.meta.env.DEV || location.hostname !== 'localhost') throw new Error('Local development recipe only');
const baseUrl = 'http://localhost:8084';
// Public embed key of the existing LOCAL recipe engine; never an auth token or Stripe secret.
const apiKey = 'cefab264-8c0b-4b81-9b32-cc33394c706c';
const parameters = new URLSearchParams(location.search);
const master = BAITLY_JOURNEY_TEMPLATES.find((model) => model.id === parameters.get('template')) ?? BAITLY_JOURNEY_TEMPLATES[0];
const modelInput = document.querySelector<HTMLSelectElement>('#recipe-model')!;
const status = document.querySelector<HTMLElement>('#baitly-recipe-status')!;
const host = document.querySelector<HTMLElement>('#recipe-page')!;
const core = new BaitlyBookingCore({ apiKey, baseUrl, language: 'fr', defaults: { selectedPropertyId: 81, adults: 2, children: 0 } });
BAITLY_JOURNEY_TEMPLATES.forEach((model) => modelInput.add(new Option(model.name, model.id)));
modelInput.value = master.id;

function localRoute(path: string, template = master.id): string {
  const target = new URL(path, location.origin);
  const url = new URL(location.pathname, location.origin);
  target.searchParams.forEach((value, key) => url.searchParams.append(key, value));
  url.searchParams.set('template', template);
  url.searchParams.set('route', target.pathname);
  url.hash = target.hash;
  return `${url.pathname}${url.search}${url.hash}`;
}

function reset(): void {
  core.state.set({ selectedPropertyId: 81, checkIn: null, checkOut: null, adults: 2, children: 0, infants: 0,
    cart: [], destination: '', selectedPropertyType: null, guestForm: { firstName: '', lastName: '', email: '', phone: '', message: '' } });
}
document.querySelector('#recipe-reset')!.addEventListener('click', () => { reset(); location.assign(localRoute('/')); });
modelInput.addEventListener('change', () => { reset(); location.assign(localRoute('/', modelInput.value)); });
document.querySelector('#recipe-load')!.addEventListener('click', () => {
  const reference = document.querySelector<HTMLInputElement>('#recipe-reference')!.value.trim();
  if (!/^RES-[A-Z0-9]+$/.test(reference)) { status.textContent = 'Référence de réservation requise'; return; }
  const route = master.journeyId === 'confirmation' ? '/' : '/confirmation';
  location.assign(localRoute(`${route}?reservation=${encodeURIComponent(reference)}`));
});

async function start(): Promise<void> {
  const properties = await core.api.getProperties();
  if (!properties.length) throw new Error('Aucun logement disponible sur le moteur local');
  const absolute = (path: string | null | undefined) => path ? new URL(path, baseUrl).href : undefined;
  const marketing = properties.map((property) => ({ ...property,
    mainPhotoUrl: absolute(property.mainPhotoUrl), photoUrls: property.photoUrls?.map((path) => absolute(path)!),
    nightlyPrice: property.priceFrom, cleaningBasePrice: property.cleaningFee, bookingEngineVisible: true }));
  const primary = marketing.find((property) => property.id === 81) ?? marketing[0];
  const template = materializeBaitlyJourneyTemplate(master, primary, false, marketing);
  const pagePath = parameters.get('route') || '/';
  const page = template.pages.find((entry) => entry.path === pagePath);
  if (!page) throw new Error(`Page absente du template : ${pagePath}`);
  document.querySelector('#recipe-page-style')!.textContent = page.css;
  host.innerHTML = sanitizeHtml(page.html);
  const known = new Set(template.pages.map((entry) => entry.path));
  const rewrite = (path: string) => {
    const url = new URL(path, location.origin);
    return url.origin === location.origin && known.has(url.pathname) ? localRoute(path) : path;
  };
  host.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => link.setAttribute('href', rewrite(link.getAttribute('href')!)));
  host.querySelectorAll<HTMLElement>('[data-clenzy-widget]').forEach((marker) => {
    for (const attribute of ['data-clenzy-next', 'data-clenzy-return']) {
      const path = marker.getAttribute(attribute);
      if (path) marker.setAttribute(attribute, rewrite(path));
    }
    const pages = marker.getAttribute('data-baitly-property-pages');
    if (pages) marker.setAttribute('data-baitly-property-pages', JSON.stringify(Object.fromEntries(
      Object.entries(JSON.parse(pages) as Record<string, string>).map(([id, path]) => [id, rewrite(path)]))));
  });
  const ctx: MountContext = { core, i18n: core.i18n, config: { container: host, apiKey, baseUrl, language: 'fr' } };
  host.querySelectorAll<HTMLElement>('[data-clenzy-widget]').forEach((marker) => mountPrimitive(marker, marker.dataset.clenzyWidget!, ctx));
  enhanceHospitality(host);
  core.start();
  status.textContent = `${master.name} · API réelle · Stripe sandbox local · ${page.title}`;
  document.title = `${master.name} · ${page.title} · Recette réelle Baitly`;
}

void start().catch((error: Error) => { status.textContent = error.message; });
window.addEventListener('pagehide', () => core.destroy());
