const { useContext, useEffect, useRef, useCallback } = require("react");
const { LogBox, AppRegistry, RootTagContext, View, Dimensions, Linking } = require("react-native");

const navigationPlugins = [];
export function registerNavigationPlugin(name, plugin) {
  navigationPlugins.push({ name, plugin });
}

let agent;
let fileRouteMap = new Map();
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
    navigationHistory.set(navigationDescriptor.id, navigationDescriptor);
    agent &&
      agent._bridge.send("RNIDE_navigationChanged", {
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
      if (follow) {
        const route = fileRouteMap[filename];
        if (route) {
          return route;
        }
      }
    },
    [getCurrentNavigationDescriptor]
  );

  useEffect(() => {
    function _attachToDevtools(agent_) {
      agent = agent_;

      // we load internal bits of runtime lazily as they require some particular order of initialization
      // and may not be ready when loaded via runtime.js
      const getInspectorDataForViewAtPoint = require("react-native/Libraries/Inspector/getInspectorDataForViewAtPoint");
      const SceneTracker = require("react-native/Libraries/Utilities/SceneTracker");

      function openPreview(previewKey) {
        AppRegistry.runApplication(previewKey, {
          rootTag,
          initialProps: {},
        });
      }

      agent._bridge.addListener("RNIDE_openPreview", (payload) => {
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

      agent._bridge.addListener("RNIDE_openUrl", (payload) => {
        closePreview();
        const url = payload.url;
        Linking.openURL(url);
      });

      agent._bridge.addListener("RNIDE_openNavigation", (payload) => {
        if (isPreviewUrl(payload.id)) {
          openPreview(payload.id);
          return;
        }
        closePreview();
        const navigationDescriptor = navigationHistory.get(payload.id);
        navigationDescriptor && requestNavigationChange(navigationDescriptor);
      });

      agent._bridge.addListener("RNIDE_inspect", (payload) => {
        const { width, height } = Dimensions.get("screen");
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
            let stackPromise = Promise.resolve(undefined);
            if (payload.requestStack) {
              stackPromise = Promise.all(
                viewData.hierarchy.reverse().map((item) => {
                  const inspectorData = item.getInspectorData();
                  const framePromise = new Promise((res, rej) => {
                    inspectorData.measure((x, y, viewWidth, viewHeight, pageX, pageY) => {
                      res({
                        x: pageX / width,
                        y: pageY / height,
                        width: viewWidth / width,
                        height: viewHeight / height,
                      });
                    });
                  });
                  return framePromise.then((frame) => {
                    return {
                      componentName: item.name,
                      source: {
                        fileName: inspectorData.source.fileName,
                        line0Based: inspectorData.source.lineNumber - 1,
                        column0Based: inspectorData.source.columnNumber - 1,
                      },
                      frame,
                    };
                  });
                })
              );
            }
            stackPromise.then((stack) => {
              agent._bridge.send("RNIDE_inspectData", {
                id: payload.id,
                frame: scaledFrame,
                stack,
              });
            });
          }
        );
      });

      agent._bridge.addListener("RNIDE_editorFileChanged", (payload) => {
        const newRoute = handleActiveFileChange(payload.filename, payload.followEnabled);
        newRoute && push(newRoute);
      });

      agent._bridge.addListener("RNIDE_iosDevMenu", (_payload) => {
        // this native module is present only on iOS and will crash if called
        // on Android
        const DevMenu = require("react-native/Libraries/NativeModules/specs/NativeDevMenu").default;

        DevMenu.show();
      });

      LogBox.uninstall();
      const LoadingView = require("react-native/Libraries/Utilities/LoadingView");
      LoadingView.showMessage = (message) => {
        agent._bridge.send("RNIDE_fastRefreshStarted");
      };
      LoadingView.hide = () => {
        agent._bridge.send("RNIDE_fastRefreshComplete");
      };

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
        if (agent) {
          // we require this here again as putting it in the top-level scope causes issues with the order of loading
          const SceneTracker = require("react-native/Libraries/Utilities/SceneTracker");

          const sceneName = SceneTracker.getActiveScene().name;
          if (!appReadyEventSent.current) {
            appReadyEventSent.current = true;
            agent._bridge.send("RNIDE_appReady", {
              appKey: sceneName,
              navigationPlugins: navigationPlugins.map((plugin) => plugin.name),
            });
          }
          const isRunningPreview = isPreviewUrl(sceneName);
          if (isRunningPreview) {
            const preview = (global.__RNIDE_previews || new Map()).get(sceneName);
            agent._bridge.send("RNIDE_navigationChanged", {
              displayName: `preview:${preview.name}`, // TODO: make names unique if there are multiple previews of the same component
              id: sceneName,
            });
          }
        }
      }}>
      {children}
    </View>
  );
}
