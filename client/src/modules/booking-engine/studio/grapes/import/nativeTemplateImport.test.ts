import { readFileSync } from 'node:fs';
import grapesjs from 'grapesjs';
import { describe, expect, it } from 'vitest';
import { BAITLY_JOURNEY_TEMPLATES } from './baitlyJourneyTemplates';
import { sanitizeCss, sanitizeHtml } from './sanitizeHtml';

describe('Native templates through the actual Studio parser', () => {
  it('retains token definitions, typography, surfaces and images after GrapesJS import and save', () => {
    const editor = grapesjs.init({ headless: true, storageManager: false });
    try {
      const model = BAITLY_JOURNEY_TEMPLATES.find((template) => template.id === 'baitly-patio')!;
      const sourceCss = readFileSync('src/modules/booking-engine/studio/grapes/import/baitlyJourneyTemplates.css', 'utf8');
      editor.setStyle(sanitizeCss(sourceCss));
      editor.setComponents(sanitizeHtml(model.pages[0].html));
      const css = editor.getCss()!;
      expect(css).toContain('--bt-color-primary:#4e5e39');
      expect(css).toContain('background-color:var(--bt-color-background)');
      expect(css).toContain('background-color:var(--bt-color-primary)');
      expect(css).toContain('font-family:var(--bt-font-heading)');
      expect(editor.getHtml()).toContain('<img src="http');
      expect(editor.getHtml()).toContain('data-clenzy-widget="booking-reviews"');
    } finally { editor.destroy(); }
  });
});
