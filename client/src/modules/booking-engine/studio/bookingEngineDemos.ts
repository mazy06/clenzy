import { bookingEngineApi, type BookingEngineConfig, type BookingEngineConfigUpdate } from '../../../services/api/bookingEngineApi';
import { propertiesApi } from '../../../services/api/propertiesApi';
import { sitesApi } from '../../../services/api/sitesApi';
import { BAITLY_JOURNEY_TEMPLATES, materializeBaitlyJourneyTemplate } from './grapes/import/baitlyJourneyTemplates';
import { templateForkMetadata } from './grapes/import/templateFork';
import { addBaitlyTemplateLogosToBlocks } from './grapes/import/baitlyTemplateLogos';

interface DemoMetadata { templateId: string; propertyId: number; propertyIds?: number[]; status: 'building' | 'ready' }
export function readBookingDemo(config: Pick<BookingEngineConfig, 'componentConfig'>): DemoMetadata | null {
  try { return JSON.parse(config.componentConfig || '{}').baitlyDemo ?? null; } catch { return null; }
}

/** Only existing disabled demo drafts; no regeneration of templates, photos or client content. */
export async function refreshBookingDemoLogos(onProgress: (done: number, total: number) => void): Promise<BookingEngineConfig[]> {
  const configs = await bookingEngineApi.listConfigs();
  const demos = configs.filter((config) => readBookingDemo(config));
  // Validate every target before the first write.
  const targets = [];
  for (const config of demos) {
    if (config.enabled) throw new Error(`La démo « ${config.name} » est active.`);
    const site = await sitesApi.ensureForConfig(config.id);
    const pages = await sitesApi.listPages(site.id);
    if (site.status !== 'DRAFT' || pages.some((page) => page.status !== 'DRAFT')) throw new Error(`Le site « ${config.name} » n’est plus un brouillon.`);
    targets.push({ config, site, pages });
  }
  for (const [index, { config, site, pages }] of targets.entries()) {
    for (const page of pages) {
      if (!page.blocks) continue;
      const blocks = await addBaitlyTemplateLogosToBlocks(page.blocks);
      if (blocks !== page.blocks) {
        const saved = await sitesApi.updatePage(site.id, page.id, { ...page, blocks });
        if (!saved.blocks?.includes('data-baitly-logo-version')) throw new Error(`Logo non enregistré : ${config.name}, ${page.path}`);
      }
    }
    const pageLayout = config.pageLayout ? await addBaitlyTemplateLogosToBlocks(config.pageLayout) : config.pageLayout;
    if (pageLayout !== config.pageLayout) {
      const { id, organizationId: _org, apiKey: _key, enabled: _enabled, ...settings } = config;
      configs[configs.findIndex((entry) => entry.id === id)] = await bookingEngineApi.updateConfig(id, { ...settings, pageLayout });
    }
    onProgress(index + 1, targets.length);
  }
  return configs;
}

/** Creates independent, disabled drafts. A retry fills missing pages without replacing client edits. */
export async function createBookingEngineDemos(
  base: (name: string) => BookingEngineConfigUpdate,
  onProgress: (done: number, total: number) => void,
  options: { refreshCollections?: boolean; refreshConfirmations?: boolean; refreshTemplates?: boolean } = {},
): Promise<BookingEngineConfig[]> {
  const [configs, properties] = await Promise.all([bookingEngineApi.listConfigs(), propertiesApi.getAll()]);
  // Only public marketing photos enter a reusable site. Private access instructions are never copied.
  const eligible = properties.filter((p) => p.bookingEngineVisible && (p.coverPhotoUrl || p.photoUrls?.length));
  if (!eligible.length) throw new Error('Aucun logement visible à la réservation avec photos n’est disponible.');
  const taken = new Set(configs.map((config) => config.name));
  const refreshing = options.refreshCollections || options.refreshConfirmations || options.refreshTemplates;
  const models = refreshing ? BAITLY_JOURNEY_TEMPLATES.filter((model) => options.refreshTemplates || options.refreshCollections && ['catalogue', 'cart'].includes(model.journeyId || '') || options.refreshConfirmations && model.journeyId !== 'inquiry') : BAITLY_JOURNEY_TEMPLATES;
  for (const [index, master] of models.entries()) {
    let config = configs.find((entry) => readBookingDemo(entry)?.templateId === master.id);
    if (config && readBookingDemo(config)?.status === 'ready' && !refreshing) { onProgress(index + 1, models.length); continue; }
    const previous = config ? readBookingDemo(config) : null;
    const property = eligible.find((p) => p.id === previous?.propertyId) ?? eligible[index % eligible.length];
    const multi = ['catalogue', 'cart', 'extras'].includes(master.journeyId || '');
    const selected = [property, ...eligible.filter((p) => p.id !== property.id)].slice(0, multi ? 3 : 1);
    const refreshCollection = options.refreshCollections && ['catalogue', 'cart'].includes(master.journeyId || '');
    const refreshWholeTemplate = options.refreshTemplates || refreshCollection;
    if (refreshCollection && selected.length < 2) throw new Error('Au moins deux logements visibles avec photos sont nécessaires pour actualiser les démos.');
    const template = materializeBaitlyJourneyTemplate(master, property, false, selected);
    const envelope = (page: { html: string; css: string }) => JSON.stringify({ format: 'grapesjs', html: page.html, css: page.css });
    if (!config) {
      const stem = `[DÉMO] ${master.name}`;
      let name = stem;
      for (let suffix = 2; taken.has(name); suffix++) name = `${stem} ${suffix}`;
      config = await bookingEngineApi.createConfig({
        ...base(name), primaryColor: master.theme!.primaryColor!, fontFamily: master.theme!.fontFamily!,
        designCssVariables: JSON.stringify(template.designVars),
        featuredPropertyIds: JSON.stringify(selected.map((p) => p.id)),
        dataSourceMode: 'REAL', collectPaymentOnBooking: false, autoConfirm: false,
        componentConfig: JSON.stringify({ ...templateForkMetadata(template), baitlyDemo: { templateId: master.id, propertyId: property.id, status: 'building' } }),
        pageLayout: envelope(template.pages[0]),
      });
      configs.push(config);
      taken.add(name);
    }
    if (config.enabled) throw new Error(`La démo « ${config.name} » est active : sa reprise automatique est interrompue.`);
    const site = await sitesApi.ensureForConfig(config.id);
    if (site.status !== 'DRAFT') throw new Error(`Le site « ${config.name} » n’est plus un brouillon.`);
    const existing = await sitesApi.listPages(site.id);
    for (const [order, page] of template.pages.entries()) {
      const saved = existing.find((entry) => entry.path === page.path && !entry.locale);
      const body = { path: page.path, type: page.type, title: page.title, locale: null, status: 'DRAFT', sortOrder: order, blocks: envelope(page), seoTitle: page.seoTitle ?? null, seoDescription: page.seoDescription ?? null };
      if (!saved) await sitesApi.createPage(site.id, body);
      else if (refreshWholeTemplate || options.refreshConfirmations && (page.path === '/confirmation' || master.journeyId === 'confirmation' && page.path === '/') || !saved.blocks || saved.blocks === '[]' || saved.blocks === '{}') await sitesApi.updatePage(site.id, saved.id, body);
      else if (saved.status !== 'DRAFT') await sitesApi.updatePage(site.id, saved.id, { ...saved, status: 'DRAFT' });
    }
    const verified = await sitesApi.listPages(site.id);
    if (template.pages.some((page) => !verified.some((saved) => saved.path === page.path && !saved.locale && saved.blocks && saved.status === 'DRAFT'))) throw new Error(`Certaines pages de « ${config.name} » n’ont pas été enregistrées.`);
    const savedHome = verified.find((page) => page.path === '/' && !page.locale)!;
    if (refreshCollection) {
      // The backend sanitizes/normalizes HTML. Verify its content, not byte-for-byte serialization.
      const stored = JSON.parse(savedHome.blocks!);
      const document = new DOMParser().parseFromString(stored.html || '', 'text/html');
      const names = Array.from(document.querySelectorAll('.bt-property-collection h3')).map((heading) => heading.textContent);
      if (selected.some((property) => !names.includes(property.name))) throw new Error(`Les logements de « ${config.name} » n’ont pas tous été enregistrés.`);
    }
    const { id, organizationId: _organizationId, apiKey: _apiKey, enabled: _enabled, ...settings } = config;
    const metadata = JSON.parse(config.componentConfig || '{}');
    const completed = await bookingEngineApi.updateConfig(id, {
      ...settings,
      ...(refreshWholeTemplate || options.refreshConfirmations && master.journeyId === 'confirmation' ? { pageLayout: savedHome.blocks, featuredPropertyIds: JSON.stringify(selected.map((p) => p.id)), dataSourceMode: 'REAL', designCssVariables: JSON.stringify(template.designVars) } : {}),
      componentConfig: JSON.stringify({ ...metadata, ...templateForkMetadata(template), baitlyDemo: { templateId: master.id, propertyId: property.id, propertyIds: selected.map((p) => p.id), status: 'ready' } }),
    });
    configs[configs.findIndex((entry) => entry.id === id)] = completed;
    onProgress(index + 1, models.length);
  }
  return configs;
}
