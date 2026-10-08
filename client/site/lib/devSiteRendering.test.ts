// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger, createServer, type ViteDevServer } from 'vite';
import { createDevSiteRenderer } from '../../tooling/baitlySiteDevRendering';

const transportTimeout = 'transport invoke timed out after 60000ms (data: {"type":"custom","event":"vite:invoke","data":{"name":"fetchModule","data":["/data/legal/morocco.ts"]}})';
let server: ViteDevServer | undefined;
let root: string | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
  if (root) await rm(root, { recursive: true, force: true });
  root = undefined;
});

/** Real Vite transforms, transport, module evaluation and caches; no HTTP listener. */
async function fixture(failures: number, error = transportTimeout, lazy = false) {
  root = await mkdtemp(join(tmpdir(), 'baitly-ssr-recovery-'));
  const logger = createLogger('silent');
  const warning = vi.spyOn(logger, 'warn');
  const state = { failures, loads: 0 };
  server = await createServer({
    configFile: false,
    root,
    publicDir: false,
    customLogger: logger,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{
      name: 'baitly-ssr-recovery-fixture',
      resolveId(id) {
        if (id === '/entry-server.tsx') return '\0baitly-test-entry';
        if (id === 'baitly-test-country') return '\0baitly-test-country';
      },
      load(id) {
        if (id === '\0baitly-test-entry') return `
          ${lazy ? '' : 'import { country } from "baitly-test-country";'}
          export async function renderSite(path, language) {
            ${lazy ? 'const { country } = await import("baitly-test-country");' : ''}
            if (path === '/broken') throw new Error('Invalid page content');
            return { html: '<h1>' + country + ':' + language + '</h1>', url: path + '?lang=' + language };
          }
        `;
        if (id === '\0baitly-test-country') {
          state.loads++;
          if (state.failures-- > 0) throw new Error(error);
          return 'export const country = "Maroc";';
        }
      },
    }],
  });
  return { render: createDevSiteRenderer(server), state, warning };
}

describe('Baitly development SSR recovery', () => {
  it('recovers a cached module transport failure once and returns complete HTML', async () => {
    const { render, state, warning } = await fixture(1);
    await expect(render('/produit/objets-connectes', 'fr')).resolves.toEqual({
      html: '<h1>Maroc:fr</h1>', url: '/produit/objets-connectes?lang=fr',
    });
    expect(state.loads).toBe(2);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('also recovers a timeout while loading a lazy route during rendering', async () => {
    const { render, state } = await fixture(1, transportTimeout, true);
    await expect(render('/ressources/obligations/maroc', 'ar')).resolves.toMatchObject({ html: '<h1>Maroc:ar</h1>' });
    expect(state.loads).toBe(2);
  });

  it('keeps concurrent requests independent without racing cache recovery', async () => {
    const { render, state, warning } = await fixture(1);
    const pages = await Promise.all([render('/first', 'fr'), render('/second', 'ar')]);
    expect(pages).toEqual([
      { html: '<h1>Maroc:fr</h1>', url: '/first?lang=fr' },
      { html: '<h1>Maroc:ar</h1>', url: '/second?lang=ar' },
    ]);
    expect(state.loads).toBe(2);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('propagates a persistent timeout after one retry and can recover on a later request', async () => {
    const { render, state, warning } = await fixture(2);
    await expect(render('/first', 'fr')).rejects.toThrow('transport invoke timed out');
    expect(state.loads).toBe(2);
    expect(warning).toHaveBeenCalledTimes(1);
    await expect(render('/second', 'en')).resolves.toMatchObject({ html: '<h1>Maroc:en</h1>' });
    expect(state.loads).toBe(3);
  });

  it('does not retry or hide module code errors', async () => {
    const { render, state, warning } = await fixture(1, 'Unexpected token in legal module');
    await expect(render('/first', 'fr')).rejects.toThrow('Unexpected token in legal module');
    expect(state.loads).toBe(1);
    expect(warning).not.toHaveBeenCalled();
  });

  it('does not poison the request queue after an application error', async () => {
    const { render, state, warning } = await fixture(0);
    await expect(render('/broken', 'fr')).rejects.toThrow('Invalid page content');
    await expect(render('/working', 'fr')).resolves.toMatchObject({ html: '<h1>Maroc:fr</h1>' });
    expect(state.loads).toBe(1);
    expect(warning).not.toHaveBeenCalled();
  });
});
