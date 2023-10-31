require("expo-router/entry");
const { useContext, useEffect, useRef, useSyncExternalStore } = require("react");
const { LogBox, AppRegistry, RootTagContext, View } = require("react-native");
const SceneTracker = require("react-native/Libraries/Utilities/SceneTracker");
const { useRouter } = require("expo-router");
const { store } = require("expo-router/src/global-state/router-store");

global.__fbDisableExceptionsManager = true;

global.rnsz_previews ||= new Map();

const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

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
  console.log("REDNER");
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
