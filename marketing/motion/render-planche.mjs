// Baitly · Export de la planche d'inventaire (inventaire/index.html → inventaire/planche.png).
// Usage : node render-planche.mjs
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1928, height: 1200 }, deviceScaleFactor: 1 });
await page.goto('file://' + join(here, 'inventaire', 'index.html'));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.screenshot({ path: join(here, 'inventaire', 'planche.png'), fullPage: true });
await browser.close();
console.log('Planche : ' + join(here, 'inventaire', 'planche.png'));
