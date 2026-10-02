// Rendu d'une vidéo motion design Baitly : HTML animé -> MP4 (H.264 + AAC).
//
// À quoi sert ce fichier : transforme un dossier `reel-XX-nom/` (index.html qui
// expose `window.renderAt(t)` + timeline.js qui expose `window.TIMELINE`) en MP4
// prêt pour Instagram, image par image, donc sans saccade ni dérive de timing.
// Comment l'utiliser :
//   node render.mjs reel-01-manifeste --lang=fr         -> out/reel-01-manifeste-fr.mp4
//   node render.mjs reel-01-manifeste --lang=ar --stills=1,5,14 -> images de contrôle PNG
// Voix off : vo/<langue>/<id>.(wav|mp3|m4a|aiff), ids et départs dans timeline.js.
// Prérequis : Google Chrome (macOS), ffmpeg dans le PATH, `npm install` ici.
// À qui il s'adresse : quiconque régénère les vidéos après une retouche.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Format par défaut : Reel 9:16. Un Reel peut en déclarer un autre (timeline.width / height, ex. 16:9).
let WIDTH = 1080;
let HEIGHT = 1920;

const [name, ...flags] = process.argv.slice(2);
if (!name) {
  console.error('Usage : node render.mjs <dossier-du-reel> [--stills=t1,t2,...]');
  process.exit(1);
}
const reelDir = resolve(HERE, name);
const outDir = join(HERE, 'out');
mkdirSync(outDir, { recursive: true });
const stills = flags.find((f) => f.startsWith('--stills='))?.slice('--stills='.length).split(',').map(Number);
const lang = flags.find((f) => f.startsWith('--lang='))?.slice('--lang='.length) || 'fr';
// Format d'une vidéo déclinée (série Académie) : --format=9x16 | 16x9, lu par timeline.js (window.__FORMAT__).
const format = flags.find((f) => f.startsWith('--format='))?.slice('--format='.length) || '';
const tag = `${name}-${lang}${format ? '-' + format : ''}`;
const VO_EXT = ['wav', 'mp3', 'm4a', 'aiff'];
const voFile = (id) => VO_EXT.map((e) => join(reelDir, 'vo', lang, `${id}.${e}`)).find((f) => existsSync(f));

function run(cmd, args, input) {
  return new Promise((ok, ko) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code === 0 ? ok() : ko(new Error(`${cmd} a échoué (${code})\n${err.slice(-2000)}`))));
    if (input) input(p.stdin);
  });
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await page.addInitScript(([l, f]) => { window.__RENDER__ = true; window.__LANG__ = l; if (f) window.__FORMAT__ = f; }, [lang, format]);
// Délai large : la police arabe (Google Fonts) peut mettre du temps à arriver ; 30 s par défaut ne suffit pas toujours.
await page.goto('file://' + join(reelDir, 'index.html'), { timeout: 180000 });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
});
const timeline = await page.evaluate(() => window.TIMELINE);
// Une langue dont les scènes suivent la voix (align-vo.py) peut avoir sa propre durée.
timeline.duration = timeline.lang?.[lang]?.duration ?? timeline.duration;
if (timeline.width && timeline.height) {
  WIDTH = timeline.width; HEIGHT = timeline.height;
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  // Laisser le navigateur appliquer la nouvelle taille : sinon la 1re capture en 16:9 peut
  // mélanger deux mises en page (bas de l'image remplacé par le haut de la scène).
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
const frameAt = async (t) => {
  await page.evaluate((x) => window.renderAt(x), t);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
};

if (stills) {
  const dir = join(outDir, `${tag}-stills`);
  mkdirSync(dir, { recursive: true });
  for (const t of stills) {
    const png = await frameAt(t);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`), png);
  }
  await browser.close();
  console.log(`Images de contrôle : ${dir}`);
  process.exit(0);
}

// 1. Image : chaque frame est calculée à son instant exact puis poussée à ffmpeg.
const silent = join(outDir, `${tag}.silent.mp4`);
const total = Math.round(timeline.duration * timeline.fps);
const started = Date.now();
await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(timeline.fps), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent], async (stdin) => {
  for (let i = 0; i < total; i++) {
    const png = await frameAt(i / timeline.fps);
    if (!stdin.write(png)) await new Promise((r) => stdin.once('drain', r));
    if (i % 60 === 0) process.stdout.write(`\r${i}/${total} images`);
  }
  stdin.end();
});
await browser.close();
process.stdout.write(`\r${total}/${total} images en ${Math.round((Date.now() - started) / 1000)} s\n`);

// 2. Son : chaque réplique de voix off posée à son départ, puis normalisation
// à -14 LUFS (niveau de lecture des plateformes sociales).
const out = join(outDir, `${tag}.mp4`);
const starts = timeline.lang?.[lang]?.starts || {};
const vo = (timeline.voiceover || []).map((v) => ({ ...v, start: starts[v.id] ?? v.start, path: voFile(v.id) })).filter((v) => v.path);
console.log(`Voix off ${lang} : ${vo.length}/${(timeline.voiceover || []).length} répliques trouvées`);
// Pistes libres (musique, effets) : `timeline.audio = [{ path, start }]`, chemins relatifs au dossier
// de la vidéo. Une piste déjà masterisée (teaser) garde son niveau : `timeline.loudnorm = false`.
// `fadeOut` (s) : la piste s'éteint en fondu sur la fin de la vidéo (nappe plus longue que l'épisode).
for (const a of timeline.audio || []) {
  const path = resolve(reelDir, a.path);
  if (existsSync(path)) vo.push({ id: a.path, start: a.start || 0, path, gain: a.gain, fadeOut: a.fadeOut });
  else console.log(`Piste audio introuvable : ${a.path}`);
}
if (vo.length === 0) {
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-c', 'copy', '-movflags', '+faststart', out]);
} else {
  const inputs = vo.flatMap((v) => ['-i', v.path]);
  const fade = (v) => (v.fadeOut ? `,afade=t=out:st=${(timeline.duration - v.fadeOut).toFixed(2)}:d=${v.fadeOut}` : '');
  const delays = vo.map((v, i) => `[${i + 1}:a]aresample=48000,volume=${v.gain ?? 1},adelay=${Math.round(v.start * 1000)}:all=1${fade(v)}[a${i}]`).join(';');
  const norm = timeline.loudnorm === false ? 'anull' : 'loudnorm=I=-14:TP=-1.5:LRA=11';
  const mix = `${delays};${vo.map((_, i) => `[a${i}]`).join('')}amix=inputs=${vo.length}:normalize=0,apad,${norm}[aout]`;
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, ...inputs, '-filter_complex', mix,
    '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', timeline.audioBitrate || '192k', '-ar', '48000', '-t', String(timeline.duration),
    // Index en tête de fichier : la lecture en ligne démarre avant la fin du téléchargement.
    '-movflags', '+faststart', out]);
}
rmSync(silent, { force: true });
console.log(`Vidéo : ${out}`);
