#!/usr/bin/env node
// Validateur de template de booking engine Baitly (contrat DESIGN-BAITLY.md, P1).
// Refuse tout template non conforme AVANT ingestion au catalogue (SiteTemplate).
//
// Usage : node scripts/validate-baitly-template.mjs <template.json>
// Sortie : rapport par regle ; code de sortie 0 (conforme) / 1 (rejete) / 2 (erreur d'entree).
//
// Sans dependance (Node ESM). Ce n'est PAS le sanitizer serveur (EmailHtmlSanitizer fait foi au
// runtime) : c'est un garde-fou d'authoring qui applique la checklist §10 du contrat.

import { readFileSync } from 'node:fs';

// ── Contrat (miroir de DESIGN-BAITLY.md) ────────────────────────────────────────────────────────
const PAGE_TYPES = new Set(['HOME', 'PROPERTY_LIST', 'PROPERTY_DETAIL', 'BLOG', 'CUSTOM']);

// Vocabulaire « parcours » autorise sur data-clenzy-widget (PAS les ids de blocs Studio booking-*).
const WIDGET_MARKERS = new Set([
  'search', 'results', 'property-list', 'property', 'dates', 'availability', 'guests',
  'currency', 'cart', 'price', 'guest-form', 'checkout', 'account', 'confirmation', 'upsells',
]);

// Familles arabe-compatibles reconnues (§5 bis — marche Maroc, RTL).
const ARABIC_CAPABLE_FONTS = [
  'Amiri', 'Cairo', 'Tajawal', 'Readex Pro', 'Almarai', 'Rubik', 'IBM Plex Sans Arabic',
  'Noto Naskh Arabic', 'Noto Kufi Arabic', 'Noto Sans Arabic', 'El Messiri', 'Changa',
  'Reem Kufi', 'Scheherazade New', 'Harmattan', 'Mada', 'Lalezar', 'Aref Ruqaa',
];

// Proprietes directionnelles physiques interdites (§5 bis — proprietes logiques obligatoires).
const PHYSICAL_DIRECTION_RE = /(?:margin|padding)-(?:left|right)\s*:|border-(?:left|right)(?:-\w+)?\s*:|text-align\s*:\s*(?:left|right)\b/g;

// Tokens --bt-* qui DOIVENT etre poses dans le css partage (§4).
const REQUIRED_TOKENS = [
  '--bt-color-primary', '--bt-color-primary-hover', '--bt-color-on-primary', '--bt-color-accent',
  '--bt-color-bg', '--bt-color-surface', '--bt-color-surface-2',
  '--bt-color-text', '--bt-color-text-muted', '--bt-color-border', '--bt-color-divider',
  '--bt-font-heading', '--bt-font-body',
  '--bt-text-xs', '--bt-text-sm', '--bt-text-md', '--bt-text-lg', '--bt-text-xl', '--bt-text-2xl', '--bt-text-3xl',
  '--bt-weight-normal', '--bt-weight-medium', '--bt-weight-semibold', '--bt-weight-bold', '--bt-heading-weight',
  '--bt-leading-tight', '--bt-leading-normal', '--bt-leading-relaxed',
  '--bt-tracking-tight', '--bt-tracking-normal', '--bt-tracking-wide',
  '--bt-space-1', '--bt-space-2', '--bt-space-3', '--bt-space-4', '--bt-space-5', '--bt-space-6',
  '--bt-section-y', '--bt-container',
  '--bt-radius-sm', '--bt-radius-md', '--bt-radius-lg', '--bt-radius-pill',
  '--bt-radius-button', '--bt-radius-card', '--bt-radius-input',
  '--bt-shadow-sm', '--bt-shadow-md', '--bt-shadow-lg', '--bt-shadow-card', '--bt-border-width',
  '--bt-button-padding-x', '--bt-button-padding-y', '--bt-button-transform', '--bt-control-height',
  '--bt-duration', '--bt-ease',
];

// ── Collecte des constats ───────────────────────────────────────────────────────────────────────
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// Toutes les captures d'une regex globale (via l'iterateur natif matchAll).
const captures = (re, s) => Array.from(s.matchAll(re));

// ── Entree ──────────────────────────────────────────────────────────────────────────────────────
const file = process.argv[2];
if (!file) {
  console.error('Usage : node scripts/validate-baitly-template.mjs <template.json>');
  process.exit(2);
}

let tpl;
try {
  tpl = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`❌ JSON illisible : ${e.message}`);
  process.exit(2);
}

// ── Regles racine ─────────────────────────────────────────────────────────────────────────────
const meta = tpl.meta ?? {};
if (!tpl.meta || typeof tpl.meta !== 'object') fail('meta manquant');
if (!meta.name) fail('meta.name manquant');
if (!meta.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.slug)) fail('meta.slug absent ou non kebab-case');
if (!meta.category) fail('meta.category manquant');
if (!meta.archetype) fail('meta.archetype manquant');
if (!meta.theme) fail('meta.theme manquant');

const css = typeof tpl.css === 'string' ? tpl.css : '';
if (!css.trim()) fail('css partage manquant ou vide');
if (!tpl.designVars || typeof tpl.designVars !== 'object') fail('designVars manquant');

// Tokens : presents dans designVars ET poses sur .site-root dans le css.
for (const tok of REQUIRED_TOKENS) {
  if (!tpl.designVars || tpl.designVars[tok] === undefined) fail(`designVars: token manquant ${tok}`);
  if (css && !css.includes(tok)) fail(`css: token non utilise/pose ${tok}`);
}
if (css && !/\.site-root\s*\{/.test(css)) warn('css: aucun bloc `.site-root { … }` detecte (les --bt-* doivent y etre poses)');

// §5 bis — RTL : font stacks arabe-compatibles (fr/en/ar servi par le meme template).
for (const tok of ['--bt-font-heading', '--bt-font-body']) {
  const stack = tpl.designVars ? String(tpl.designVars[tok] ?? '') : '';
  if (stack && !ARABIC_CAPABLE_FONTS.some((f) => stack.toLowerCase().includes(f.toLowerCase()))) {
    fail(`designVars: ${tok} sans famille arabe-compatible (§5 bis) — ajouter ex. 'Amiri', 'Tajawal', 'Rubik'…`);
  }
}

// §5 bis — RTL : proprietes directionnelles physiques (proprietes logiques obligatoires).
for (const m of captures(PHYSICAL_DIRECTION_RE, css)) {
  warn(`css: propriete directionnelle physique « ${m[0].trim()} » — utiliser les proprietes logiques (margin-inline-*, text-align: start/end)`);
}

// ── Pages ─────────────────────────────────────────────────────────────────────────────────────
const pages = Array.isArray(tpl.pages) ? tpl.pages : [];
if (pages.length === 0) fail('pages[] vide');

const paths = new Set(pages.map((p) => p && p.path).filter(Boolean));
let hasHome = false;

pages.forEach((p, i) => {
  const tag = `page[${i}] (${(p && p.path) || '?'})`;
  if (!p || typeof p !== 'object') { fail(`${tag} invalide`); return; }
  if (!p.path || !p.path.startsWith('/')) fail(`${tag}: path absent ou ne commence pas par /`);
  if (!PAGE_TYPES.has(p.type)) fail(`${tag}: type invalide « ${p.type} »`);
  if (p.type === 'HOME') hasHome = true;
  if (!p.title) fail(`${tag}: title manquant`);
  if (!p.seoTitle || p.seoTitle.length > 60) fail(`${tag}: seoTitle absent ou > 60 car.`);
  if (!p.seoDescription || p.seoDescription.length > 155) fail(`${tag}: seoDescription absent ou > 155 car.`);

  const html = typeof p.html === 'string' ? p.html : '';
  if (!html.trim()) { fail(`${tag}: html vide`); return; }

  // Racine unique, nav + footer.
  const roots = captures(/class\s*=\s*["'][^"']*\bsite-root\b/g, html).length;
  if (roots !== 1) fail(`${tag}: doit contenir exactement une .site-root (trouve ${roots})`);
  if (!/class\s*=\s*["'][^"']*\bsite-nav\b/.test(html)) fail(`${tag}: <nav class="site-nav"> manquant`);
  if (!/class\s*=\s*["'][^"']*\bsite-footer\b/.test(html)) fail(`${tag}: <footer class="site-footer"> manquant`);

  // Securite.
  if (/<script[\s>]/i.test(html)) fail(`${tag}: <script> interdit`);
  if (/<iframe[\s>]/i.test(html)) fail(`${tag}: <iframe> interdit`);
  if (/\son[a-z]+\s*=/i.test(html)) fail(`${tag}: attribut d'evenement inline (on*=) interdit`);

  // Fond image inline interdit.
  if (/style\s*=\s*["'][^"']*background(-image)?\s*:[^"']*url\(/i.test(html)) {
    fail(`${tag}: fond image inline interdit (utiliser une classe CSS)`);
  }

  // Images https absolu.
  for (const m of captures(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi, html)) {
    if (!/^https:\/\//.test(m[1])) fail(`${tag}: <img> non https absolu (${m[1].slice(0, 40)}…)`);
  }

  // Marqueurs widgets : vocabulaire + vides + navigation coherente.
  for (const m of captures(/data-clenzy-widget\s*=\s*["']([^"']+)["']/gi, html)) {
    if (!WIDGET_MARKERS.has(m[1])) fail(`${tag}: marqueur inconnu data-clenzy-widget="${m[1]}" (hors vocabulaire parcours)`);
  }
  // Marqueur non vide (contenu enfant) : heuristique <div data-clenzy-widget="x">…</div>.
  for (const m of captures(/<div\b[^>]*data-clenzy-widget\s*=\s*["'][^"']+["'][^>]*>([\s\S]*?)<\/div>/gi, html)) {
    if (m[1].trim() !== '') fail(`${tag}: un marqueur widget doit etre un <div> VIDE`);
  }
  // Navigation : les paths cibles doivent exister dans le template.
  for (const m of captures(/data-clenzy-(?:next|return)\s*=\s*["']([^"']+)["']/gi, html)) {
    if (!paths.has(m[1])) warn(`${tag}: navigation vers "${m[1]}" — page absente du template`);
  }

  // Liens internes vers pages inexistantes (warning, pas bloquant : ancres/externes toleres).
  for (const m of captures(/<a\b[^>]*\bhref\s*=\s*["'](\/[^"'#?]*)["']/gi, html)) {
    if (!paths.has(m[1])) warn(`${tag}: lien interne href="${m[1]}" — page absente du template`);
  }

  // Emoji comme icone (heuristique large sur plages emoji).
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html)) warn(`${tag}: emoji detecte — ne pas utiliser d'emoji comme icone`);
});

if (!hasHome) fail('aucune page de type HOME');

// ── Rapport ─────────────────────────────────────────────────────────────────────────────────────
for (const w of warnings) console.log(`⚠️  ${w}`);
if (errors.length === 0) {
  console.log(`✅ Template conforme : ${meta.name || file} (${pages.length} page(s), ${warnings.length} avertissement(s))`);
  process.exit(0);
}
for (const e of errors) console.log(`❌ ${e}`);
console.log(`\n${errors.length} erreur(s) — template REJETE.`);
process.exit(1);
