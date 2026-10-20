import { describe, expect, it, vi } from 'vitest';
import { BAITLY_JOURNEY_TEMPLATES, BAITLY_TEMPLATE_VERSION, materializeBaitlyJourneyTemplate } from './baitlyJourneyTemplates';
import { templateForkMetadata } from './templateFork';
import { BUILTIN_COMPOSITES, buildCompositeHtml, parseSavedComposites, serializeSavedComposites } from '../compositeWidgets';

// Vitest stubs CSS imports; read the real asset to verify that ready-to-use models embed it.
vi.mock('../../../sdk/styles/widget-skin.css?raw', async () => ({
  default: (await import('node:fs')).readFileSync('src/modules/booking-engine/sdk/styles/widget-skin.css', 'utf8'),
}));

describe('Baitly native journey templates', () => {
  it('provides editable live recaps on every booking journey and a separate basket at payment', () => {
    for (const model of BAITLY_JOURNEY_TEMPLATES.filter((item) => ['catalogue', 'single', 'extras', 'express', 'cart'].includes(item.journeyId!))) {
      const path = model.journeyId === 'cart' ? '/sejour' : model.journeyId === 'express' ? '/' : '/reserver';
      const doc = new DOMParser().parseFromString(model.pages.find((page) => page.path === path)!.html, 'text/html');
      expect(doc.querySelector('[data-clenzy-property-layout="recap"]'), model.id).not.toBeNull();
      expect(doc.querySelector('.bt-checkout__steps [aria-current="step"]'), model.id).not.toBeNull();
      expect(doc.querySelector('[data-clenzy-widget="booking-dates"]'), model.id).not.toBeNull();
      if (model.journeyId === 'cart') {
        const payment = new DOMParser().parseFromString(model.pages.find((page) => page.path === '/paiement')!.html, 'text/html');
        expect(payment.querySelector('.bt-checkout__basket [data-clenzy-widget="booking-cart"]')).not.toBeNull();
        expect(payment.querySelector('.bt-checkout__form [data-clenzy-widget="booking-guest-form"]')).not.toBeNull();
      }
    }
  });
  it.each(['atlas', 'horizon', 'itinerance', 'destinations'])('builds a themed %s property page with its complete gallery and native stay controls', (style) => {
    const master = BAITLY_JOURNEY_TEMPLATES.find((model) => model.id === `baitly-${style}`)!;
    const property = { id: 43, name: 'Une très longue adresse avec jardin et terrasse pour accueillir toute la famille', description: 'Une description complète '.repeat(30), nightlyPrice: 135, maxGuests: 6, photoUrls: Array.from({ length: 14 }, (_, index) => `https://images.example/room-${index}.jpg`) };
    const model = materializeBaitlyJourneyTemplate(master, property);
    const doc = new DOMParser().parseFromString(model.pages.find((page) => page.path === '/logements/43')!.html, 'text/html');
    expect(doc.querySelector('h1')?.textContent).toBe(property.name);
    expect(doc.querySelector('.bt-detail-description')?.textContent).toContain(property.description.trim());
    expect(doc.querySelector('[data-detail-style]')?.getAttribute('data-detail-style')).toBe(style);
    expect(doc.querySelectorAll('.bt-detail-gallery img')).toHaveLength(14);
    expect(doc.querySelector('details.bt-detail-more-photos') !== null).toBe(style !== 'itinerance');
    for (const widget of ['booking-dates', 'booking-guests', 'booking-price-summary']) expect(doc.querySelector(`.bt-detail-booking [data-clenzy-widget="${widget}"]`)).not.toBeNull();
    expect(doc.querySelector('.bt-detail-from')?.textContent).toContain('135');
    expect(doc.querySelector('.bt-detail-continue')?.getAttribute('href')).toBe(`${master.journeyId === 'cart' ? '/sejour' : '/reserver'}?clenzy_property=43`);
    if (style === 'horizon') expect(doc.querySelector('.bt-detail-top>.bt-detail-booking')).not.toBeNull();
    if (style === 'destinations') expect(doc.querySelector('.bt-property-detail>.bt-detail-booking')).not.toBeNull();
    if (style === 'atlas' || style === 'itinerance') expect(doc.querySelector('.bt-detail-content>.bt-detail-booking')).not.toBeNull();
  });
  it.each(['catalogue', 'cart'])('materializes every selected property in the %s collection without publishing private media', (journey) => {
    const selected = [
      { id: 42, name: 'Villa Atlas', city: 'Marrakech', description: 'Jardin privatif', nightlyPrice: 180, maxGuests: 6, bookingEngineVisible: true, photoUrls: ['/api/properties/42/photos/7/data'] },
      { id: 43, name: 'Riad <Jardin>', city: 'Fès', description: 'Patio & terrasse', nightlyPrice: 130, amenities: ['wifi', 'AIR_CONDITIONING'], bedroomCount: 3, bookingEngineVisible: true, photoUrls: ['/api/properties/43/photos/8/data'] },
      { id: 44, name: 'Maison privée', city: 'Paris', photoUrls: ['/api/properties/44/photos/9/data'] },
    ];
    const master = BAITLY_JOURNEY_TEMPLATES.find((model) => model.journeyId === journey)!;
    const fork = materializeBaitlyJourneyTemplate(master, selected[0], false, selected);
    const doc = new DOMParser().parseFromString(fork.pages[0].html, 'text/html');
    const cards = doc.querySelectorAll('.bt-property-collection article');
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain('Jardin privatif');
    expect(cards[0].textContent).toContain('6 voyageurs');
    expect(cards[1].textContent).toContain('Riad <Jardin>');
    expect(cards[1].textContent).toContain('Patio & terrasse');
    expect(cards[1].querySelector('img')?.getAttribute('src')).toContain('/api/public/property-photos/43/8');
    expect(cards[1].querySelector('a')?.getAttribute('href')).toBe('/logements/43');
    const detail = new DOMParser().parseFromString(fork.pages.find((page) => page.path === '/logements/43')!.html, 'text/html');
    expect(detail.querySelector('h1')?.textContent).toBe('Riad <Jardin>');
    expect(detail.querySelector('[data-clenzy-widget="booking-amenities"]')).not.toBeNull();
    expect(detail.body.textContent).toContain('130');
    expect(detail.body.textContent).not.toContain('180');
    expect(detail.querySelector('.bt-detail-continue')?.getAttribute('href')).toBe(`${journey === 'cart' ? '/sejour' : '/reserver'}?clenzy_property=43`);
    const resultDoc = new DOMParser().parseFromString(fork.pages.find((page) => page.path === '/logements')!.html, 'text/html');
    expect(JSON.parse(resultDoc.querySelector('[data-baitly-property-pages]')!.getAttribute('data-baitly-property-pages')!)).toMatchObject({ '43': '/logements/43' });
    expect(doc.querySelector('script')).toBeNull();
    expect(fork.pages.map((page) => page.html).join('')).not.toContain('/api/properties/44/');
    expect(master.pages[0].html).not.toContain('Jardin privatif');
    const preview = materializeBaitlyJourneyTemplate(master, selected[0], true, selected);
    expect(preview.pages[0].html).toContain('/api/properties/44/photos/9/data');
  });
  it('provides two complete native models per journey with resolvable page and anchor links', () => {
    const journeys = new Set(BAITLY_JOURNEY_TEMPLATES.map((model) => model.journeyId));
    expect(journeys.size).toBe(7);
    expect(new Set(BAITLY_JOURNEY_TEMPLATES.map((model) => model.id)).size).toBe(14);
    for (const journey of journeys) expect(BAITLY_JOURNEY_TEMPLATES.filter((model) => model.journeyId === journey)).toHaveLength(2);
    for (const model of BAITLY_JOURNEY_TEMPLATES) {
      expect(model.pages[0].type).toBe('HOME');
      const pages = new Map(model.pages.map((page) => [page.path, new DOMParser().parseFromString(page.html, 'text/html')]));
      for (const [path, doc] of pages) {
        expect(doc.querySelector('main[data-baitly-template]')).not.toBeNull();
        for (const element of doc.querySelectorAll('[href],[data-clenzy-next],[data-clenzy-return]')) {
          if (element.hasAttribute('data-baitly-image')) continue;
          const value = element.getAttribute('href') ?? element.getAttribute('data-clenzy-next') ?? element.getAttribute('data-clenzy-return')!;
          const target = new URL(value, `https://booking.example${path}`);
          expect(pages.has(target.pathname), `${model.id}: ${value}`).toBe(true);
          if (target.hash) expect(pages.get(target.pathname)!.getElementById(target.hash.slice(1)), `${model.id}: ${value}`).not.toBeNull();
        }
      }
    }
  });

  it('keeps quote, cart and express journeys meaningfully distinct', () => {
    const quote = BAITLY_JOURNEY_TEMPLATES.find((model) => model.journeyId === 'inquiry')!;
    const quoteHtml = quote.pages.map((page) => page.html).join('');
    expect(quoteHtml).toContain('booking-inquiry-form');
    expect(quote.pages[0].html).not.toContain('booking-guest-form');
    expect(quote.pages.some((page) => page.path === '/merci')).toBe(true);
    const cart = BAITLY_JOURNEY_TEMPLATES.find((model) => model.journeyId === 'cart')!;
    expect(cart.pages.find((page) => page.path === '/sejour')!.html).toContain('booking-add-to-cart');
    expect(cart.pages.find((page) => page.path === '/paiement')!.html).toContain('booking-guest-form');
    const express = BAITLY_JOURNEY_TEMPLATES.find((model) => model.journeyId === 'express')!;
    expect(express.pages[0].html).toContain('booking-guest-form');
    expect(express.pages.some((page) => page.path === '/galerie')).toBe(true);
  });

  it('ships the widget skin with every model while preserving its own palette and typography', () => {
    const palettes = new Set<string>();
    for (const model of BAITLY_JOURNEY_TEMPLATES) {
      const page = model.pages[0];
      const doc = new DOMParser().parseFromString(page.html, 'text/html');
      const main = doc.querySelector<HTMLElement>('main')!;
      expect(page.css).toContain('.cb-skin-v1');
      expect(main.style.getPropertyValue('--bt-color-primary')).toBe(model.theme!.primaryColor);
      expect(main.style.getPropertyValue('--bt-font-heading')).not.toBe('');
      palettes.add(model.theme!.primaryColor!);
      for (const p of model.pages) {
        const content = new DOMParser().parseFromString(p.html, 'text/html');
        for (const marker of content.querySelectorAll('[data-clenzy-widget="booking-property-results"]')) {
          expect(JSON.parse(marker.getAttribute('data-clenzy-props')!)).toMatchObject({ direction: 'row', columns: 0 });
        }
      }
    }
    expect(palettes.size).toBe(14);
  });

  it('escapes property content and does not publish private photo endpoints or unsafe image URLs', () => {
    const model = materializeBaitlyJourneyTemplate(BAITLY_JOURNEY_TEMPLATES[0], {
      name: '"><img src=x onerror=alert(1)>', description: '<script>bad()</script>',
      photoUrls: ['javascript:alert(1)', '/api/properties/42/photos/7/data'],
    });
    const doc = new DOMParser().parseFromString(model.pages[0].html, 'text/html');
    expect(doc.querySelector('script,[onerror]')).toBeNull();
    expect(doc.body.textContent).toContain('<script>bad()</script>');
    for (const image of doc.querySelectorAll('img')) expect(image.src).not.toMatch(/javascript:|\/api\/properties\//);
  });

  it('preserves composite styling through custom-copy serialization', () => {
    expect(BUILTIN_COMPOSITES).toHaveLength(14);
    const composite = { ...BUILTIN_COMPOSITES[0], id: 'custom-copy', builtin: false };
    const restored = parseSavedComposites(serializeSavedComposites([composite]))[0];
    expect(restored.css).toBe(composite.css);
    expect(buildCompositeHtml(restored)).toContain('<style>');
    expect(buildCompositeHtml({ ...restored, css: '</style><script>bad()</script>' })).not.toContain('<script>');
  });

  it('ships complete hospitality pages and keeps client edits isolated from immutable masters', () => {
    const master = BAITLY_JOURNEY_TEMPLATES[0];
    expect(Object.isFrozen(master)).toBe(true);
    expect(Object.isFrozen(master.pages[0])).toBe(true);
    const fork = materializeBaitlyJourneyTemplate(master, { name: 'Mon adresse', nightlyPrice: 160, maxGuests: 4 });
    const originalHtml = master.pages[0].html;
    fork.pages[0].html = '<p>Version personnelle du client</p>';
    fork.theme!.primaryColor = '#334455';
    expect(master.pages[0].html).toBe(originalHtml);
    expect(master.theme!.primaryColor).not.toBe(fork.theme!.primaryColor);
    expect(templateForkMetadata(master).baitlyTemplateFork).toEqual({ sourceId: master.id, sourceVersion: BAITLY_TEMPLATE_VERSION, mode: 'independent' });
    for (const template of BAITLY_JOURNEY_TEMPLATES) {
      for (const path of ['/la-maison', '/galerie', '/services', '/tarifs', '/destination', '/contact', '/informations', '/avis']) expect(template.pages.some((page) => page.path === path)).toBe(true);
      expect(template.pages.find((page) => page.path === '/informations')!.html).toContain('<details');
      expect(template.pages.find((page) => page.path === '/galerie')!.html).toContain('data-baitly-image');
    }
  });
});
