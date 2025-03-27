## How to support a new version:

To support a new version of React Native just add a new file in this directory named `rn-internals-{major}.{minor}.js`
and add any imports you need for that version.

## Note:

runtime.js is setup to be loaded as one of the first modules. Because of that
the things ot requires may interfere with other modules that depend on the loading
order. In order to avoid issues related to that, we only require minimal set of
dependencies, and we load the main bits lazyli