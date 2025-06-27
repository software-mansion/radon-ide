// This implementation is only used when bundling the code for Radon Connect runtime.
// When Radon controls the metro, it replaces imports of this file with imports to
// React-Native specific version of it.

function metroImportDefault(...moduleIds) {
  // TODO: we should use globalThis.__r.getModules().values() to process and find module we want
  for (const moduleId of moduleIds) {
    try {
      return globalThis.__r.importDefault(moduleId);
    } catch (e) {}
  }
  throw new Error(`Failed to import any of the following modules: ${moduleIds.join(", ")}`);
}

module.exports = {
  XHRInterceptor: metroImportDefault(
    "node_modules/react-native/Libraries/Network/XHRInterceptor.js",
    "../node_modules/react-native/Libraries/Network/XHRInterceptor.js",
    "node_modules/react-native/src/private/inspector/XHRInterceptor.js",
    "../node_modules/react-native/src/private/inspector/XHRInterceptor.js"
  ),
};
