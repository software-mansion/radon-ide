const { useContext, useEffect, useRef, useCallback } = require("react");
const { LogBox, AppRegistry, RootTagContext, View, Dimensions, Linking } = require("react-native");

const navigationPlugins = [];
export function registerNavigationPlugin(name, plugin) {
  navigationPlugins.push({ name, plugin });
}

/*
 * We assume the Bridge protocol version is 2,
 * as it's being used since React 18 (React-native 0.69).
 */
const BRIDGE_PROTOCOL_VERSION = 2;

const DevtoolsOperationType = {
  TREE_OPERATION_ADD: 1,
  TREE_OPERATION_REMOVE: 2,
  TREE_OPERATION_REORDER_CHILDREN: 3,
  TREE_OPERATION_UPDATE_TREE_BASE_DURATION: 4,
  TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS: 5,
  TREE_OPERATION_REMOVE_ROOT: 6,
  TREE_OPERATION_SET_SUBTREE_MODE: 7,
};

let agent;
let fileRouteMap = new Map();
let navigationHistory = new Map();

let operationRequestId = 1;

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
      const LoadingView = require("react-native/Libraries/Utilities/LoadingView");
      LoadingView.showMessage = (message) => {
        agent._bridge.send("rnp_fastRefreshStarted");
      };
      LoadingView.hide = () => {
        agent._bridge.send("rnp_fastRefreshComplete");
      };

      // console.reportErrorsAsExceptions = false;
    }

    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook.reactDevtoolsAgent) {
      _attachToDevtools(hook.reactDevtoolsAgent);
    } else {
      hook.on("react-devtools", _attachToDevtools);
    }
    attachHookListeners(hook);
  }, []);

  const attachHookListeners = (hook) => {
    hook.sub("operations", (operations) => {
      const { addedElementIds, rendererId } = getAllAddedElementIdsFromOperations(operations);
      const rendererInterfaces = hook.rendererInterfaces.get(rendererId);
      const currentNavigationDescriptior = getCurrentNavigationDescriptor();
      addedElementIds.forEach((elementId) => {
        try {
          const element = rendererInterfaces.inspectElement(
            operationRequestId,
            elementId,
            null,
            true
          );
          if (element) {
            const fileName = element?.value?.source?.fileName;
            if (fileName) {
              fileRouteMap.set(fileName, currentNavigationDescriptior);
            }
          }
        } catch (e) {
          // we ignore errors here as they would surface as if they were app's errors which we don't want the user to bother with
          // in worst case scenario an error here would result in a file not being properly tracket for the jump-to-route feature
        }
      });
      operationRequestId++;
    });
  };

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
        }
      }}>
      {children}
    </View>
  );
}

/*
 * Before chaning anything in this function, please refer to:
 * https://github.com/facebook/react/blob/6c7b41da3de12be2d95c60181b3fe896f824f13a/packages/react-devtools-shared/src/devtools/store.js#L921
 */
function getAllAddedElementIdsFromOperations(operations) {
  const rendererID = operations[0];

  const addedElementIds = [];

  let i = 2;

  const blockSize = operations[i];
  i++;

  const blockIndexEnd = i + blockSize;

  while (i < blockIndexEnd) {
    const nextLength = operations[i];
    i += nextLength + 1;
  }

  while (i < operations.length) {
    const operation = operations[i];
    switch (operation) {
      case DevtoolsOperationType.TREE_OPERATION_ADD: {
        const id = operations[i + 1];
        const type = operations[i + 2];

        i += 3;
        if (type === 11) {
          // ElementTypeRoot
          i += 2;

          if (BRIDGE_PROTOCOL_VERSION === null || BRIDGE_PROTOCOL_VERSION >= 2) {
            i += 2;
          }
        } else {
          addedElementIds.push(id);
          i += 4;
        }
        break;
      }
      // We don't need to track the remove operation.
      case DevtoolsOperationType.TREE_OPERATION_REMOVE: {
        const removeLength = operations[i + 1];
        i += 2 + removeLength;
        break;
      }
      // We don't need to track the remove operation.
      case DevtoolsOperationType.TREE_OPERATION_REMOVE_ROOT: {
        i += 1;
      }
      case DevtoolsOperationType.TREE_OPERATION_REORDER_CHILDREN: {
        const id = operations[i + 1];
        i += 3 + operations[i + 2];
        break;
      }
      case DevtoolsOperationType.TREE_OPERATION_SET_SUBTREE_MODE: {
        const id = operations[i + 1];
        i += 3;
        break;
      }
      case DevtoolsOperationType.TREE_OPERATION_UPDATE_TREE_BASE_DURATION:
        i += 3;
        break;
      case DevtoolsOperationType.TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS:
        const id = operations[i + 1];
        i += 4;
        break;
      default:
        throw new Error("Unsupported bridge operation.");
    }
  }

  return { addedElementIds, rendererId: rendererID };
}
