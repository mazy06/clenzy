// Baitly · Relecture des textes des Reels : extraction.
//
// À quoi sert ce fichier : lit les textes de chaque Reel (i18n.js = textes à l'écran et sous-titres,
// VOIX-OFF.md = voix off) et les écrit en JSON, pour construire le classeur de relecture.
// Utilisation : node relecture/extract-texts.mjs relecture/textes.json, puis
// python3 relecture/build_xlsx.py relecture/textes.json relecture/textes-reels-a-relire.xlsx
// À qui il s'adresse : marketing (préparer la relecture des traducteurs).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname;
const LANGS = ['fr', 'en', 'ar'];
const reels = readdirSync(ROOT).filter((d) => /^reel-\d{2}/.test(d)).sort();

function loadStrings(dir) {
  const ctx = { window: {}, Object, Array, String, Number, Math };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, dir, 'i18n.js'), 'utf8'), ctx);
  return ctx.window.STRINGS;
}
function flatten(v, path, out) {
  if (typeof v === 'function') { [1, 2, 3].forEach((n) => out[`${path}(${n})`] = String(v(n))); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => flatten(x, `${path}[${i}]`, out)); return; }
  if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) flatten(x, path ? `${path}.${k}` : k, out); return; }
  if (typeof v === 'string') out[path] = v;
}
const NUMERIC = /^[\d\s.,:+\-−–→←·%×/#()]+$/;
const FILE = /\.(jpg|jpeg|png|webp|svg)$/i;
const BRANDS = new Set(['Airbnb', 'Booking.com', 'Gathern', 'Expedia', 'PayTabs', 'Stripe', 'Maison Zayna', 'baitly', 'Baitly', 'ZATCA', 'AR · FR · EN', 'INV-2026-0142', 'iCal', 'MZ']);

function parseVoice(dir) {
  const md = readFileSync(join(ROOT, dir, 'VOIX-OFF.md'), 'utf8');
  const lines = md.split('\n');
  const sections = {}; let cur = null; let inWin = false;
  const win = {};
  for (const l of lines) {
    if (l.startsWith('## ')) {
      inWin = /Fenêtres|Plans/.test(l);   // « Plans » : série 08-15, plans calés sur la voix (pas de fenêtre fixe)
      cur = /Français/.test(l) ? 'fr' : /English/.test(l) ? 'en' : /العربية/.test(l) ? 'ar' : (/^## 3\. Texte/.test(l) ? 'ar' : null);
      continue;
    }
    const m = l.match(/^\| (b\d+) \| (.*) \|\s*$/);
    if (!m) continue;
    const cells = m[2].split(' | ');
    if (inWin) { win[m[1]] = cells; continue; }
    if (cur) (sections[cur] ||= {})[m[1]] = { text: cells[0], target: cells[1], tone: cells[2] };
  }
  // Traduction de travail FR (Reel 06, arabe seul)
  const tw = md.match(/\*\*Traduction de travail[^*]*\*\*\s*:([\s\S]*?)\n\n/);
  if (tw && !sections.fr) {
    sections.fr = {};
    for (const x of tw[1].replace(/\n/g, ' ').matchAll(/b(\d) « (.*?) »/g)) sections.fr['b' + x[1]] = { text: x[2] + '  (traduction de travail, non enregistrée)' };
  }
  return { sections, win };
}

/** Où le texte apparaît, en clair, à partir de sa clé. */
function contextOf(k, dir) {
  if (k === 'illustrative') return 'Mention « Scène illustrative » (petite pastille)';
  if (/^ch\[\d+\]\[0\]$/.test(k)) return 'Numéro et nom du chapitre (petites capitales)';
  if (/^ch\[\d+\]\[1\]$/.test(k)) return 'Titre du chapitre';
  if (k.startsWith('intro.')) return 'Ouverture : mots qui convergent vers le logo';
  if (k === 'cta') return 'Bouton de l’écran de fin';
  if (k.startsWith('facts')) return 'Pastilles de l’écran de fin (chiffre + libellé)';
  if (/nights\(\d\)/.test(k)) return `Brique du planning : durée du séjour pour ${k.match(/\((\d)\)/)[1]} nuit(s)`;
  if (k.startsWith('planEn')) return 'Planning en ANGLAIS volontairement (état « avant » la bascule vers l’arabe)';
  if (/(^|\.)plan\w*\./.test(k) || k.startsWith('plan.')) return 'Planning (maquette d’interface)';
  if (/^(t[A-Z0-9]\w*|tFinal|tEnd|tG|promise|title)(\[\d+\])?$/.test(k)) return 'Titre à l’écran (mots entre [ ] en couleur)';
  if (/subtitle|sub$/.test(k)) return 'Texte secondaire à l’écran';
  if (/(^|\.)(btn|cta|approve|adjust|refuse|send|add|go|book|pay|action)\b/.test(k)) return 'Bouton (maquette) : rester court';
  if (/tabs|steps|demand|months|chain|countries/.test(k)) return 'Onglet / étape (maquette) : rester court';
  if (/lock|notif|n1|n2/.test(k)) return 'Notification sur écran verrouillé';
  if (/subtitles/.test(k)) return 'Sous-titre';
  return 'Maquette d’interface (libellé)';
}

const result = [];
for (const dir of reels) {
  const S = loadStrings(dir);
  const flat = {};
  for (const lg of LANGS) if (S[lg]) { flat[lg] = {}; flatten(S[lg], '', flat[lg]); }
  const present = LANGS.filter((l) => flat[l]);
  const keys = [...new Set(present.flatMap((l) => Object.keys(flat[l])))];
  const subs = [], screen = [];
  // Sous-titres : regroupés par index
  const subIdx = new Set(keys.filter((k) => k.startsWith('subtitles[')).map((k) => k.match(/^subtitles\[(\d+)\]/)[1]));
  for (const i of [...subIdx].map(Number).sort((a, b) => a - b)) {
    const row = { id: `ST${i + 1}` };
    for (const lg of present) {
      const s = S[lg].subtitles[i];
      if (!s) continue;
      row.timing = `${String(s.from).replace('.', ',')}–${String(s.to).replace('.', ',')} s`;
      row[lg] = (s.text || '') + (s.em ? `[${s.em}]` : '') + (s.after || '');
    }
    subs.push(row);
  }
  // Mots mis en couleur dans un titre (clés « …Em ») : marqués entre crochets dans le titre lui-même.
  const emOf = (lg, key) => {
    const base = key.replace(/\[\d+\]$/, '');
    const em = S[lg][base + 'Em'];
    return Array.isArray(em) ? em : null;
  };
  const markEm = (text, em) => text.split(' ').map((w) => (em.some((e) => e && w.replace(/[.,،:…!?؟]/g, '').includes(e.replace(/[.,،:…!?؟]/g, ''))) ? `[${w}]` : w)).join(' ');
  for (const k of keys) {
    if (k === 'dir' || k.startsWith('subtitles[')) continue;
    if (/Em(\[\d+\])?$/.test(k)) continue;                 // fusionné dans le titre
    if (/guests\.\w+\[0\]$/.test(k)) continue;             // initiales d'avatar
    if (/(^|\.)(dir|key)$/.test(k)) continue;
    const vals = present.map((l) => flat[l][k]).filter((v) => v != null);
    if (!vals.length) continue;
    const same = vals.every((v) => v === vals[0]);
    if (vals.every((v) => NUMERIC.test(v) || FILE.test(v))) continue;
    if (same && (BRANDS.has(vals[0]) || /^[a-z]{2,10}$/.test(vals[0]) || NUMERIC.test(vals[0]))) continue;
    const row = { key: k, context: contextOf(k, dir) };
    for (const lg of present) {
      const em = emOf(lg, k);
      row[lg] = em && flat[lg][k] ? markEm(flat[lg][k], em) : flat[lg][k];
    }
    screen.push(row);
  }
  const { sections, win } = parseVoice(dir);
  const voice = Object.keys(win).map((id) => {
    const w = win[id];
    const row = { id, window: w.length > 1 ? `${w[0]} → ${w[1]} (fenêtre ${w[2]})` : 'suit la voix', scene: w[w.length - 1] };
    for (const lg of LANGS) if (sections[lg] && sections[lg][id]) { row[lg] = sections[lg][id].text; row[lg + 'Target'] = sections[lg][id].target; row[lg + 'Tone'] = sections[lg][id].tone; }
    return row;
  });
  const tl = readFileSync(join(ROOT, dir, 'timeline.js'), 'utf8');
  const duration = tl.match(/duration:\s*([\d.]+)/)[1];
  const fmt = /width:\s*1920/.test(tl) ? '16:9 (1920×1080)' : '9:16 (1080×1920)';
  result.push({ dir, duration, fmt, langs: present, voice, subs, screen });
}
writeFileSync(process.argv[2], JSON.stringify(result, null, 1));
for (const r of result) console.log(r.dir, r.langs.join('/'), 'voix', r.voice.length, 'sous-titres', r.subs.length, 'écran', r.screen.length);
