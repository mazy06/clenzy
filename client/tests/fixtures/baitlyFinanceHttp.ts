import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export interface FinanceRequest { method: string; path: string; body: string }
type Handler = (request: FinanceRequest, response: ServerResponse) => void | Promise<void>;

/** API de contrat éphémère réservée aux tests : vrais fetch/JSON/erreurs HTTP, aucun accès à Baitly ou Stripe. */
export function financeHttp() {
  const requests: FinanceRequest[] = [];
  const unexpected: string[] = [];
  let handler: Handler = () => { throw new Error('Route non configurée'); };
  const server = createServer(async (incoming: IncomingMessage, response) => {
    let body = '';
    for await (const chunk of incoming) body += chunk.toString();
    const request = { method: incoming.method || 'GET', path: incoming.url || '/', body };
    requests.push(request);
    try { await handler(request, response); }
    catch (error) {
      unexpected.push(`${request.method} ${request.path}: ${String(error)}`);
      json(response, { message: 'Route inattendue dans la recette Baitly' }, 500);
    }
  });
  return {
    requests, unexpected,
    async start() {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Serveur de contrat indisponible');
      return `http://127.0.0.1:${address.port}`;
    },
    route(next: Handler) { handler = next; requests.length = 0; unexpected.length = 0; },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
export function json(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}
