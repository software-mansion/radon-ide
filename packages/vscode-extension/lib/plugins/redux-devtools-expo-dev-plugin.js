// override the expo-devtools inspection with the one injected by Radon, provided by the redux-devtools extension
require("__RNIDE_lib__/plugins/redux-devtools");
export let composeWithDevTools = globalThis.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
let devtoolsEnhancer = globalThis.__REDUX_DEVTOOLS_EXTENSION__;
export default devtoolsEnhancer;
