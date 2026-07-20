#!/usr/bin/env node
// Build des templates d'authoring : .mjs → dist/<slug>.json (ingérable) + dist/preview/*.html (revue).
// Usage : node booking-templates/build.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import riadMedina from './riad-medina.mjs';
import villaPalmeraie from './villa-palmeraie.mjs';

const TEMPLATES = [riadMedina, villaPalmeraie];

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');

// Placeholder visuel des marqueurs widget (PREVIEW UNIQUEMENT — jamais ingéré).
const PREVIEW_WIDGET_CSS = `
[data-clenzy-widget]{display:flex; align-items:center; justify-content:center; min-height:96px;
  border:1.5px dashed var(--bt-color-accent, #888); border-radius:var(--bt-radius-md, 10px);
  background:rgba(127,127,127,0.06); position:relative}
[data-clenzy-widget]::after{content:'widget ' attr(data-clenzy-widget);
  font:600 0.75rem/1 system-ui, sans-serif; letter-spacing:0.08em; text-transform:uppercase;
  color:var(--bt-color-accent, #888); opacity:0.85}
[data-clenzy-widget="search"]{min-height:76px; background:rgba(255,255,255,0.82)}
[data-clenzy-widget="results"],[data-clenzy-widget="property"]{min-height:320px}
[data-clenzy-widget="upsells"]{min-height:160px}
`;

mkdirSync(dist, { recursive: true });

for (const tpl of TEMPLATES) {
  writeFileSync(join(dist, `${tpl.meta.slug}.json`), JSON.stringify(tpl, null, 2));

  const previewDir = join(dist, 'preview', tpl.meta.slug);
  mkdirSync(previewDir, { recursive: true });

  tpl.pages.forEach((page, i) => {
    for (const dir of ['ltr', 'rtl']) {
      const html = page.html.replace('class="site-root"', `class="site-root" dir="${dir}"`);
      const doc = [
        '<!doctype html>',
        `<html lang="${dir === 'rtl' ? 'ar' : 'fr'}"><head><meta charset="utf-8">`,
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        `<title>${tpl.meta.name} · ${page.title}${dir === 'rtl' ? ' (RTL)' : ''}</title>`,
        `<style>*{margin:0;padding:0;box-sizing:border-box}${tpl.css}${PREVIEW_WIDGET_CSS}</style>`,
        `</head><body>${html}</body></html>`,
      ].join('\n');
      const base = page.path === '/' ? 'home' : page.path.slice(1).replace(/\//g, '-');
      writeFileSync(join(previewDir, `${i}-${base}${dir === 'rtl' ? '.rtl' : ''}.html`), doc);
    }
  });

  console.log(`✓ ${tpl.meta.slug} : ${tpl.pages.length} pages → dist/${tpl.meta.slug}.json + dist/preview/${tpl.meta.slug}/`);
}
