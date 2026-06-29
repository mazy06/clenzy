import { describe, it, expect } from 'vitest';
import markdownImporter from '../markdown';

/**
 * Adaptateur Markdown → HTML (convertisseur maison, sans dépendance npm). On vérifie la conversion des
 * constructions courantes ET le fait que le texte utilisateur est échappé AVANT balisage (pas
 * d'injection HTML possible depuis le contenu Markdown).
 */

describe('markdownImporter.detect', () => {
  it('détecte les titres ATX', () => {
    expect(markdownImporter.detect('# Titre')).toBe(true);
  });

  it('détecte les listes à puces et ordonnées', () => {
    expect(markdownImporter.detect('- item 1\n- item 2')).toBe(true);
    expect(markdownImporter.detect('1. premier\n2. second')).toBe(true);
  });

  it('détecte le gras et les liens inline', () => {
    expect(markdownImporter.detect('Du texte **gras** ici')).toBe(true);
    expect(markdownImporter.detect('Voir [le site](https://example.com)')).toBe(true);
  });

  it('s\'efface devant le JSON et Gutenberg (adaptateurs dédiés)', () => {
    expect(markdownImporter.detect('{"content":[]}')).toBe(false);
    expect(markdownImporter.detect('<!-- wp:paragraph --># pas du markdown')).toBe(false);
  });

  it('s\'efface devant du HTML de structure dominant', () => {
    expect(markdownImporter.detect('<div><section><h1>x</h1></section></div>')).toBe(false);
  });

  it('renvoie false pour une entrée vide', () => {
    expect(markdownImporter.detect('')).toBe(false);
    expect(markdownImporter.detect('   ')).toBe(false);
  });
});

describe('markdownImporter.toHtml — conversions', () => {
  it('convertit les titres h1..h6', () => {
    const { html } = markdownImporter.toHtml('# T1\n## T2\n###### T6');
    expect(html).toContain('<h1>T1</h1>');
    expect(html).toContain('<h2>T2</h2>');
    expect(html).toContain('<h6>T6</h6>');
  });

  it('convertit une liste à puces en <ul><li>', () => {
    const { html } = markdownImporter.toHtml('- un\n- deux');
    expect(html).toContain('<ul><li>un</li><li>deux</li></ul>');
  });

  it('convertit une liste ordonnée en <ol><li>', () => {
    const { html } = markdownImporter.toHtml('1. un\n2. deux');
    expect(html).toContain('<ol><li>un</li><li>deux</li></ol>');
  });

  it('convertit gras / italique', () => {
    const { html } = markdownImporter.toHtml('Du **gras** et de l\'*italique*');
    expect(html).toContain('<strong>gras</strong>');
    expect(html).toContain('<em>italique</em>');
  });

  it('convertit un lien et du code inline', () => {
    const { html } = markdownImporter.toHtml('Voir [ici](https://example.com) avec `du code`');
    expect(html).toContain('<a href="https://example.com">ici</a>');
    expect(html).toContain('<code>du code</code>');
  });

  it('convertit une citation et une règle horizontale', () => {
    const quote = markdownImporter.toHtml('> citation').html;
    expect(quote).toContain('<blockquote>');
    expect(markdownImporter.toHtml('---').html).toContain('<hr />');
  });
});

describe('markdownImporter.toHtml — sécurité (échappement)', () => {
  it('échappe le HTML brut présent dans le contenu Markdown', () => {
    const { html } = markdownImporter.toHtml('# Bonjour <script>alert(1)</script>');
    expect(html).not.toMatch(/<script>/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('échappe le HTML injecté dans un item de liste (aucune balise active après reparse)', () => {
    const { html } = markdownImporter.toHtml('- <img src=x onerror=alert(1)>');
    // Le `<img` est échappé en `&lt;img` : c'est du TEXTE inerte, pas un élément actif.
    expect(html).toContain('&lt;img');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('img')).toBeNull();
    expect(doc.querySelector('li')?.textContent).toContain('onerror');
  });
});

describe('markdownImporter.toHtml — robustesse', () => {
  it('signale une entrée vide sans throw', () => {
    const { html, report } = markdownImporter.toHtml('');
    expect(html).toBe('');
    expect(report.warnings.length).toBeGreaterThan(0);
  });
});
