import { isRunnableDevEnvironment, type ViteDevServer } from 'vite';
import type { SiteRenderer } from './baitlySiteRendering';

/** Recover only failed module transport, never syntax or application errors. */
function isModuleTransportTimeout(error: unknown): boolean {
  return error instanceof Error
    && /^transport invoke timed out after \d+ms \(data: /.test(error.message)
    && error.message.includes('"name":"fetchModule"');
}

/** Vite's public runner supports HMR and lets us discard a cached timeout.
 * Serialize development renders so recovery cannot clear another request's
 * in-flight module evaluation. Production uses the separate build renderer.
 */
export function createDevSiteRenderer(server: ViteDevServer): SiteRenderer {
  const environment = server.environments.ssr;
  if (!isRunnableDevEnvironment(environment)) {
    throw new Error('Baitly site rendering requires a runnable SSR environment');
  }
  let pending: Promise<unknown> = Promise.resolve();
  const render: SiteRenderer = async (pathname, language) => {
    const { renderSite } = await environment.runner.import<{ renderSite: SiteRenderer }>(
      '/entry-server.tsx',
    );
    return renderSite(pathname, language);
  };
  return (pathname, language) => {
    const request = pending.then(async () => {
      try {
        return await render(pathname, language);
      } catch (error) {
        if (!isModuleTransportTimeout(error)) throw error;
        server.config.logger.warn(
          '[Baitly] SSR module transport timed out; clearing its cache and retrying once.',
        );
        environment.moduleGraph.invalidateAll();
        environment.runner.clearCache();
        return render(pathname, language);
      }
    });
    // A rejected request must not prevent later requests from rendering.
    pending = request.catch(() => undefined);
    return request;
  };
}
