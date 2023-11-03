require("expo-router/entry");
const { useContext, useEffect, useRef, useSyncExternalStore } = require("react");
const { LogBox, AppRegistry, RootTagContext, View, Platform } = require("react-native");
const SceneTracker = require("react-native/Libraries/Utilities/SceneTracker");
const ReactNativeFeatureFlags = require("react-native/Libraries/ReactNative/ReactNativeFeatureFlags");
const parseErrorStack = require("react-native/Libraries/Core/Devtools/parseErrorStack");
const { useRouter } = require("expo-router");
const { store } = require("expo-router/src/global-state/router-store");

global.__fbDisableExceptionsManager = true;

global.rnsz_previews ||= new Map();

const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

// There is a bug in React Native's DevtoolsOverlay where the code treats shouldEmitW3CPointerEvents as a boolean
// instead of a function returning a boolean. As a result, it thinks the flag is enabled while in our case
// we don't need it enabled. Without this code inspector feature would not work.
const RNVersion = Platform.constants.reactNativeVersion;
if (
  RNVersion.major === 0 &&
  RNVersion.minor <= 71 &&
  typeof ReactNativeFeatureFlags.shouldEmitW3CPointerEvents === "function"
) {
  ReactNativeFeatureFlags.shouldEmitW3CPointerEvents = false;
}

function wrapConsole(consoleFunc) {
  return function (...args) {
    const location = parseErrorStack(new Error().stack)[1];
    args.push(location.file, location.lineNumber, location.column);
    return consoleFunc.apply(console, args);
  };
}
console.log = wrapConsole(console.log);
console.warn = wrapConsole(console.warn);
console.error = wrapConsole(console.error);
console.info = wrapConsole(console.info);

let agent;
let fileRouteMap = {};
let activeEditorFile = undefined;

function updateRouteMap() {
  const snapshot = store.routeInfoSnapshot();

  if (activeEditorFile) {
    fileRouteMap[activeEditorFile] = {
      pathname: snapshot.pathname,
      params: Object.assign({}, snapshot.params),
    };
  }
}

function handleRouteChange(pathname, params) {
  updateRouteMap();

  let url = pathname;
  if (params && Object.keys(params).length > 0) {
    url +=
      "?" +
      Object.keys(params)
        .map((key) => {
          const value = params[key];
          return `${key}=${JSON.stringify(value)}`;
        })
        .join("&");
  }

  agent && agent._bridge.send("rnp_appUrlChanged", { url });
}

function inferRouteForFile(filename) {
  return fileRouteMap[filename];
}

function handleActiveFileChange(filename, follow) {
  activeEditorFile = filename;
  if (follow) {
    const route = inferRouteForFile(filename);
    if (route) {
      return route;
    }
  }
  updateRouteMap();
}

function PreviewAppWrapper({ children, ...rest }) {
  const rootTag = useContext(RootTagContext);
  const appReadyEventSent = useRef(false);
  const { push } = useRouter();

  const routeInfo = useSyncExternalStore(
    store.subscribeToRootState,
    store.routeInfoSnapshot,
    store.routeInfoSnapshot
  );

  const pathname = routeInfo?.pathname;
  const params = routeInfo?.params;

  useEffect(() => {
    handleRouteChange(pathname, params);
  }, [pathname, params]);

  useEffect(() => {
    function _attachToDevtools(agent_) {
      agent = agent_;
      agent._bridge.addListener("rnp_openRouterLink", (payload) => {
        push(payload.href);
      });
      agent._bridge.addListener("rnp_listPreviews", () => {
        agent._bridge.send("rnp_previewsList", {
          previews: [...global.rnsz_previews.values()],
        });
      });
      agent._bridge.addListener("rnp_runApplication", (payload) => {
        AppRegistry.runApplication(payload.appKey, {
          rootTag,
          initialProps: {},
        });
      });

      agent._bridge.addListener("rnp_editorFileChanged", (payload) => {
        const newRoute = handleActiveFileChange(payload.filename, payload.followEnabled);
        newRoute && push(newRoute);
      });

      LogBox.uninstall();
      // console.reportErrorsAsExceptions = false;
    }

    if (hook.reactDevtoolsAgent) {
      _attachToDevtools(hook.reactDevtoolsAgent);
    } else {
      hook.on("react-devtools", _attachToDevtools);
    }
  }, []);

  return (
    <View
      style={{ flex: 1 }}
      onLayout={() => {
        if (!appReadyEventSent.current && agent) {
          appReadyEventSent.current = true;
          agent._bridge.send("rnp_appReady", {
            appKey: SceneTracker.getActiveScene().name,
          });
        }
      }}>
      {children}
    </View>
  );
}

AppRegistry.setWrapperComponentProvider((appParameters) => {
  return PreviewAppWrapper;
});
