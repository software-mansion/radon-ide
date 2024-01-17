const { useContext, useEffect, useRef, useCallback } = require("react");
const { LogBox, AppRegistry, RootTagContext, View, Dimensions, Linking } = require("react-native");
const SceneTracker = require("react-native/Libraries/Utilities/SceneTracker");
const getInspectorDataForViewAtPoint = require("react-native/Libraries/Inspector/getInspectorDataForViewAtPoint");

const navigationPlugins = [];
export function registerNavigationPlugin(name, plugin) {
  navigationPlugins.push({ name, plugin });
}

let agent;
let fileRouteMap = new Map();
let activeEditorFile = undefined;
let navigationHistory = new Map();

function isPreviewUrl(url) {
  return url.startsWith("preview://");
}

function emptyNavigationHook() {
  return {
    getCurrentNavigationDescriptor: () => undefined,
    requestNavigationChange: () => {},
  };
}

export function PreviewAppWrapper({ children, ...rest }) {
  const rootTag = useContext(RootTagContext);
  const appReadyEventSent = useRef(false);
  const mainContainerRef = useRef();

  const handleNavigationChange = useCallback((navigationDescriptor) => {
    if (activeEditorFile) {
      fileRouteMap.set(activeEditorFile, navigationDescriptor);
    }
    navigationHistory.set(navigationDescriptor.id, navigationDescriptor);
    agent &&
      agent._bridge.send("rnp_navigationChanged", {
        displayName: navigationDescriptor.name,
        id: navigationDescriptor.id,
      });
  }, []);

  const useNavigationMainHook =
    (navigationPlugins.length && navigationPlugins[0].plugin.mainHook) || emptyNavigationHook;
  const { getCurrentNavigationDescriptor, requestNavigationChange } = useNavigationMainHook({
    onNavigationChange: handleNavigationChange,
  });

  const handleActiveFileChange = useCallback(
    (filename, follow) => {
      activeEditorFile = filename;
      if (follow) {
        const route = fileRouteMap[filename];
        if (route) {
          return route;
        }
      }
      fileRouteMap[activeEditorFile] = getCurrentNavigationDescriptor();
    },
    [getCurrentNavigationDescriptor]
  );

  useEffect(() => {
    function _attachToDevtools(agent_) {
      agent = agent_;

      function openPreview(previewKey) {
        AppRegistry.runApplication(previewKey, {
          rootTag,
          initialProps: {},
        });
      }

      agent._bridge.addListener("rnp_openPreview", (payload) => {
        openPreview(payload.previewId);
      });

      function closePreview() {
        const isRunningPreview = isPreviewUrl(SceneTracker.getActiveScene().name);
        if (isRunningPreview) {
          AppRegistry.runApplication("main", {
            rootTag,
            initialProps: {},
          });
        }
      }

      agent._bridge.addListener("rnp_openUrl", (payload) => {
        closePreview();
        const url = payload.url;
        Linking.openURL(url);
      });
      agent._bridge.addListener("rnp_openNavigation", (payload) => {
        if (isPreviewUrl(payload.id)) {
          openPreview(payload.id);
          return;
        }
        closePreview();
        const navigationDescriptor = navigationHistory.get(payload.id);
        navigationDescriptor && requestNavigationChange(navigationDescriptor);
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

    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
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
        const sceneName = SceneTracker.getActiveScene().name;
        if (!appReadyEventSent.current && agent) {
          appReadyEventSent.current = true;
          agent._bridge.send("rnp_appReady", {
            appKey: sceneName,
            navigationPlugins: navigationPlugins.map((plugin) => plugin.name),
          });
        }
        const isRunningPreview = isPreviewUrl(sceneName);
        if (isRunningPreview) {
          const preview = (global.__rnp_previews || new Map()).get(sceneName);
          agent._bridge.send("rnp_navigationChanged", {
            displayName: `preview:${preview.name}`, // TODO: make names unique if there are multiple previews of the same component
            id: sceneName,
          });
        }
      }}>
      {children}
    </View>
  );
}
