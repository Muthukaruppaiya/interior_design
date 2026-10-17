// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// fbjs uses classic CommonJS relative requires; package-exports resolution
// breaks "./emptyFunction" on web for some Metro/Expo setups.
config.resolver.unstable_enablePackageExports = false;

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  fbjs: path.resolve(__dirname, 'node_modules/fbjs'),
};

module.exports = config;
