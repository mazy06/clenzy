#!/usr/bin/env node
// Carte Baitly · génère le sprite de la carte (pictogrammes des lieux, cartouches de routes).
//
// À quoi sert ce fichier : remplacer le sprite générique de Protomaps par des pictogrammes
// dans le style de l'interface Baitly — tracés Lucide (ISC, ceux de l'app), pastille ronde
// teintée par famille de lieu. Mêmes NOMS d'images que Protomaps : le style n'a pas à changer.
//
// Utilisation (depuis client/) : node scripts/build-map-sprite.mjs <dossier-de-sortie>
// Sortie : <dossier>/{light,dark}{,@2x}.{json,png}
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import * as lucide from 'lucide';

const outDir = resolve(process.argv[2] ?? 'sprite-out');

/** Familles de lieux → teinte (pastille claire + tracé soutenu). */
const FAMILIES = {
  culture: { light: '#7B5EA7', dark: '#B9A3E3' },
  nature: { light: '#2F7D52', dark: '#5CCB8F' },
  water: { light: '#1F6FB2', dark: '#6FB2EC' },
  transport: { light: '#2F5D9E', dark: '#8AAEE8' },
  food: { light: '#B4504F', dark: '#F08F8A' },
  shop: { light: '#A4652A', dark: '#E8AE70' },
  service: { light: '#56606D', dark: '#A9B6C9' },
};

/** Nom d'image Protomaps → [icône Lucide, famille]. */
const POIS = {
  aerodrome: ['Plane', 'transport'],
  animal: ['PawPrint', 'nature'],
  artwork: ['Palette', 'culture'],
  attraction: ['Star', 'culture'],
  bar: ['Wine', 'food'],
  beach: ['Umbrella', 'water'],
  beauty: ['Sparkles', 'shop'],
  bench: ['Armchair', 'service'],
  books: ['BookOpen', 'culture'],
  building: ['Building2', 'service'],
  bus_stop: ['Bus', 'transport'],
  cafe: ['Coffee', 'food'],
  clothes: ['Shirt', 'shop'],
  convenience: ['ShoppingBasket', 'shop'],
  drinking_water: ['Droplet', 'water'],
  electronics: ['Smartphone', 'shop'],
  fast_food: ['Sandwich', 'food'],
  ferry_terminal: ['Ship', 'water'],
  forest: ['Trees', 'nature'],
  garden: ['Flower2', 'nature'],
  library: ['Library', 'culture'],
  marina: ['Sailboat', 'water'],
  museum: ['Landmark', 'culture'],
  park: ['TreeDeciduous', 'nature'],
  peak: ['Mountain', 'nature'],
  post_office: ['Mail', 'service'],
  restaurant: ['Utensils', 'food'],
  school: ['School', 'service'],
  stadium: ['Trophy', 'service'],
  supermarket: ['ShoppingCart', 'shop'],
  theatre: ['Drama', 'culture'],
  toilets: ['Bath', 'service'],
  train_station: ['TrainFront', 'transport'],
  university: ['GraduationCap', 'culture'],
  zoo: ['Rabbit', 'nature'],
};

/** Cartouches de routes : mêmes dimensions que Protomaps (le texte du numéro s'y pose). */
const SHIELD_WIDTHS = { 1: 21, 2: 22, 3: 25, 4: 31, 5: 37 };
const SHIELD_FAMILIES = ['generic_shield', 'US:I', 'NL:S-road'];

const PALETTE = {
  light: { card: '#FDFDFE', shieldFill: '#FFFFFF', shieldStroke: '#B9AE9B', arrow: '#8C96A3', town: '#4E6170' },
  dark: { card: '#152036', shieldFill: '#2B3B5A', shieldStroke: '#4A5A78', arrow: '#7C8CB0', town: '#C9D5E6' },
};

const escape = (value) => String(value).replace(/"/g, '&quot;');

function lucideMarkup(name) {
  const node = lucide[name];
  if (!node) throw new Error(`Icône Lucide inconnue : ${name}`);
  return node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${escape(v)}"`).join(' ')}/>`)
    .join('');
}

/** Toutes les images du sprite, en coordonnées @1x : [nom, largeur, hauteur, svg interne]. */
function images(mode) {
  const p = PALETTE[mode];
  const list = [];
  for (const [name, [icon, family]] of Object.entries(POIS)) {
    const color = FAMILIES[family][mode];
    list.push([name, 20, 20,
      `<circle cx="10" cy="10" r="9.25" fill="${p.card}" stroke="${color}" stroke-width="1.5"/>` +
      `<circle cx="10" cy="10" r="8.5" fill="${color}" fill-opacity="${mode === 'light' ? 0.12 : 0.22}"/>` +
      `<g transform="translate(4.5 4.5) scale(0.4583)" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${lucideMarkup(icon)}</g>`]);
  }
  for (const family of SHIELD_FAMILIES) {
    for (const [chars, width] of Object.entries(SHIELD_WIDTHS)) {
      list.push([`${family}-${chars}char`, width, 21,
        `<rect x="0.75" y="0.75" width="${width - 1.5}" height="19.5" rx="5" fill="${p.shieldFill}" stroke="${p.shieldStroke}" stroke-width="1.5"/>`]);
    }
  }
  list.push(['arrow', 12, 12, `<path d="M3 6h6M6.5 3.5 9 6l-2.5 2.5" fill="none" stroke="${p.arrow}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`]);
  list.push(['townspot', 10, 10, `<circle cx="5" cy="5" r="3.2" fill="${p.card}" stroke="${p.town}" stroke-width="1.8"/>`]);
  list.push(['capital', 14, 14, `<circle cx="7" cy="7" r="5.5" fill="${p.card}" stroke="${p.town}" stroke-width="1.6"/><circle cx="7" cy="7" r="2.4" fill="${p.town}"/>`]);
  return list;
}

/** Empile les images en lignes ; renvoie l'index JSON et le SVG de la planche. */
function atlas(mode, ratio) {
  const rowWidth = 256;
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  const index = {};
  const parts = [];
  for (const [name, width, height, inner] of images(mode)) {
    if (x + width > rowWidth) {
      x = 0;
      y += rowHeight + 1;
      rowHeight = 0;
    }
    index[name] = { x: x * ratio, y: y * ratio, width: width * ratio, height: height * ratio, pixelRatio: ratio };
    parts.push(`<g transform="translate(${x} ${y})">${inner}</g>`);
    x += width + 1;
    rowHeight = Math.max(rowHeight, height);
  }
  const height = y + rowHeight;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rowWidth * ratio}" height="${height * ratio}" viewBox="0 0 ${rowWidth} ${height}">${parts.join('')}</svg>`;
  return { index, svg };
}

await mkdir(outDir, { recursive: true });
for (const mode of ['light', 'dark']) {
  for (const ratio of [1, 2]) {
    const { index, svg } = atlas(mode, ratio);
    const png = new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng();
    const base = join(outDir, `${mode}${ratio === 2 ? '@2x' : ''}`);
    await writeFile(`${base}.png`, png);
    await writeFile(`${base}.json`, JSON.stringify(index));
    console.log(`→ ${base}.{png,json} (${Object.keys(index).length} images)`);
  }
}
