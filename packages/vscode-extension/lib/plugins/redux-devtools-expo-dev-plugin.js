// override the expo-devtools inspection with the one injected by Radon, provided by the redux-devtools extension
export let composeWithDevtools = globalThis.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
let devtoolsEnhancer = globalThis.__REDUX_DEVTOOLS_EXTENSION__;
export default devtoolsEnhancer;
