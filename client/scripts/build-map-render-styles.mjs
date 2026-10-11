#!/usr/bin/env node
// Carte Baitly · génère les styles du moteur de rendu d'images (tileserver-gl).
//
// À quoi sert ce fichier : produire, à partir du MÊME code que la carte web
// (src/components/map/baitlyMapStyle.ts), les styles JSON qu'utilise le conteneur
// baitly-maps-renderer pour dessiner les images des e-mails et les tuiles raster de
// l'application mobile. Une seule palette : changer une couleur dans le style web
// puis relancer ce script suffit.
//
// Utilisation (depuis client/) : node scripts/build-map-render-styles.mjs <dossier-de-sortie>
// Sortie : <dossier>/styles/baitly-paper-{fr,en,ar}.json — rendu à plat, mode Papier ;
//         <dossier>/web-styles/baitly-{paper,night}-{fr,en,ar}.json — style complet (3D) pour
//         les sites générés (clenzy-sites), avec les jetons __BAITLY_TILES__ / __BAITLY_ASSETS__
//         (et __BAITLY_TERRAIN__) que le site remplace par ses propres URL (même origine, /maps/).
// Les styles référencent : la source `pmtiles://{baitly}` (déclarée dans la config
// du conteneur), les glyphes `{fontstack}/{range}.pbf` et le sprite du dossier styles/.
import { build } from 'esbuild';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] ?? join(here, '../../scripts/maps/out/render'));
const entry = join(here, '../src/components/map/baitlyMapStyle.ts');
const bundlePath = join(outDir, '.style-bundle.mjs');

await mkdir(join(outDir, 'styles'), { recursive: true });
await mkdir(join(outDir, 'web-styles'), { recursive: true });
await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: bundlePath,
  // Le module web lit sa config à l'exécution (window) : jamais appelée ici.
  define: { 'import.meta.env': '{}' },
  logLevel: 'warning',
});
const { composeBaitlyMapStyle } = await import(pathToFileURL(bundlePath).href);
await rm(bundlePath);

for (const language of ['fr', 'en', 'ar']) {
  const style = composeBaitlyMapStyle(
    'light',
    language,
    {
      tiles: 'pmtiles://{baitly}',
      glyphs: '{fontstack}/{range}.pbf',
      sprite: '{styleJsonFolder}/sprites/light',
      terrain: 'pmtiles://{terrain}',
    },
    { flat: true },
  );
  const file = join(outDir, 'styles', `baitly-paper-${language}.json`);
  await writeFile(file, JSON.stringify(style));
  console.log(`→ ${file} (${style.layers.length} calques)`);
}

for (const [mode, name] of [['light', 'paper'], ['dark', 'night']]) {
  for (const language of ['fr', 'en', 'ar']) {
    const style = composeBaitlyMapStyle(mode, language, {
      tiles: 'pmtiles://__BAITLY_TILES__',
      glyphs: '__BAITLY_ASSETS__/fonts/{fontstack}/{range}.pbf',
      sprite: `__BAITLY_ASSETS__/sprites/baitly/${mode}`,
      terrain: 'pmtiles://__BAITLY_TERRAIN__',
    });
    const file = join(outDir, 'web-styles', `baitly-${name}-${language}.json`);
    await writeFile(file, JSON.stringify(style));
    console.log(`→ ${file}`);
  }
}
