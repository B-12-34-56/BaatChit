const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add any custom configuration here
module.exports = {
  ...config,
  resolver: {
    ...config.resolver,
    sourceExts: [...config.resolver.sourceExts, 'mjs', 'cjs'],
    unstable_enablePackageExports: false,
    // Exclude react-devtools and other problematic packages in production
    blacklistRE: /.*react-devtools-core.*|.*react-devtools.*/
  },
};