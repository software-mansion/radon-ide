// runtime.js is setup to be loaded as one of the first modules. Because of that
// the things ot requires may interfere with other modules that depend on the loading
// order. In order to avoid issues related to that, we only require minimal set of
// dependencies, and we load the main bits of runtime lazyli as a part of wrapper.js
let AppRegistry = require("react-native/Libraries/ReactNative/AppRegistry");
let parseErrorStack = require("react-native/Libraries/Core/Devtools/parseErrorStack");

// since version 0.79 react native changed how imports of some modules work 
// (https://github.com/facebook/react-native/blob/main/CHANGELOG.md#v0790-rc0)
// we handle it mostly by spiting react native internal imports in babel_transformer.js
// but this method works only for lazy imports and we want to require those modules 
// here directly so we check if the module is a default export in runtime here. 
AppRegistry = AppRegistry.default !== undefined ? AppRegistry.default : AppRegistry;
parseErrorStack = parseErrorStack.default !== undefined ? parseErrorStack.default : parseErrorStack; 

// We add log this trace to diagnose issues with loading runtime in the IDE
// The first argument is "__RNIDE_INTERNAL" so we can filter it out in
// debug adapter and avoid exposing as part of application logs
console.log("__RNIDE_INTERNAL", "radon-ide runtime loaded");

function calculateStackOffset(stack, reentryStack) {
  for (let i = 0; i < Math.min(stack.length, reentryStack.length); i++) {
    const diffLine = stack[i].lineNumber !== reentryStack[i].lineNumber;
    const diffColumn = stack[i].column !== reentryStack[i].column;

    if (diffLine || diffColumn) {
      return i;
    }
  }

  return 0;
}

function wrapConsole(logFunctionKey) {
  let currentLogFunc = null;

  const origLogObject = console;
  const origLogFunc = console[logFunctionKey];

  let stackOffset = 1; // default offset is 1, because the first frame is the wrapConsole function

  let logFunctionReentryStack = null;
  let logFunctionReentryFlag = false;

  return function (...args) {
    const stack = parseErrorStack(new Error().stack);

    // To get the proper stack frame, so we can display link to the source code
    // we need to skip wrappers (like wrapConsole below or for example Sentry wrapper)
    // Otherwise, the stack frame would point to the wrapper and not the actual source code
    // To do that, we run console.log again in wrapper, and then compare
    // first frames to find the offset. We do that when ant of console ref changes
    if (logFunctionReentryFlag) {
      logFunctionReentryStack = stack;
      return;
    }

    if (currentLogFunc !== console[logFunctionKey]) {
      // when the console function has changed, we need to update the offset
      logFunctionReentryFlag = true;
      console[logFunctionKey]();
      logFunctionReentryFlag = false;
      stackOffset = calculateStackOffset(stack, logFunctionReentryStack);
      currentLogFunc = console[logFunctionKey];
    }

    const location = stack[stackOffset];
    location && args.push(location.file, location.lineNumber, location.column);
    return origLogFunc.apply(origLogObject, args);
  };
}

console.log = wrapConsole("log");
console.warn = wrapConsole("warn");
console.error = wrapConsole("error");
console.info = wrapConsole("info");

// This variable can be used by external integrations to detect if they are running in the IDE
global.__RNIDE_enabled = true;

global.__RNIDE_register_navigation_plugin = function (name, plugin) {
  require("__RNIDE_lib__/wrapper.js").registerNavigationPlugin(name, plugin);
};

global.__RNIDE_register_dev_plugin = function (name) {
  require("__RNIDE_lib__/wrapper.js").registerDevtoolPlugin(name);
};

AppRegistry.setWrapperComponentProvider((appParameters) => {
  return require("__RNIDE_lib__/wrapper.js").AppWrapper;
});

// Some apps may use AppRegistry.setWrapperComponentProvider to provide a custom wrapper component.
// Apparenlty, this method only supports one provided per app. In order for this to work, we
// overwrite the method to wrap the custom wrapper component with the app wrapper that IDE uses
// from the wrapper.js file.
const origSetWrapperComponentProvider = AppRegistry.setWrapperComponentProvider;
AppRegistry.setWrapperComponentProvider = (provider) => {
  console.info("RNIDE: The app is using a custom wrapper component provider");
  origSetWrapperComponentProvider((appParameters) => {
    const CustomWrapper = provider(appParameters);
    return require("__RNIDE_lib__/wrapper.js").createNestedAppWrapper(CustomWrapper);
  });
};
