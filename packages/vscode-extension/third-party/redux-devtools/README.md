# Setup / Upgrade process

The process of integrating the extension code into the Radon repository (e.g. in order to update to a newer version) is as follows:

1. clone the [reduxjs/redux-devtools](https://github.com/reduxjs/redux-devtools) repository locally and follow the instruction to build the scripts.
2. copy the contents of `extension/dist` build directory to Radon's `third-party/redux-devtools` directory.
3. create the application plugin by copying the contents of `page.bundle.js` and `content.bundle.js` into `lib/plugins/redux-devtools.js`, between the corresponding `BEGIN`/`END` comment markers (the `redux-devtools` file is then `require`d by `runtime.js` to activate Redux inspection in the app)
4. create the extension module by concatenating `src/plugins/chrome-api-stub.extension.ts` with `background.bundle.js` and putting the resulting file into `src/plugins/redux-devtools-plugin/background.bundle.ts`:

```sh
cat 'src/plugins/chrome-api-stub.extension.ts' 'third-party/redux-devtools/background.bundle.js' > 'src/plugins/redux-devtools-plugin/background.bundle.ts'
```

5. add `// @ts-nocheck` at the top of `background.bundle.ts` to make typecheck ignore the file
