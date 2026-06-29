import { describe, it, expect } from 'vitest';
import htmlImporter from '../html';

/**
 * Adaptateur HTML brut (fallback universel) : conserve le HTML légitime, neutralise les vecteurs XSS
 * via `sanitizeHtml`. On vérifie le résultat de `toHtml` puis on REPARSE (DOMParser) pour confirmer
 * qu'aucun nœud actif (script/iframe/object) ni handler ne survit à une éventuelle injection DOM.
 */
function parse(safe: string): Document {
  return new DOMParser().parseFromString(safe, 'text/html');
}

describe('htmlImporter.detect', () => {
  it('accepte toute entrée (fallback universel)', () => {
    expect(htmlImporter.detect('<div>x</div>')).toBe(true);
    expect(htmlImporter.detect('plain text')).toBe(true);
    expect(htmlImporter.detect('')).toBe(true);
  });
});

describe('htmlImporter.toHtml — contenu légitime', () => {
  it('conserve le HTML structurel', () => {
    const input = '<section><h1>Bienvenue chez Baitly</h1><p>Texte <strong>important</strong></p></section>';
    const { html, report } = htmlImporter.toHtml(input);
    expect(html).toBe(input);
    expect(report.source).toBe('html');
    expect(report.warnings).toEqual([]);
  });

  it('conserve une image data:image inline', () => {
    const { html } = htmlImporter.toHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="x" />');
    expect(html).toContain('data:image/png');
  });

  it('gère une entrée vide / null sans throw', () => {
    expect(htmlImporter.toHtml('').html).toBe('');
    expect(htmlImporter.toHtml(null as unknown as string).html).toBe('');
  });
});

describe('htmlImporter.toHtml — XSS neutralisés', () => {
  it('retire <script>', () => {
    const { html } = htmlImporter.toHtml('<p>ok</p><script>alert(1)</script>');
    expect(html).not.toMatch(/<script/i);
    expect(parse(html).querySelector('script')).toBeNull();
  });

  it('retire onclick / onerror', () => {
    const { html } = htmlImporter.toHtml('<img src="x" onerror="alert(1)"><a onclick="x()">l</a>');
    expect(html).not.toMatch(/onerror=/i);
    expect(html).not.toMatch(/onclick=/i);
  });

  it('neutralise href="javascript:…"', () => {
    const { html } = htmlImporter.toHtml('<a href="javascript:alert(1)">x</a>');
    expect(html).not.toMatch(/javascript:/i);
    expect(parse(html).querySelector('a')?.getAttribute('href')).not.toMatch(/javascript:/i);
  });

  it('retire <iframe> et <object>', () => {
    const { html } = htmlImporter.toHtml('<iframe src="https://evil"></iframe><object data="x"></object>');
    const doc = parse(html);
    expect(doc.querySelector('iframe')).toBeNull();
    expect(doc.querySelector('object')).toBeNull();
  });

  it('neutralise data:text/html dangereux', () => {
    const { html } = htmlImporter.toHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(html).not.toMatch(/data:text\/html/i);
  });

  it('NE réinterprète PAS les entités HTML échappées en balise active après reparse', () => {
    // `&lt;script&gt;` doit rester du TEXTE inerte, jamais un élément <script> exécutable.
    const { html } = htmlImporter.toHtml('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    const doc = parse(html);
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('p')?.textContent).toContain('<script>');
  });
});
