const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Force Metro to resolve the CJS (CommonJS) builds of zustand
// instead of the ESM builds that contain `import.meta` syntax.
// This fixes "Uncaught SyntaxError: Cannot use 'import.meta' outside a module"
// when running Expo Web with Metro bundler.
config.resolver.unstable_conditionNames = [
  "react-native",
  "require",
  "default",
];

// Prefer .js (CJS) over .mjs (ESM) to avoid import.meta issues
config.resolver.sourceExts = config.resolver.sourceExts.filter(
  (ext) => ext !== "mjs"
);

module.exports = config;
