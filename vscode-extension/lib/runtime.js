require("expo-router/entry");
const { useContext, useEffect, useRef, useSyncExternalStore } = require("react");
const { LogBox, AppRegistry, RootTagContext, View } = require("react-native");
const { useRouter } = require("expo-router");
const { store } = require("expo-router/src/global-state/router-store");

global.__fbDisableExceptionsManager = true;

const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack');
const ErrorUtils = require('react-native/Libraries/vendor/core/ErrorUtils');

global.rnsz_previews ||= new Map();

// window.__REACT_DEVTOOLS_PORT__
const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

let isLogCatcherInstalled = false;
let originalConsole;
var g_agent;
let rnsz_fileRouteMap = {};

const trySend = (...args) => {
  if (g_agent != null && g_agent._bridge != null) {
    g_agent._bridge.send("rnp_consoleLog", ...args);
  } else {
    originalConsole[level](...args);
    if (g_agent == null) {
      originalConsole.log("g_agent was null");
    } else if (g_agent._bridge == null) {
      originalConsole.log("g_agent._bridge was null");
    }
  }
}

const registerLog = (level) => (...args) => { trySend({ mode: 'log', args }); };

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
        trySend({ mode: 'error', args: [e.message, stack, isFatal] });
      } catch (ee) {
        console.log('Failed to print error: ', ee.message);
        throw e;
      }
    };
    ErrorUtils.setGlobalHandler(handleError);
  },
};


function updateUrlInExtension(agent, href) {
  if (!agent) {
    return;
  };

  let url = href['pathname'];
  if (href['params'] && Object.keys(href['params']).length > 0) {
    url += '?' + Object.keys(href['params']).map((key) => {
      const value = href['params'][key];
      return `${key}=${JSON.stringify(value)}`;
    }).join('&');
  }

  agent._bridge.send("rnp_appUrlChanged", { url });
};

function updateFileRouteMap(filename) {
  const snapshot = store.routeInfoSnapshot();

  rnsz_fileRouteMap[filename] = {
    pathname: snapshot.pathname,
    params: Object.assign({}, snapshot.params),
  }
};

function PreviewAppWrapper({ children, ...rest }) {
  console.log("PreviewAppWrapper");
  const rootTag = useContext(RootTagContext);
  const agentRef = useRef(undefined);
  const appReadyEventSent = useRef(false);
  const { push } = useRouter();

  const routeInfo = useSyncExternalStore(
    store.subscribeToRootState,
    store.routeInfoSnapshot,
    store.routeInfoSnapshot,
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
        console.log("ON LAYOUT", !!agentRef.current);
        if (!appReadyEventSent.current && agentRef.current) {
          appReadyEventSent.current = true;
          agentRef.current._bridge.send("rnp_appReady");
        }
      }}>
      {children}
    </View>
  );
}

AppRegistry.setWrapperComponentProvider((appParameters) => {
  console.log("Hey!", appParameters);
  return PreviewAppWrapper;
});
