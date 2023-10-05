require("expo-router/entry");
const { useContext, useEffect, useRef } = require("react");
const { LogBox, AppRegistry, RootTagContext, View } = require("react-native");
import RCTLog from "react-native/Libraries/Utilities/RCTLog";
const { useRouter } = require("expo-router");

global.rnsz_previews ||= new Map();

// window.__REACT_DEVTOOLS_PORT__
const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

let isLogCatcherInstalled = false;
let originalConsole;
let consoleImpl;
var g_agent;

const isWarningModuleWarning = (...args: Array<mixed>) => {
  return typeof args[0] === 'string' && args[0].startsWith('Warning: ');
};

const registerLog =
  (level) =>
  (...args) => {
    if (level == "error") {
      if (!isWarningModuleWarning(...args)) {
        originalConsole.log("isWarningModuleWarning was false!");
        // Only show LogBox for the 'warning' module, otherwise pass through.
        // By passing through, this will get picked up by the React console override,
        // potentially adding the component stack. React then passes it back to the
        // React Native ExceptionsManager, which reports it to LogBox as an error.
        //
        // The 'warning' module needs to be handled here because React internally calls
        // `console.error('Warning: ')` with the component stack already included.
        originalConsole.error(...args);
        return;
      }
      originalConsole.log("isWarningModuleWarning was true!");
    }


    if (g_agent != null && g_agent._bridge != null) {
      g_agent._bridge.send("rnp_consoleLog", { args });
    } else {
      originalConsole[level](...args);
      if (g_agent == null) {
        originalConsole.log("g_agent was null");
      } else if (g_agent._bridge == null) {
        originalConsole.log("g_agent._bridge was null");
      }
    }
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

    consoleImpl = {
      error: registerLog("error"),
      warn: registerLog("warn"),
      info: registerLog("info"),
      log: registerLog("log"),
    };

    console.error = consoleImpl.error;
    console.warn = consoleImpl.warn;
    console.info = consoleImpl.info;
    console.log = consoleImpl.log;

    RCTLog.setWarningHandler((...args) => {
      consoleImpl.warn(...args);
    });
  },
};

function PreviewAppWrapper({ children, ...rest }) {
  console.log("PreviewAppWrapper");
  const rootTag = useContext(RootTagContext);
  const agentRef = useRef(undefined);
  const appReadyEventSent = useRef(false);
  const { push } = useRouter();

  useEffect(() => {
    function _attachToDevtools(agent) {
      agentRef.current = agent;
      g_agent = agent;
      console.log("agnet set")
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

      LogBox.uninstall();
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
