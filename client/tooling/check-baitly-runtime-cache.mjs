import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Inspect the generated worker, not a source-code snapshot of the Vite options.
const directory = process.argv[2] ?? 'dist';
const html = readFileSync(join(directory, 'index.html'), 'utf8');
const runtime = html.match(/<script src="(\/baitly-config\.js\?v=[a-zA-Z0-9._-]+)"/);
assert(runtime, 'Runtime configuration needs a resolved deployment version');
assert(!runtime[0].includes('%'), 'Vite must resolve the version placeholder');
let checked = 0;
for (const file of readdirSync(directory).filter(name => /^sw-.*\.js$/.test(name))) {
  const source = ts.createSourceFile(file, readFileSync(join(directory, file), 'utf8'), ts.ScriptTarget.Latest, true);
  let precacheFound = false;
  let networkOnlyFound = false;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      if (node.expression.name.text === 'precacheAndRoute') {
        precacheFound = true;
        assert(ts.isArrayLiteralExpression(node.arguments[0]));
        for (const entry of node.arguments[0].elements) {
          if (!ts.isObjectLiteralExpression(entry)) continue;
          const url = entry.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(source).replaceAll('"', '').replaceAll("'", '') === 'url');
          if (url && ts.isStringLiteral(url.initializer)) {
            assert(!url.initializer.text.split('?')[0].endsWith('baitly-config.js'), 'Runtime configuration must never be precached');
          }
        }
      }
      const handler = node.arguments[1];
      if (node.expression.name.text === 'registerRoute' && handler && ts.isNewExpression(handler)
        && ts.isPropertyAccessExpression(handler.expression) && handler.expression.name.text === 'NetworkOnly') {
        const pattern = vm.runInNewContext('(' + node.arguments[0].getText(source) + ')', {});
        if (pattern({ url: new URL('https://staging.invalid/baitly-config.js') })) {
          assert(pattern({ url: new URL('https://staging.invalid/baitly-config.js?v=another-release') }));
          assert(!pattern({ url: new URL('https://staging.invalid/api/preferences') }));
          networkOnlyFound = true;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert(precacheFound, 'Generated precache manifest not found');
  assert(networkOnlyFound, 'Runtime configuration needs a generated NetworkOnly route');
  checked++;
}
assert(checked > 0, 'Generated service worker not found');
console.log('Baitly runtime cache policy verified against generated HTML and service worker');
