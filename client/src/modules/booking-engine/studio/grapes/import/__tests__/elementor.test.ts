import { describe, it, expect } from 'vitest';
import elementorImporter from '../elementor';

/**
 * Adaptateur Elementor (JSON de template → structure HTML best-effort). On vérifie la conversion des
 * widgets courants, la détection sur la signature `elType`, et le REPLI sûr (html vide + warning, jamais
 * de throw) sur JSON malformé ou forme inattendue.
 */

const validTemplate = JSON.stringify({
  content: [
    {
      elType: 'section',
      elements: [
        {
          elType: 'column',
          elements: [
            { elType: 'widget', widgetType: 'heading', settings: { title: 'Notre maison' } },
            { elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Un texte</p>' } },
            {
              elType: 'widget',
              widgetType: 'button',
              settings: { text: 'Réserver', link: { url: 'https://example.com' } },
            },
          ],
        },
      ],
    },
  ],
});

describe('elementorImporter.detect', () => {
  it('détecte un template avec elType', () => {
    expect(elementorImporter.detect(validTemplate)).toBe(true);
  });

  it('détecte un tableau brut d\'éléments', () => {
    expect(elementorImporter.detect('[{"elType":"section","elements":[]}]')).toBe(true);
  });

  it('refuse du JSON sans elType', () => {
    expect(elementorImporter.detect('{"foo":"bar"}')).toBe(false);
  });

  it('refuse une entrée non-JSON', () => {
    expect(elementorImporter.detect('<div>x</div>')).toBe(false);
    expect(elementorImporter.detect('# markdown')).toBe(false);
  });
});

describe('elementorImporter.toHtml — conversion', () => {
  it('convertit sections/colonnes/widgets en HTML', () => {
    const { html } = elementorImporter.toHtml(validTemplate);
    expect(html).toContain('<section>');
    expect(html).toContain('<div class="col">');
    expect(html).toContain('<h2>Notre maison</h2>');
    expect(html).toContain('<p>Un texte</p>');
    expect(html).toContain('<a class="btn" href="https://example.com">Réserver</a>');
  });

  it('échappe les titres injectés', () => {
    const tpl = JSON.stringify({
      content: [{ elType: 'widget', widgetType: 'heading', settings: { title: '<script>alert(1)</script>' } }],
    });
    const { html } = elementorImporter.toHtml(tpl);
    expect(html).not.toMatch(/<script>/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('assainit le HTML d\'un text-editor (XSS retiré)', () => {
    const tpl = JSON.stringify({
      content: [
        { elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>ok</p><script>alert(1)</script>' } },
      ],
    });
    const { html } = elementorImporter.toHtml(tpl);
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('<p>ok</p>');
  });

  it('émet un warning sur la fidélité limitée (pas de CSS du moteur)', () => {
    const { report } = elementorImporter.toHtml(validTemplate);
    expect(report.source).toBe('elementor');
    expect(report.warnings.join(' ')).toMatch(/fidélité limitée/i);
  });
});

describe('elementorImporter.toHtml — JSON malformé / forme inattendue', () => {
  it('replie en html vide + warning sur JSON malformé (pas de throw)', () => {
    const { html, report } = elementorImporter.toHtml('{"content": [ {elType: ');
    expect(html).toBe('');
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.warnings.join(' ')).toMatch(/illisible/i);
  });

  it('replie sur une forme JSON sans content/array', () => {
    const { html, report } = elementorImporter.toHtml('{"foo":42}');
    expect(html).toBe('');
    expect(report.warnings.length).toBeGreaterThan(0);
  });
});
