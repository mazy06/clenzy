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

module.exports = config;
