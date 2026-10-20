import logoCss from './baitlyTemplateLogos.css?raw';
import type { Editor } from 'grapesjs';

/** Assets publics versionnés : les forks existants gardent leurs fichiers lors des futurs déploiements. */
const logoIds = new Set(['atlas', 'horizon', 'maison', 'patio', 'retraite', 'pavillon', 'rivage', 'escale', 'itinerance', 'destinations', 'direct', 'weekend', 'serenite', 'correspondance'].map((id) => `baitly-${id}`));
export const BAITLY_TEMPLATE_LOGO_CSS = logoCss;

export function baitlyTemplateLogoSource(templateId: string): string | undefined {
  if (!logoIds.has(templateId)) return undefined;
  return new URL(`/booking/template-logos/v1/${templateId}.svg`, typeof window === 'undefined' ? 'https://app.baitly.fr' : window.location.origin).href;
}

export function baitlyTemplateLogoMarkup(templateId: string): string {
  const src = baitlyTemplateLogoSource(templateId);
  // Le nom adjacent porte le nom accessible du lien ; le symbole ne le répète pas.
  return src ? `<img class="bt-brand__logo" data-clenzy-logo="true" data-baitly-default-logo="${templateId}" src="${src}" alt="" width="48" height="48"/>` : '';
}

/** Mise à niveau additive : ne remplace jamais une image, un SVG ou un nom personnalisé. */
export function addBaitlyTemplateLogos(html: string, css: string): { html: string; css: string; changed: boolean } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let changed = false;
  for (const site of doc.querySelectorAll<HTMLElement>('.bt-site[data-baitly-template]')) {
    if (site.hasAttribute('data-baitly-logo-version')) continue;
    const templateId = site.dataset.baitlyTemplate!;
    if (!baitlyTemplateLogoSource(templateId)) continue;
    for (const brand of site.querySelectorAll('.bt-brand')) {
      if (brand.querySelector('img,svg,picture') || !brand.textContent?.trim()) continue;
      brand.insertAdjacentHTML('afterbegin', baitlyTemplateLogoMarkup(templateId));
    }
    site.dataset.baitlyLogoVersion = '1';
    changed = true;
  }
  return changed ? { html: doc.body.innerHTML, css: `${css}\n${logoCss}`, changed } : { html, css, changed };
}

/** Préserve le projectData du client, ses composants et ses styles lors de la mise à niveau. */
export function addBaitlyTemplateLogosToEditor(editor: Editor): void {
  let changed = false;
  for (const site of editor.getWrapper()?.findType((component) => component.getClasses().includes('bt-site') && !!component.getAttributes()['data-baitly-template']) ?? []) {
    const attrs = site.getAttributes();
    if (attrs['data-baitly-logo-version'] || !baitlyTemplateLogoSource(attrs['data-baitly-template'])) continue;
    for (const brand of site.findType((component) => component.getClasses().includes('bt-brand'))) {
      if (brand.findType((component) => ['img', 'svg', 'picture'].includes(component.get('tagName') || '')).length
          || !brand.toHTML().replace(/<[^>]+>/g, '').trim()) continue;
      brand.append(baitlyTemplateLogoMarkup(attrs['data-baitly-template']), { at: 0 });
    }
    site.addAttributes({ 'data-baitly-logo-version': '1' });
    changed = true;
  }
  if (changed) editor.addStyle(logoCss);
}

/** Upgrade saved pages without replacing their content or losing Studio component metadata. */
export async function addBaitlyTemplateLogosToBlocks(blocks: string): Promise<string> {
  let envelope;
  try { envelope = JSON.parse(blocks); } catch { return blocks; }
  if (!envelope || typeof envelope !== 'object') return blocks;
  const project = envelope.format === 'grapesjs' ? envelope.projectData : envelope.pages ? envelope : null;
  if (project && Array.isArray(project.pages)) {
    const { default: grapesjs } = await import('grapesjs');
    const editor = grapesjs.init({ headless: true, storageManager: false });
    try {
      editor.loadProjectData(project);
      const before = editor.getHtml();
      addBaitlyTemplateLogosToEditor(editor);
      if (editor.getHtml() === before) return blocks;
      const upgraded = editor.getProjectData();
      return JSON.stringify(envelope.format === 'grapesjs' ? {
        ...envelope, projectData: upgraded, html: editor.getHtml(), css: editor.getCss({ keepUnusedStyles: true }),
      } : upgraded);
    } finally { editor.destroy(); }
  }
  if (envelope.format !== 'grapesjs' || typeof envelope.html !== 'string') return blocks;
  const upgraded = addBaitlyTemplateLogos(envelope.html, envelope.css || '');
  return upgraded.changed ? JSON.stringify({ ...envelope, html: upgraded.html, css: upgraded.css }) : blocks;
}
