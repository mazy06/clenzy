import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ResolvedConfig } from 'vite';
import type { SiteLanguage } from '../site/lib/siteLanguage';

export type SiteRenderer = (
  pathname: string,
  language: SiteLanguage,
) => Promise<{ html: string; url: string }>;

/** Compile with Vite so JSX, aliases and asset hashes match the browser build.
 * Runs once at publication time; production still serves plain HTML through nginx.
 */
export async function buildSiteRenderer(config: ResolvedConfig) {
  const [{ build }, { default: react }] = await Promise.all([
    import('vite'),
    import('@vitejs/plugin-react'),
  ]);
  await mkdir(config.cacheDir, { recursive: true });
  const directory = await mkdtemp(join(config.cacheDir, 'render-'));
  try {
    await build({
      configFile: false,
      root: config.root,
      mode: config.mode,
      envDir: config.envDir,
      publicDir: false,
      resolve: { alias: config.resolve.alias, dedupe: ['react', 'react-dom'] },
      define: config.define,
      plugins: [
        react(),
        {
          name: 'baitly-render-metadata',
          resolveId: (id) =>
            id === 'virtual:baitly-site-metadata'
              ? '\0baitly-render-metadata'
              : undefined,
          // Metadata is installed in the document head by the outer publication build.
          load: (id) =>
            id === '\0baitly-render-metadata' ? 'export default {}' : undefined,
        },
      ],
      build: {
        ssr: join(config.root, 'entry-server.tsx'),
        outDir: directory,
        emptyOutDir: true,
        minify: false,
        target: 'node20',
        rollupOptions: {
          output: {
            entryFileNames: 'entry-server.mjs',
            chunkFileNames: 'chunks/[name]-[hash].mjs',
          },
        },
      },
      logLevel: 'warn',
    });
    const { renderSite } = await import(
      pathToFileURL(join(directory, 'entry-server.mjs')).href
    );
    return {
      render: renderSite as SiteRenderer,
      dispose: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
