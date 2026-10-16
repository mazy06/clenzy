// Carte Baitly · fabrique les glyphes de la police des libellés (« Baitly Sans »).
//
// Exécuté dans un conteneur node:20 (x86_64) par build-baitly-fonts.sh, avec fontnik.
// Pour chaque plage de 256 caractères, fusionne par priorité :
//   1. Plus Jakarta Sans (police de l'interface Baitly) — latin ;
//   2. Tajawal (police arabe de l'interface) — arabe ;
//   3. Noto Sans (glyphes Protomaps déjà téléchargés) — tout le reste (tifinagh, cyrillique…).
// Arguments : <dossier TTF> <dossier des glyphes Noto> <dossier de sortie>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fontnik = require('fontnik');

const [ttfDir, notoDir, outDir] = process.argv.slice(2);
const STACKS = [
  { name: 'Baitly Sans Regular', ttf: ['PlusJakartaSans-Regular.ttf', 'Tajawal-Regular.ttf'], noto: 'Noto Sans Regular' },
  { name: 'Baitly Sans Medium', ttf: ['PlusJakartaSans-Medium.ttf', 'Tajawal-Medium.ttf'], noto: 'Noto Sans Medium' },
  { name: 'Baitly Sans Italic', ttf: ['PlusJakartaSans-Italic.ttf', 'Tajawal-Regular.ttf'], noto: 'Noto Sans Italic' },
];

const range = (font, start) =>
  new Promise((resolve, reject) =>
    fontnik.range({ font, start, end: start + 255 }, (error, data) => (error ? reject(error) : resolve(data))));
const composite = (buffers) =>
  new Promise((resolve, reject) =>
    fontnik.composite(buffers, (error, data) => (error ? reject(error) : resolve(data))));

for (const stack of STACKS) {
  const fonts = stack.ttf.map((file) => fs.readFileSync(path.join(ttfDir, file)));
  const target = path.join(outDir, stack.name);
  fs.mkdirSync(target, { recursive: true });
  let written = 0;
  for (let start = 0; start <= 65280; start += 256) {
    const file = `${start}-${start + 255}.pbf`;
    const buffers = [];
    for (const font of fonts) buffers.push(await range(font, start));
    const noto = path.join(notoDir, stack.noto, file);
    if (fs.existsSync(noto)) buffers.push(fs.readFileSync(noto));
    fs.writeFileSync(path.join(target, file), await composite(buffers));
    written += 1;
  }
  console.log(`→ ${stack.name} : ${written} plages`);
}
