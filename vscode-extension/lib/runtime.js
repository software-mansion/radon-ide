require("expo-router/entry");
const { useContext, useEffect, useRef, useSyncExternalStore } = require("react");
const { LogBox, AppRegistry, RootTagContext, View } = require("react-native");
const SceneTracker = require("react-native/Libraries/Utilities/SceneTracker");
const { useRouter } = require("expo-router");
const { store } = require("expo-router/src/global-state/router-store");

global.__fbDisableExceptionsManager = true;

const parseErrorStack = require("react-native/Libraries/Core/Devtools/parseErrorStack");
const ErrorUtils = require("react-native/Libraries/vendor/core/ErrorUtils");

global.rnsz_previews ||= new Map();

// window.__REACT_DEVTOOLS_PORT__
const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

let isLogCatcherInstalled = false;
let originalConsole;
var g_agent;
let rnsz_fileRouteMap = {};

const trySend = (type, args, stack) => {
  if (!stack) {
    const error = new Error();
    // take off the top two lines of the stack, which just point to this file
    stack = parseErrorStack(error.stack).slice(2);
  }
  if (g_agent != null && g_agent._bridge != null) {
    g_agent._bridge.send("rnp_consoleLog", { type, args, stack });
  } else {
    originalConsole[type](...args);
    if (g_agent == null) {
      originalConsole.log("g_agent was null");
    } else if (g_agent._bridge == null) {
      originalConsole.log("g_agent._bridge was null");
    }
  }
};

const registerLog =
  (level) =>
  (...args) => {
    trySend(level, args);
  };

const LogCatcher = {
  install() {
    if (isLogCatcherInstalled) {
      return;
    }

    isLogCatcherInstalled = true;

    originalConsole = {
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      log: console.log.bind(console),
    };

    console.error = registerLog("error");
    console.warn = registerLog("warn");
    console.info = registerLog("info");
    console.log = registerLog("log");

    const handleError = (e, isFatal) => {
      try {
        const stack = parseErrorStack(e?.stack);
        trySend(isFatal ? "fatalException" : "uncaughtException", e.message, stack);
      } catch (ee) {
        console.log("Failed to print error: ", ee.message);
        throw e;
      }
    };
    ErrorUtils.setGlobalHandler(handleError);
  },
};

function updateUrlInExtension(agent, href) {
  if (!agent) {
    return;
  }

  let url = href["pathname"];
  if (href["params"] && Object.keys(href["params"]).length > 0) {
    url +=
      "?" +
      Object.keys(href["params"])
        .map((key) => {
          const value = href["params"][key];
          return `${key}=${JSON.stringify(value)}`;
        })
        .join("&");
  }

  agent._bridge.send("rnp_appUrlChanged", { url });
}

function updateFileRouteMap(filename) {
  const snapshot = store.routeInfoSnapshot();

  rnsz_fileRouteMap[filename] = {
    pathname: snapshot.pathname,
    params: Object.assign({}, snapshot.params),
  };
}

function PreviewAppWrapper({ children, ...rest }) {
  const rootTag = useContext(RootTagContext);
  const agentRef = useRef(undefined);
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
    updateUrlInExtension(agentRef.current, { pathname, params });
  }, [pathname, params]);

  useEffect(() => {
    function _attachToDevtools(agent) {
      agentRef.current = agent;
      g_agent = agent;
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
        if (payload.followEnabled) {
          const lastRouteForEditorFile = rnsz_fileRouteMap[payload.filename];
          if (lastRouteForEditorFile != null) {
            push(lastRouteForEditorFile);
          }
        } else {
          updateFileRouteMap(payload.filename);
        }
      });

      LogBox.uninstall();
      console.reportErrorsAsExceptions = false;
      LogCatcher.install();
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
        if (!appReadyEventSent.current && agentRef.current) {
          appReadyEventSent.current = true;
          agentRef.current._bridge.send("rnp_appReady", {
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
