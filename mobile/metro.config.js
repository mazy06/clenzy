const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared package in the monorepo
config.watchFolders = [path.resolve(workspaceRoot, 'shared')];

// Resolve modules from both mobile/node_modules and root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Ensure shared/ TypeScript files are resolved
config.resolver.disableHierarchicalLookup = false;

// Baitly : une seule copie JS doit correspondre au WebView compile par iOS.
// Les bibliotheques hoistees (signature canvas) trouveraient sinon une seconde
// copie a la racine, qui enregistre a nouveau la vue native RNCWebView.
const webViewRoot = path.dirname(
  require.resolve('react-native-webview/package.json', { paths: [projectRoot] }),
);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-webview' || moduleName.startsWith('react-native-webview/')) {
    const suffix = moduleName.slice('react-native-webview'.length);
    return context.resolveRequest(context, webViewRoot + suffix, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
