import grapesjs from 'grapesjs';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { BAITLY_JOURNEY_TEMPLATES, materializeBaitlyJourneyTemplate } from './baitlyJourneyTemplates';
import { addBaitlyTemplateLogos, addBaitlyTemplateLogosToEditor, addBaitlyTemplateLogosToBlocks, baitlyTemplateLogoSource } from './baitlyTemplateLogos';
import { sanitizeHtml, sanitizeCss } from './sanitizeHtml';

vi.mock('./baitlyTemplateLogos.css?raw', async () => ({
  default: (await import('node:fs')).readFileSync('src/modules/booking-engine/studio/grapes/import/baitlyTemplateLogos.css', 'utf8'),
}));

describe('Logos des templates Baitly', () => {
  it('persists both HTML and editable projectData without losing custom metadata', async () => {
    const editor = grapesjs.init({ headless: true, storageManager: false });
    try {
      editor.setComponents('<main class="bt-site" data-baitly-template="baitly-patio"><a class="bt-brand">Mon riad</a><p>Mes informations</p></main>');
      editor.setStyle('.custom{color:green}');
      const original = JSON.stringify({ format: 'grapesjs', projectData: editor.getProjectData(), html: editor.getHtml(), css: editor.getCss(), custom: 42 });
      const upgraded = await addBaitlyTemplateLogosToBlocks(original);
      const stored = JSON.parse(upgraded);
      expect(stored.custom).toBe(42);
      expect(stored.html).toContain('Mes informations');
      expect(stored.html).toContain('data-baitly-default-logo');
      editor.loadProjectData(stored.projectData);
      expect(editor.getWrapper()!.findType('image')).toHaveLength(1);
      expect(editor.getCss({ keepUnusedStyles: true })).toContain('.custom');
      expect(await addBaitlyTemplateLogosToBlocks(upgraded)).toBe(upgraded);
    } finally { editor.destroy(); }
  });
  it('fournit 14 dessins autonomes distincts et deux emplacements modifiables sur chaque page', () => {
    const sources = new Set<string>();
    for (const model of BAITLY_JOURNEY_TEMPLATES) {
      const src = baitlyTemplateLogoSource(model.id)!;
      expect(src).toMatch(/\/booking\/template-logos\/v1\/baitly-[a-z]+\.svg$/);
      const svg = new DOMParser().parseFromString(readFileSync(`public${new URL(src).pathname}`, 'utf8'), 'image/svg+xml');
      expect(svg.querySelector('parsererror,script,foreignObject,image')).toBeNull();
      expect(svg.documentElement.getAttribute('viewBox')).toBe('0 0 64 64');
      sources.add(src);
      for (const page of model.pages) {
        const doc = new DOMParser().parseFromString(sanitizeHtml(page.html), 'text/html');
        const logos = doc.querySelectorAll<HTMLImageElement>('.bt-brand [data-clenzy-logo]');
        expect(logos, `${model.id} ${page.path}`).toHaveLength(2);
        for (const logo of logos) {
          expect(logo.getAttribute('src')).toBe(src);
          expect(logo.alt).toBe('');
          expect(logo.closest('a')?.textContent?.trim()).toBe(model.name);
        }
      }
    }
    expect(sources.size).toBe(14);
    expect(baitlyTemplateLogoSource('../../unknown')).toBeUndefined();
  });

  it('personnalise le nom du logement sans altérer le logo ni le master', () => {
    const master = BAITLY_JOURNEY_TEMPLATES.find((model) => model.id === 'baitly-patio')!;
    const fork = materializeBaitlyJourneyTemplate(master, { name: 'Riad des oliviers & jardin' });
    const doc = new DOMParser().parseFromString(fork.pages[0].html, 'text/html');
    expect(doc.querySelector('.bt-brand')?.textContent).toBe('Riad des oliviers & jardin');
    expect(doc.querySelector('.bt-brand img')?.getAttribute('src')).toBe(baitlyTemplateLogoSource(master.id));
    expect(master.pages[0].html).not.toContain('Riad des oliviers');
  });

  it('complète uniquement les emplacements sans logo et ne rétablit pas un logo ensuite supprimé', () => {
    const html = '<main class="bt-site" data-baitly-template="baitly-patio"><a class="bt-brand" href="/">Mon adresse</a><a class="bt-brand" href="/"><img src="https://example.org/client.svg" alt="Ma marque"/>Logo client</a></main>';
    const first = addBaitlyTemplateLogos(html, '.client{color:green}');
    const doc = new DOMParser().parseFromString(first.html, 'text/html');
    expect(doc.querySelectorAll('[data-baitly-default-logo]')).toHaveLength(1);
    expect(doc.querySelector('img[src="https://example.org/client.svg"]')).not.toBeNull();
    expect(first.css).toContain('.client{color:green}');
    doc.querySelector('[data-baitly-default-logo]')!.remove();
    const edited = doc.body.innerHTML;
    expect(addBaitlyTemplateLogos(edited, first.css)).toEqual({ html: edited, css: first.css, changed: false });
  });

  it('conserve le vrai projet Studio et les modifications des clients au chargement et à la sauvegarde', () => {
    const editor = grapesjs.init({ headless: true, storageManager: false });
    const reopened = grapesjs.init({ headless: true, storageManager: false });
    try {
      editor.setComponents('<main class="bt-site" data-baitly-template="baitly-atlas"><a class="bt-brand" href="/">Mon nom personnalisé</a><p id="client-content" class="client-style">Mon texte conservé</p></main>');
      editor.setStyle('.client-style{color:green}');
      addBaitlyTemplateLogosToEditor(editor);
      addBaitlyTemplateLogosToEditor(editor);
      expect(editor.getWrapper()!.findType('image')).toHaveLength(1);
      expect(editor.getHtml()).toContain('Mon nom personnalisé');
      expect(editor.getHtml()).toContain('Mon texte conservé');
      expect(editor.getCss({ keepUnusedStyles: true })).toContain('.client-style');
      reopened.loadProjectData(editor.getProjectData());
      addBaitlyTemplateLogosToEditor(reopened);
      expect(reopened.getWrapper()!.findType('image')).toHaveLength(1);
      const doc = new DOMParser().parseFromString(sanitizeHtml(reopened.getHtml()), 'text/html');
      expect(doc.querySelector('.bt-brand img')?.getAttribute('src')).toBe(baitlyTemplateLogoSource('baitly-atlas'));
      expect(sanitizeCss(reopened.getCss({ keepUnusedStyles: true })!)).toContain('data-baitly-default-logo');
      reopened.getWrapper()!.findType('image')[0].remove();
      addBaitlyTemplateLogosToEditor(reopened);
      expect(reopened.getWrapper()!.findType('image')).toHaveLength(0);
    } finally { editor.destroy(); reopened.destroy(); }
  });
});
