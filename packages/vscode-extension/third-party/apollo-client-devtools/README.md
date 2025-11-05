# Setup / Upgrade process

The process of integrating the extension code into the Radon repository (e.g. in order to update to a newer version) is as follows:

1. clone the [apollographql/apollo-client-devtools](https://github.com/apollographql/apollo-client-devtools) repository locally and follow the instruction to build the scripts.
2. copy the contents of `build` build directory to Radon's `third-party/apollo-client-devtools` directory.
3. create the application plugin by copying the contents of `tab.js` and `hook.js` into `lib/plugins/apollo-client-devtools.js`, between the corresponding `BEGIN`/`END` comment markers (the file is then `require`d by `runtime.js` to activate apollo-client inspection in the app)
4. create the extension module by copying the contents of `service_worker.js` into `src/plugins/apollo-client-plugin/background.bundle.ts` between the corresponding `BEGIN`/`END` markers.
