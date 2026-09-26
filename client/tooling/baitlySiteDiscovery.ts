import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { Plugin } from 'vite';
import { LEGAL_SLUGS } from '../src/modules/legal/corpus/types';
import { DISCOVERY_LANGUAGES, PRIVATE_SITE_PATHS, siteDocuments } from './baitlySiteContent';
import type { DiscoveryCatalog } from './baitlySiteContent';

const CANONICAL_ORIGIN = 'https://baitly.fr';
const discoveryLink = '</llms.txt>; rel="describedby"; type="text/plain"';
const xmlEscape = (text: string) => text.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
const nginxString = (text: string) => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, '\\n')}"`;

/** New routes must be classified; unknown dynamic routes fail the publication build. */
export function publicPaths(source: string, modules: string[]): string[] {
  const paths: string[] = [];
  const file = ts.createSourceFile('main.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node: ts.Node) => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(file) === 'Route') {
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      if (attributes.some((attr) => attr.name.getText(file) === 'index')) paths.push('/');
      const path = attributes.find((attr) => attr.name.getText(file) === 'path');
      if (path) {
        if (!path.initializer || !ts.isStringLiteral(path.initializer)) throw new Error('Discovery requires literal route paths');
        const value = path.initializer.text;
        if (value === '/produit/:slug') paths.push(...modules.map((slug) => `/produit/${slug}`));
        else if (value === '/legal/:slug') paths.push(...LEGAL_SLUGS.map((slug) => `/legal/${slug}`));
        else if (value !== '*' && !PRIVATE_SITE_PATHS.includes(value)) {
          if (!/^\/[a-z0-9/-]*$/.test(value)) throw new Error(`Classify public route before publishing: ${value}`);
          paths.push(value);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return [...new Set(paths)];
}

/** Read catalog identifiers without loading browser components or image imports. */
export function discoveryCatalog(source: string): DiscoveryCatalog {
  const file = ts.createSourceFile('catalog.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const arrays = new Map<string, ts.ArrayLiteralExpression>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      arrays.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  const keys = (name: string, key: string) => {
    const array = arrays.get(name);
    if (!array) throw new Error(`Missing catalog array: ${name}`);
    return array.elements.map((element) => {
      if (ts.isObjectLiteralExpression(element)) {
        const property = element.properties.find((item) => ts.isPropertyAssignment(item) && item.name.getText(file) === key);
        if (property && ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer) && /^[a-z0-9-]+$/.test(property.initializer.text)) return property.initializer.text;
      }
      throw new Error(`Discovery requires literal ${key} values in ${name}`);
    });
  };
  return { modules: keys('MODULES', 'slug'), solutions: keys('SOLUTIONS', 'slug'), resources: keys('RESOURCES', 'id') };
}

export function discoveryArtifacts(routeSource: string, robotsSource: string, catalogSource: string) {
  const catalog = discoveryCatalog(catalogSource);
  const paths = publicPaths(routeSource, catalog.modules);
  if (!paths.includes('/')) throw new Error('Homepage missing from discovery routes');
  const assets = new Map<string, string>();
  const configs = new Map<string, string>();
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>${xmlEscape(CANONICAL_ORIGIN + path)}</loc></url>`).join('\n')}\n</urlset>\n`;
  const robots = `${robotsSource.trim()}\n\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`;
  assets.set('sitemap.xml', sitemap);
  assets.set('robots.txt', robots);
  for (const language of DISCOVERY_LANGUAGES) {
    const documents = siteDocuments(language, catalog);
    for (const path of paths) {
      const markdown = documents.get(path);
      if (!markdown) throw new Error(`Missing Markdown representation: ${language} ${path}`);
      assets.set(`_baitly-markdown/${language}${path === '/' ? '/index' : path}.md`, markdown);
    }
  }
  const frenchDocuments = siteDocuments('fr', catalog);
  assets.set('llms.txt', `# Baitly\n\n> ${frenchDocuments.get('/')!.split('\n\n')[2]}\n\n## Public pages\n\n${paths.map((path) => `- [${frenchDocuments.get(path)!.split('\n')[0].slice(2)}](${path})`).join('\n')}\n\n## Reading these pages\n\nRequest a listed page with Accept: text/markdown. Use ?lang=fr, ?lang=en or ?lang=ar; French is the default Markdown language. Legal documents are translated; the French version is the reference. HTML remains the browser default.\n\n- [Sitemap](/sitemap.xml)\n- [Crawl rules](/robots.txt)\n`);
  // No request header is interpolated into XML without a DNS-name allowlist.
  // The public HTTPS origin follows the reverse proxy's Host, so one image
  // continues to serve separate Baitly deployments without cross-domain URLs.
  configs.set('discovery-http.conf', `map $host $baitly_discovery_origin {
  default ${CANONICAL_ORIGIN};
  ~^[a-z0-9][a-z0-9.-]*[a-z0-9]$ https://$host;
}
map $http_accept $baitly_accept_markdown {
  default 0;
  "~*(^|,)\\s*text/markdown\\s*(?![^,]*;\\s*q\\s*=\\s*0(?:\\.0*)?\\s*(?:;|,|$))(?:;[^,]*)?(?:,|$)" 1;
}
map $arg_lang $baitly_markdown_language {
  default fr;
  en en;
  ar ar;
}
map $uri $baitly_markdown_content_language {
  default $baitly_markdown_language;
}
`);
  // nginx return bodies are small discovery documents, never page content.
  const returnBody = (body: string) => nginxString(body).replaceAll(CANONICAL_ORIGIN, '$baitly_discovery_origin');
  configs.set('discovery-robots.conf', `return 200 ${returnBody(robots)};\n`);
  configs.set('discovery-sitemap.conf', `return 200 ${returnBody(sitemap)};\n`);
  const pageLocations = [...paths, ...PRIVATE_SITE_PATHS].map((path) => {
    const file = path === '/' ? '/index' : path;
    const markdownLocation = PRIVATE_SITE_PATHS.includes(path) ? '' : `
  add_header Vary "Accept" always;
  add_header Link ${nginxString(discoveryLink)} always;
  if ($baitly_accept_markdown) {
    rewrite ^ /_baitly-markdown/$baitly_markdown_language${file}.md last;
  }`;
    return `location = ${path} {
  add_header Cache-Control "no-cache, no-store, must-revalidate" always;${markdownLocation}
  try_files /_baitly-html/$baitly_markdown_language${file}.html =404;
}`;
  }).join('\n');
  configs.set('discovery-fallback.conf', 'return 404;\n');
  configs.set('discovery-server.conf', `error_page 404 /_baitly-html/$baitly_markdown_language/404.html;
${pageLocations}
location ^~ /_baitly-html/ {
  internal;
  add_header Cache-Control "no-cache, no-store, must-revalidate" always;
  try_files $uri =404;
}
location = /llms.txt {
  default_type text/plain;
  charset utf-8;
  add_header Cache-Control "public, max-age=3600";
  try_files $uri =404;
}
location ^~ /_baitly-markdown/ {
  internal;
  types { }
  default_type text/markdown;
  charset utf-8;
  charset_types text/markdown;
  add_header Cache-Control "no-cache, no-store, must-revalidate" always;
  add_header Vary "Accept" always;
  add_header Content-Language $baitly_markdown_content_language;
  add_header Link ${nginxString(discoveryLink)} always;
  try_files $uri =404;
}
`);
  return { assets, configs, paths };
}

export function baitlySiteDiscovery(): Plugin {
  let artifacts: ReturnType<typeof discoveryArtifacts>;
  const root = fileURLToPath(new URL('../', import.meta.url));
  return {
    name: 'baitly-site-discovery',
    apply: 'build',
    async generateBundle() {
      artifacts = discoveryArtifacts(
        await readFile(`${root}/site/main.tsx`, 'utf8'),
        await readFile(`${root}/site/public/robots.txt`, 'utf8'),
        await readFile(`${root}/site/data/catalog.tsx`, 'utf8'));
      for (const [fileName, source] of artifacts.assets) this.emitFile({ type: 'asset', fileName, source });
    },
    async writeBundle() {
      const directory = `${root}/site-discovery-nginx`;
      await mkdir(directory, { recursive: true });
      await Promise.all([...artifacts.configs].map(([name, content]) => writeFile(`${directory}/${name}`, content)));
    },
  };
}
