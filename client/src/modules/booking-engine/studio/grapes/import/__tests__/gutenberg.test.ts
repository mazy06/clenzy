import { describe, it, expect } from 'vitest';
import gutenbergImporter from '../gutenberg';

/**
 * Adaptateur WordPress Gutenberg → HTML. Le contenu Gutenberg EST du HTML encadré par des délimiteurs
 * en commentaires : on retire les délimiteurs et on conserve/assainit le HTML interne. On vérifie aussi
 * le repli sûr (jamais de throw) et l'assainissement XSS.
 */

const validGutenberg = `<!-- wp:heading --><h2>Notre logement</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Un séjour agréable.</p><!-- /wp:paragraph -->`;

describe('gutenbergImporter.detect', () => {
  it('détecte la signature de bloc <!-- wp:', () => {
    expect(gutenbergImporter.detect(validGutenberg)).toBe(true);
    expect(gutenbergImporter.detect('<!-- wp:image /-->')).toBe(true);
  });

  it('refuse du HTML / Markdown sans délimiteur Gutenberg', () => {
    expect(gutenbergImporter.detect('<div>x</div>')).toBe(false);
    expect(gutenbergImporter.detect('# Titre')).toBe(false);
  });
});

describe('gutenbergImporter.toHtml — conversion', () => {
  it('retire les délimiteurs de blocs et conserve le HTML interne', () => {
    const { html, report } = gutenbergImporter.toHtml(validGutenberg);
    expect(html).not.toContain('<!-- wp:');
    expect(html).not.toContain('/wp:');
    expect(html).toContain('<h2>Notre logement</h2>');
    expect(html).toContain('<p>Un séjour agréable.</p>');
    expect(report.source).toBe('gutenberg');
  });

  it('retire les délimiteurs auto-fermants', () => {
    const { html } = gutenbergImporter.toHtml('<!-- wp:spacer /--><div class="spacer"></div>');
    expect(html).not.toContain('wp:');
    expect(html).toContain('<div class="spacer">');
  });

  it('assainit le HTML interne (XSS retiré)', () => {
    const { html } = gutenbergImporter.toHtml('<!-- wp:html --><script>alert(1)</script><p>ok</p><!-- /wp:html -->');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('<p>ok</p>');
  });

  it('produit une note sur les blocs dynamiques', () => {
    const { report } = gutenbergImporter.toHtml(validGutenberg);
    expect(report.notes).toMatch(/dynamiques/i);
  });
});

describe('gutenbergImporter.toHtml — robustesse', () => {
  it('signale une entrée vide sans throw', () => {
    const { html, report } = gutenbergImporter.toHtml('');
    expect(html).toBe('');
    expect(report.warnings.length).toBeGreaterThan(0);
  });
});
