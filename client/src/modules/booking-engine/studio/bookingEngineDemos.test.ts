import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bookingEngineApi, type BookingEngineConfig, type BookingEngineConfigUpdate } from '../../../services/api/bookingEngineApi';
import { sitesApi, type SitePage } from '../../../services/api/sitesApi';
import { createBookingEngineDemos, readBookingDemo, refreshBookingDemoLogos } from './bookingEngineDemos';
import { BAITLY_JOURNEY_TEMPLATES } from './grapes/import/baitlyJourneyTemplates';

vi.mock('../../../services/api/bookingEngineApi', () => ({ bookingEngineApi: { listConfigs: vi.fn(), createConfig: vi.fn(), updateConfig: vi.fn() } }));
vi.mock('../../../services/api/sitesApi', () => ({ sitesApi: { ensureForConfig: vi.fn(), listPages: vi.fn(), createPage: vi.fn(), updatePage: vi.fn() } }));
vi.mock('../../../services/api/propertiesApi', () => ({ propertiesApi: { getAll: vi.fn().mockResolvedValue([
  { id: 11, name: 'Maison Azur', city: 'Nice', bookingEngineVisible: true, coverPhotoUrl: 'https://images.example/azur.jpg', nightlyPrice: 180, maxGuests: 6, accessCode: 'PRIVATE-CODE' },
  { id: 12, name: 'Riad Jardin', city: 'Marrakech', bookingEngineVisible: true, photoUrls: ['https://images.example/riad.jpg'], nightlyPrice: 130, bedroomCount: 3 },
  { id: 13, name: 'Logement privé', bookingEngineVisible: false, coverPhotoUrl: 'https://images.example/private.jpg' },
] ) } }));

let configs: BookingEngineConfig[];
let pages: Map<number, SitePage[]>;
const base = (name: string) => ({ name } as BookingEngineConfigUpdate);
beforeEach(() => {
  vi.clearAllMocks();
  configs = [];
  pages = new Map();
  vi.mocked(bookingEngineApi.listConfigs).mockImplementation(async () => configs.slice());
  vi.mocked(bookingEngineApi.createConfig).mockImplementation(async (payload) => {
    const config = { ...payload, id: configs.length + 1, enabled: false, organizationId: 1, apiKey: 'test-key' } as BookingEngineConfig;
    configs.push(config); return config;
  });
  vi.mocked(bookingEngineApi.updateConfig).mockImplementation(async (id, payload) => {
    const index = configs.findIndex((entry) => entry.id === id);
    configs[index] = { ...configs[index], ...payload };
    return configs[index];
  });
  vi.mocked(sitesApi.ensureForConfig).mockImplementation(async (id) => {
    if (!pages.has(id)) pages.set(id, [{ id: id * 100, path: '/', locale: null, blocks: configs.find((entry) => entry.id === id)!.pageLayout, status: 'PUBLISHED' } as SitePage]);
    return { id, status: 'DRAFT' } as Awaited<ReturnType<typeof sitesApi.ensureForConfig>>;
  });
  vi.mocked(sitesApi.listPages).mockImplementation(async (id) => pages.get(id)!.slice());
  vi.mocked(sitesApi.createPage).mockImplementation(async (id, payload) => {
    const page = { ...payload, id: id * 100 + pages.get(id)!.length, siteId: id } as SitePage;
    pages.get(id)!.push(page); return page;
  });
  vi.mocked(sitesApi.updatePage).mockImplementation(async (site, id, payload) => {
    const list = pages.get(site)!;const index = list.findIndex((page) => page.id === id);
    list[index] = { ...list[index], ...payload }; return list[index];
  });
});

describe('Independent booking engine demos', () => {
  it('adds only logos to existing demo drafts, preserving custom content, settings, locales and custom logos', async () => {
    const blocks = JSON.stringify({ format: 'grapesjs', html: '<main class="bt-site" data-baitly-template="baitly-atlas"><a class="bt-brand">Ma collection</a><p>Texte client</p><a class="bt-brand"><img src="https://example.org/custom.svg"/>Mon logo</a></main>', css: '.client{color:green}', custom: 'preserved' });
    configs.push({ id: 1, name: 'Démo existante', enabled: false, pageLayout: blocks, logoUrl: 'https://example.org/custom.svg', featuredPropertyIds: '[11,12]', componentConfig: JSON.stringify({ baitlyDemo: { templateId: 'baitly-atlas', status: 'ready' }, custom: 42 }) } as BookingEngineConfig);
    configs.push({ id: 2, name: 'Client', enabled: true } as BookingEngineConfig);
    pages.set(1, [{ id: 101, path: '/', blocks, status: 'DRAFT' }, { id: 102, path: '/', locale: 'en', blocks, status: 'DRAFT' }] as SitePage[]);
    await refreshBookingDemoLogos(vi.fn());
    expect(bookingEngineApi.createConfig).not.toHaveBeenCalled();
    expect(sitesApi.createPage).not.toHaveBeenCalled();
    expect(sitesApi.ensureForConfig).toHaveBeenCalledTimes(1);
    expect(sitesApi.updatePage).toHaveBeenCalledTimes(2);
    for (const page of pages.get(1)!) {
      const saved = JSON.parse(page.blocks!);
      expect(saved.html).toContain('Texte client');
      expect(saved.html).toContain('https://example.org/custom.svg');
      expect(saved.html).toContain('data-baitly-default-logo="baitly-atlas"');
      expect(saved.css).toContain('.client{color:green}');
      expect(saved.custom).toBe('preserved');
    }
    expect(configs[0]).toMatchObject({ logoUrl: 'https://example.org/custom.svg', featuredPropertyIds: '[11,12]' });
    expect(JSON.parse(configs[0].componentConfig!)).toMatchObject({ custom: 42 });
    vi.mocked(sitesApi.updatePage).mockClear();
    vi.mocked(bookingEngineApi.updateConfig).mockClear();
    await refreshBookingDemoLogos(vi.fn());
    expect(sitesApi.updatePage).not.toHaveBeenCalled();
    expect(bookingEngineApi.updateConfig).not.toHaveBeenCalled();
  });
  it('refreshes all fourteen disabled demo journeys without touching non-demo engines or extra pages', async () => {
    await createBookingEngineDemos(base, vi.fn());
    configs.push({ id: 99, name: 'Site client personnalisé', enabled: true, componentConfig: '{}' } as BookingEngineConfig);
    pages.get(1)!.push({ id: 999, path: '/ma-page', blocks: 'PERSONAL CONTENT', status: 'DRAFT' } as SitePage);
    vi.mocked(bookingEngineApi.updateConfig).mockClear();
    await createBookingEngineDemos(base, vi.fn(), { refreshTemplates: true });
    expect(bookingEngineApi.updateConfig).toHaveBeenCalledTimes(14);
    expect(configs).toHaveLength(15);
    expect(configs.find((config) => config.id === 99)).toMatchObject({ name: 'Site client personnalisé', enabled: true });
    expect(pages.get(1)!.find((page) => page.path === '/ma-page')?.blocks).toBe('PERSONAL CONTENT');
  });
  it('refreshes confirmation demos and confirmation pages while preserving other customized pages', async () => {
    await createBookingEngineDemos(base, vi.fn());
    const catalogue = configs.find((config) => readBookingDemo(config)?.templateId === 'baitly-atlas')!;
    const home = pages.get(catalogue.id)!.find((page) => page.path === '/')!;
    home.blocks = JSON.stringify({ format: 'grapesjs', html: '<p>Accueil personnalisé</p>', css: '' });
    const confirmation = pages.get(catalogue.id)!.find((page) => page.path === '/confirmation')!;
    confirmation.blocks = '{}';
    const before = home.blocks;
    vi.mocked(bookingEngineApi.updateConfig).mockClear();
    await createBookingEngineDemos(base, vi.fn(), { refreshConfirmations: true });
    expect(pages.get(catalogue.id)!.find((page) => page.path === '/')!.blocks).toBe(before);
    expect(pages.get(catalogue.id)!.find((page) => page.path === '/confirmation')!.blocks).toContain('bt-confirmation-page');
    expect(bookingEngineApi.updateConfig).toHaveBeenCalledTimes(12);
    expect(configs).toHaveLength(14);
  });
  it('refreshes only the four collection demos in place with all selected properties and pages', async () => {
    await createBookingEngineDemos(base, vi.fn());
    const untouched = configs.filter((config) => !['baitly-atlas', 'baitly-horizon', 'baitly-itinerance', 'baitly-destinations'].includes(readBookingDemo(config)!.templateId));
    const before = JSON.stringify(untouched.map((config) => ({ config, pages: pages.get(config.id) })));
    vi.mocked(bookingEngineApi.updateConfig).mockClear();
    // Production rewrites envelope serialization while sanitizing HTML/CSS.
    vi.mocked(sitesApi.listPages).mockImplementation(async (id) => pages.get(id)!.map((page) => ({ ...page, blocks: JSON.stringify(JSON.parse(page.blocks!), null, 2) })));
    const progress = vi.fn();
    await createBookingEngineDemos(base, progress, { refreshCollections: true });
    expect(configs).toHaveLength(14);
    expect(bookingEngineApi.createConfig).toHaveBeenCalledTimes(14);
    expect(bookingEngineApi.updateConfig).toHaveBeenCalledTimes(4);
    expect(progress).toHaveBeenLastCalledWith(4, 4);
    expect(JSON.stringify(untouched.map((config) => ({ config, pages: pages.get(config.id) })))).toBe(before);
    for (const [id, payload] of vi.mocked(bookingEngineApi.updateConfig).mock.calls) {
      const doc = new DOMParser().parseFromString(JSON.parse(payload.pageLayout!).html, 'text/html');
      expect(Array.from(doc.querySelectorAll('.bt-property-collection h3')).map((item) => item.textContent).sort()).toEqual(['Maison Azur', 'Riad Jardin']);
      expect(doc.querySelectorAll('.bt-property-collection img')).toHaveLength(2);
      expect(JSON.parse(payload.featuredPropertyIds!)).toHaveLength(2);
      expect(configs.find((config) => config.id === id)?.enabled).toBe(false);
      expect(pages.get(id)!.every((page) => page.status === 'DRAFT')).toBe(true);
    }
  });

  it('refuses to refresh an active demo', async () => {
    await createBookingEngineDemos(base, vi.fn());
    configs[0].enabled = true;
    vi.mocked(sitesApi.updatePage).mockClear();
    await expect(createBookingEngineDemos(base, vi.fn(), { refreshCollections: true })).rejects.toThrow('est active');
    expect(sitesApi.updatePage).not.toHaveBeenCalled();
  });
  it('persists every model and all its pages, with public property photos and no publication', async () => {
    const progress = vi.fn();
    await createBookingEngineDemos(base, progress);
    expect(configs).toHaveLength(14);
    for (const model of BAITLY_JOURNEY_TEMPLATES) {
      const config = configs.find((entry) => readBookingDemo(entry)?.templateId === model.id)!;
      expect(config.name).toBe(`[DÉMO] ${model.name}`);
      expect(config.enabled).toBe(false);
      expect(config.collectPaymentOnBooking).toBe(false);
      expect(config.primaryColor).toBe(model.theme!.primaryColor);
      const home = JSON.parse(config.pageLayout!);
      expect(home.html).toMatch(/Maison Azur|Riad Jardin/);
      if (readBookingDemo(config)?.templateId !== 'baitly-serenite' && readBookingDemo(config)?.templateId !== 'baitly-correspondance') expect(home.html).toContain('https://images.example/');
      expect(home.html).not.toContain('PRIVATE-CODE');
      expect(home.html).not.toContain('private.jpg');
      expect(pages.get(config.id)).toHaveLength(model.pages.length + (['catalogue', 'cart'].includes(model.journeyId || '') ? 2 : 0));
      expect(pages.get(config.id)!.every((page) => page.status === 'DRAFT')).toBe(true);
    }
    expect(progress).toHaveBeenLastCalledWith(14, 14);
    for (const [, , body] of vi.mocked(sitesApi.updatePage).mock.calls) expect(body.blocks).toBeTruthy();
    await createBookingEngineDemos(base, progress);
    expect(bookingEngineApi.createConfig).toHaveBeenCalledTimes(14);
    expect(bookingEngineApi.updateConfig).toHaveBeenCalledTimes(14);
  });

  it('resumes an interrupted import without creating duplicate engines or replacing edited pages', async () => {
    vi.mocked(sitesApi.createPage).mockRejectedValueOnce(new Error('Network unavailable'));
    await expect(createBookingEngineDemos(base, vi.fn())).rejects.toThrow('Network unavailable');
    const home = pages.get(1)![0];
    home.blocks = '<p>Contenu personnalisé conservé</p>';
    await createBookingEngineDemos(base, vi.fn());
    expect(configs).toHaveLength(14);
    expect(pages.get(1)![0].blocks).toBe('<p>Contenu personnalisé conservé</p>');
    expect(readBookingDemo(configs[0])?.status).toBe('ready');
  });
});
