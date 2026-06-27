import { describe, it, expect } from 'vitest';
import { detectImporter, importToHtml, IMPORTERS } from '../registry';

/**
 * Registre des adaptateurs d'import. On vérifie :
 *   - l'ordre de détection (du plus spécifique au plus générique) ;
 *   - que `markdown` passe AVANT `html` (un Markdown est aussi du « texte » que le fallback accepterait) ;
 *   - que `html` reste le fallback universel en DERNIER ;
 *   - que ni `detectImporter` ni `importToHtml` ne jettent jamais (repli HTML assaini + warning).
 */

describe('IMPORTERS — invariants d\'ordre', () => {
  it('place html en dernier (fallback universel)', () => {
    expect(IMPORTERS[IMPORTERS.length - 1].id).toBe('html');
  });

  it('place markdown juste avant html', () => {
    const ids = IMPORTERS.map((i) => i.id);
    expect(ids.indexOf('markdown')).toBe(ids.indexOf('html') - 1);
  });

  it('place les formats à signature forte (gutenberg/elementor/grapesjs) avant markdown', () => {
    const ids = IMPORTERS.map((i) => i.id);
    const mdIdx = ids.indexOf('markdown');
    for (const strong of ['gutenberg', 'elementor', 'grapesjs', 'divi', 'wpbakery', 'beaver', 'webflow']) {
      expect(ids.indexOf(strong)).toBeLessThan(mdIdx);
    }
  });
});

describe('detectImporter — sélection par contenu', () => {
  it('détecte le Markdown AVANT le fallback HTML', () => {
    expect(detectImporter('# Un titre\n\n- une liste').id).toBe('markdown');
  });

  it('détecte Gutenberg sur la signature <!-- wp:', () => {
    expect(detectImporter('<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->').id).toBe('gutenberg');
  });

  it('détecte Elementor sur du JSON avec elType', () => {
    expect(detectImporter('{"content":[{"elType":"section","elements":[]}]}').id).toBe('elementor');
  });

  it('détecte Divi sur le shortcode [et_pb_section]', () => {
    expect(detectImporter('[et_pb_section][et_pb_row][/et_pb_row][/et_pb_section]').id).toBe('divi');
  });

  it('retombe sur HTML pour du markup générique', () => {
    expect(detectImporter('<div><section><h1>x</h1></section></div>').id).toBe('html');
  });

  it('retombe sur HTML pour une entrée vide', () => {
    expect(detectImporter('').id).toBe('html');
  });
});

describe('importToHtml — conversion + forceId', () => {
  it('convertit du Markdown détecté automatiquement', () => {
    const { html, report } = importToHtml('# Bonjour');
    expect(report.source).toBe('markdown');
    expect(html).toContain('<h1>Bonjour</h1>');
  });

  it('respecte forceId pour court-circuiter la détection', () => {
    // Du Markdown forcé en HTML : pas de conversion de titre, traité tel quel (assaini).
    const { report } = importToHtml('# Bonjour', 'html');
    expect(report.source).toBe('html');
  });

  it('retombe sur la détection si forceId est inconnu', () => {
    const { report } = importToHtml('# Bonjour', 'format-inexistant');
    expect(report.source).toBe('markdown');
  });
});

describe('importToHtml — jamais de throw (repli sûr)', () => {
  it('ne jette pas sur du JSON elementor malformé', () => {
    expect(() => importToHtml('{"content":[{elType:')).not.toThrow();
  });

  it('assainit toujours le résultat (XSS retiré sur du HTML brut)', () => {
    const { html } = importToHtml('<p>ok</p><script>alert(1)</script>');
    expect(html).not.toMatch(/<script/i);
  });

  it('produit un warning de repli si l\'adaptateur choisi lève (forceId vers un adaptateur qui throw)', () => {
    // On force un adaptateur dont le toHtml jette ; le registre doit rattraper en repli HTML + warning.
    const throwingId = '__throwing__';
    const original = [...IMPORTERS];
    IMPORTERS.push({
      id: throwingId,
      label: 'Throwing',
      detect: () => false,
      toHtml: () => {
        throw new Error('boom');
      },
    });
    try {
      const { html, report } = importToHtml('<p>contenu</p>', throwingId);
      expect(html).toContain('<p>contenu</p>');
      expect(report.warnings.join(' ')).toMatch(/HTML brut/i);
    } finally {
      IMPORTERS.length = 0;
      IMPORTERS.push(...original);
    }
  });

  it('ne jette pas si un detect lève (detect défaillant ignoré)', () => {
    const original = [...IMPORTERS];
    IMPORTERS.unshift({
      id: '__bad_detect__',
      label: 'BadDetect',
      detect: () => {
        throw new Error('detect boom');
      },
      toHtml: () => ({ html: '', report: { source: '__bad_detect__', warnings: [] } }),
    });
    try {
      expect(() => detectImporter('<div>x</div>')).not.toThrow();
      expect(detectImporter('<div>x</div>').id).not.toBe('__bad_detect__');
    } finally {
      IMPORTERS.length = 0;
      IMPORTERS.push(...original);
    }
  });
});
