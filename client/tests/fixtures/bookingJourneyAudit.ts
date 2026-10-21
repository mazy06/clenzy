/** Development-only browser fixture: actual native templates and SDK, no backend writes or payment calls. */
import { BAITLY_JOURNEY_TEMPLATES, materializeBaitlyJourneyTemplate } from '../../src/modules/booking-engine/studio/grapes/import/baitlyJourneyTemplates';
import { createEditorPreview } from '../../src/modules/booking-engine/studio/grapes/editorPreviewCore';
import { mountPrimitive } from '../../src/modules/booking-engine/sdk/primitives/mountPrimitive';
import coast from '../../src/assets/booking-hospitality/baitly-coast.jpg';
import suite from '../../src/assets/booking-hospitality/baitly-suite.jpg';
import dining from '../../src/assets/booking-hospitality/baitly-dining.jpg';

const models = document.querySelector<HTMLSelectElement>('#model')!;
const stages = document.querySelector<HTMLSelectElement>('#stage')!;
const canvas = document.querySelector<HTMLIFrameElement>('#canvas')!;
let preview: ReturnType<typeof createEditorPreview>;
let template = BAITLY_JOURNEY_TEMPLATES[0];
BAITLY_JOURNEY_TEMPLATES.forEach((model) => models.add(new Option(model.name, model.id)));

function render(path: string): void {
  const url = new URL(path, location.origin);
  const page = template.pages.find((entry) => entry.path === url.pathname);
  if (!page) return;
  const propertyId = Number(url.pathname.match(/\/logements\/(\d+)/)?.[1] || url.searchParams.get('clenzy_property'));
  if (propertyId) preview.selectProperty(propertyId);
  stages.value = page.path;
  canvas.onload = () => {
    const doc = canvas.contentDocument!;
    doc.querySelectorAll<HTMLElement>('[data-clenzy-widget]').forEach((marker) => mountPrimitive(marker, marker.dataset.clenzyWidget!, preview.ctx));
    doc.addEventListener('baitly:navigate', (event) => render((event as CustomEvent<{ path: string }>).detail.path));
    doc.addEventListener('click', (event) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
      if (!link || link.hasAttribute('data-baitly-image')) return;
      const target = new URL(link.getAttribute('href')!, location.origin);
      if (target.origin !== location.origin) return;
      if (target.hash && target.pathname === page.path) {
        event.preventDefault();
        doc.getElementById(target.hash.slice(1))?.scrollIntoView();
      } else if (template.pages.some((entry) => entry.path === target.pathname)) {
        event.preventDefault();
        render(`${target.pathname}${target.search}${target.hash}`);
      }
    });
  };
  canvas.srcdoc = `<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}${page.css}</style></head><body>${page.html}</body></html>`;
}

function selectModel(): void {
  preview?.destroy();
  preview = createEditorPreview(null);
  const master = BAITLY_JOURNEY_TEMPLATES.find((model) => model.id === models.value)!;
  const all = preview.ctx.core.state.get().properties.map((property, index) => ({ ...property, mainPhotoUrl: [coast, suite, dining][index % 3], photoUrls: [coast, suite, dining], country: index === 2 ? 'Maroc' : 'France' }));
  const properties = ['catalogue', 'cart', 'extras'].includes(master.journeyId || '') ? all.slice(0, 3) : all.slice(0, 1);
  preview.ctx.core.state.set({ properties, selectedPropertyId: properties[0].id, checkIn: '2027-06-10', checkOut: '2027-06-13', calendarBaseMonth: '2027-06', adults: 2, children: 1 }, 'dateSelected');
  const marketing = properties.map((property) => ({ ...property, nightlyPrice: property.priceFrom || 0, cleaningBasePrice: property.cleaningFee || 0, bookingEngineVisible: true }));
  template = materializeBaitlyJourneyTemplate(master, marketing[0], true, marketing);
  stages.replaceChildren(...template.pages.map((page) => new Option(page.title, page.path)));
  render(template.pages.some((page) => page.path === '/reserver') ? '/reserver' : template.pages.some((page) => page.path === '/sejour') ? '/sejour' : '/');
}

models.addEventListener('change', selectModel);
stages.addEventListener('change', () => render(stages.value));
selectModel();
