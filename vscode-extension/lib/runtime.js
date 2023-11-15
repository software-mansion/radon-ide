require("expo-router/entry");
const { useContext, useEffect, useRef, useSyncExternalStore } = require("react");
const { LogBox, AppRegistry, RootTagContext, View, Platform, Dimensions } = require("react-native");
const SceneTracker = require("react-native/Libraries/Utilities/SceneTracker");
const ReactNativeFeatureFlags = require("react-native/Libraries/ReactNative/ReactNativeFeatureFlags");
const parseErrorStack = require("react-native/Libraries/Core/Devtools/parseErrorStack");
const getInspectorDataForViewAtPoint = require("react-native/Libraries/Inspector/getInspectorDataForViewAtPoint");
const { useRouter } = require("expo-router");
const { store } = require("expo-router/src/global-state/router-store");

function sztudioBreakOnError(error, isFatal) {
  // the below variables are accessed from the debugger and hence are necessary despite being unused in the code
  const message = error.message;
  const stack = parseErrorStack(error.stack);
  debugger;
}

global.ErrorUtils.setGlobalHandler(sztudioBreakOnError);

global.__fbDisableExceptionsManager = true;

global.rnsz_previews ||= new Map();

const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

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
  // if (params && Object.keys(params).length > 0) {
  //   url +=
  //     "?" +
  //     Object.keys(params)
  //       .map((key) => {
  //         const value = params[key];
  //         return `${key}=${JSON.stringify(value)}`;
  //       })
  //       .join("&");
  // }
  agent && agent._bridge.send("rnp_appUrlChanged", { url });
}

function inferRouteForFile(filename) {
  return fileRouteMap[filename];
}

function isPreviewUrl(url) {
  return url.startsWith("preview://");
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
  const mainContainerRef = useRef();
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
      agent._bridge.addListener("rnp_listPreviews", () => {
        agent._bridge.send("rnp_previewsList", {
          previews: [...global.rnsz_previews.values()],
        });
      });
      agent._bridge.addListener("rnp_runApplication", (payload) => {
        const wantPreview = isPreviewUrl(payload.appKey);

        if (wantPreview) {
          AppRegistry.runApplication(payload.appKey, {
            rootTag,
            initialProps: {},
          });
          return;
        }

        const isRunningPreview = isPreviewUrl(SceneTracker.getActiveScene().name);
        if (isRunningPreview) {
          AppRegistry.runApplication("main", {
            rootTag,
            initialProps: {},
          });
          push(payload.appKey);
        } else {
          push(payload.appKey);
        }
      });

      agent._bridge.addListener("rnp_inspect", (payload) => {
        const { width, height } = Dimensions.get("window");
        getInspectorDataForViewAtPoint(
          mainContainerRef.current,
          payload.x * width,
          payload.y * height,
          (viewData) => {
            const frame = viewData.frame;
            const scaledFrame = {
              x: frame.left / width,
              y: frame.top / height,
              width: frame.width / width,
              height: frame.height / height,
            };
            const hierarchy = viewData.hierarchy.map((item) => {
              return { name: item.name, source: item.getInspectorData().source };
            });
            agent._bridge.send("rnp_inspectData", {
              id: payload.id,
              frame: scaledFrame,
              hierarchy,
            });
          }
        );
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
      ref={mainContainerRef}
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
