"use no memo";

const { useContext, useState, useEffect, useRef, useCallback } = require("react");
const {
  LogBox,
  AppRegistry,
  RootTagContext,
  View,
  Linking,
  findNodeHandle,
  Platform,
  Dimensions,
  DevSettings,
} = require("react-native");
const { storybookPreview } = require("./storybook_helper");
require("./react_devtools_agent"); // needs to be loaded before inspector_bridge is used
const inspectorBridge = require("./inspector_bridge");
const DimensionsObserver = require("./dimensions_observer");

// https://github.com/facebook/react/blob/c3570b158d087eb4e3ee5748c4bd9360045c8a26/packages/react-reconciler/src/ReactWorkTags.js#L62
const OffscreenComponentReactTag = 22;

const navigationPlugins = [];
export function registerNavigationPlugin(name, plugin) {
  navigationPlugins.push({ name, plugin });
}

const devtoolPlugins = new Set(["network"]);
const devtoolPluginsChangedListeners = new Set();
export function registerDevtoolPlugin(name) {
  devtoolPlugins.add(name);
  devtoolPluginsChangedListeners.forEach((listener) => listener());
}

globalThis.__RADON_reloadJS = function () {
  DevSettings.reload("Radon IDE");
};

let navigationHistory = new Map();
let mainApplicationKey = undefined;

// we register this component as a way of forcing the main app to be re-mounted
// AppRegistry doesn't have a method to foce a re-mount hence we call runApplication
// for this dummy component and then runApplication for the main app
AppRegistry.registerComponent("__radon_dummy_component", () => View);

const InternalImports = {
  get PREVIEW_APP_KEY() {
    return require("./preview").PREVIEW_APP_KEY;
  },
  get setupNetworkPlugin() {
    return require("./network/network").setup;
  },
  get reduxDevtoolsExtensionCompose() {
    return require("./plugins/redux-devtools").compose;
  },
  get setupRenderOutlinesPlugin() {
    return require("./render_outlines").setup;
  },
  get setupOrientationListeners() {
    return require("./orientation/orientation").setup;
  },
  get setupInspectorAvailabilityListeners() {
    return require("./inspector_availability").setup;
  },
};

window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = function (...args) {
  return InternalImports.reduxDevtoolsExtensionCompose(...args);
};

const RNInternals = require("./rn-internals/rn-internals");

function getCurrentScene() {
  return RNInternals.SceneTracker.getActiveScene().name;
}

function defaultNavigationHook({ onNavigationChange }) {
  return {
    getCurrentNavigationDescriptor: () => undefined,
    requestNavigationChange: (navigationDescriptor) => {
      if (navigationDescriptor.id === "__BACK__" || navigationDescriptor.id === "__HOME__") {
        // default navigator doesn't support back, for back/home navigation we send empty navigation
        // descriptor which is interpreted as initial navigation state. Using undefined for the
        // name will result in the Url bar showing the default starting label ("/")
        onNavigationChange({ id: "__HOME__", name: undefined, canGoBack: false });
      } else {
        onNavigationChange(navigationDescriptor);
      }
    },
  };
}

function getRendererConfig() {
  const renderers = Array.from(window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.values());
  if (!renderers) {
    return undefined;
  }
  for (const renderer of renderers) {
    if (renderer.rendererConfig?.getInspectorDataForInstance) {
      return renderer.rendererConfig;
    }
  }
  return undefined;
}

/**
 * Return an array of component data representing a stack of components by traversing
 * the component hierarchy up from the startNode.
 * Each stack entry carries the component name, source location and measure function.
 * We try to use React's renderer getInspectorDataForInstance to get the details about
 * each particular component instance. However, with older versions of React Native where
 * this method is not available, we fallback to using hierarchy provided by getInspectorDataForViewAtPoint
 */
function extractComponentStack(startNode, viewDataHierarchy) {
  const rendererConfig = getRendererConfig();

  let stackItems = [];
  if (rendererConfig) {
    // when we find renderer config with getInspectorDataForInstance we use fiber node
    // "return" property to traverse the component hierarchy
    let node = startNode;

    // Optimization: we break after reaching fiber node corresponding to OffscreenComponent
    while (node && node.tag !== OffscreenComponentReactTag) {
      try {
        const data = rendererConfig.getInspectorDataForInstance(node);
        const item = data.hierarchy[data.hierarchy.length - 1];
        stackItems.push(item);
        node = node.return;
      } catch (e) {
        // In the preview mode getInspectorDataForInstance may throw an error
        // in the root node, because it is unmounted. We break the loop in this case,
        // as there is no more information to extract.
        break;
      }
    }
  } else if (viewDataHierarchy && viewDataHierarchy.length > 0) {
    // fallback to using viewDataHierarchy
    stackItems = viewDataHierarchy.reverse();
  }

  const componentStack = [];
  stackItems.forEach((item) => {
    const inspectorData = item.getInspectorData(findNodeHandle);
    if (inspectorData.source) {
      componentStack.push({
        name: item.name,
        source: inspectorData.source,
        measure: inspectorData.measure,
      });
    }
  });
  return componentStack;
}

function getInspectorDataForCoordinates(mainContainerRef, x, y, requestStack, callback) {
  const { width: screenWidth, height: screenHeight } = DimensionsObserver.getScreenDimensions();

  RNInternals.getInspectorDataForViewAtPoint(
    mainContainerRef.current,
    x * screenWidth,
    y * screenHeight,
    (viewData) => {
      const frame = viewData.frame;
      const scaledFrame = {
        x: frame.left / screenWidth,
        y: frame.top / screenHeight,
        width: frame.width / screenWidth,
        height: frame.height / screenHeight,
      };

      if (!requestStack) {
        callback({ frame: scaledFrame });
        return;
      }

      const inspectorDataStack = extractComponentStack(
        viewData.closestInstance,
        viewData.hierarchy
      );
      Promise.all(
        inspectorDataStack.map(
          (inspectorData) =>
            new Promise((res, rej) => {
              const source = {
                fileName: inspectorData.source.fileName,
                line0Based: inspectorData.source.lineNumber - 1,
                column0Based: inspectorData.source.columnNumber - 1,
              };
              try {
                inspectorData.measure((_x, _y, viewWidth, viewHeight, pageX, pageY) => {
                  res({
                    componentName: inspectorData.name,
                    source,
                    frame: {
                      x: pageX / screenWidth,
                      y: pageY / screenHeight,
                      width: viewWidth / screenWidth,
                      height: viewHeight / screenHeight,
                    },
                  });
                });
              } catch (e) {
                res({ componentName: inspectorData.name, source });
              }
            })
        )
      ).then((componentDataStack) => {
        callback({
          frame: scaledFrame,
          stack: componentDataStack,
        });
      });
    }
  );
}

export function AppWrapper({ children, initialProps, fabric }) {
  if (!mainApplicationKey) {
    mainApplicationKey = getCurrentScene();
  }
  const rootTag = useContext(RootTagContext);
  const [hasLayout, setHasLayout] = useState(false);
  const mainContainerRef = useRef();

  const handleNavigationChange = useCallback((navigationDescriptor) => {
    navigationHistory.set(navigationDescriptor.id, navigationDescriptor);
    inspectorBridge.sendMessage({
      type: "navigationChanged",
      data: {
        displayName: navigationDescriptor.name,
        id: navigationDescriptor.id,
        canGoBack: navigationDescriptor.canGoBack,
      },
    });
  });

  const handleRouteListChange = useCallback((routeList) => {
    inspectorBridge.sendMessage({
      type: "navigationRouteListUpdated",
      data: routeList,
    });
  }, []);

  const navigationPluginHook = navigationPlugins[0]?.plugin.mainHook;
  const usesDefaultNavigationHook =
    initialProps?.__radon_previewKey !== undefined || !navigationPluginHook;
  const useNavigationMainHook = usesDefaultNavigationHook
    ? defaultNavigationHook
    : navigationPluginHook;
  const { requestNavigationChange } = useNavigationMainHook({
    onNavigationChange: handleNavigationChange,
    onRouteListChange: handleRouteListChange,
  });

  const openPreview = useCallback(
    (previewKey) => {
      const preview = global.__RNIDE_previews.get(previewKey);
      if (!preview) {
        console.error(
          "Requested preview has not been registered. Currently previews only work for files loaded by the main application bundle."
        );
        throw new Error("Preview not found");
      }
      const urlPrefix = previewKey.startsWith("sb://") ? "sb:" : "preview:";
      AppRegistry.runApplication(InternalImports.PREVIEW_APP_KEY, {
        rootTag,
        initialProps: {
          ...initialProps,
          __radon_onLayout: undefined,
          __radon_nextNavigationDescriptor: {
            id: previewKey,
            name: urlPrefix + preview.name,
            canGoBack: true,
          },
          __radon_previewKey: previewKey,
        },
        fabric,
      });
    },
    [rootTag, handleNavigationChange, initialProps, fabric]
  );

  const openMainApp = useCallback(
    (nextNavigationDescriptor, forceRerender) => {
      let appOpenPromiseResolve;
      const appOpenPromise = new Promise((resolve) => {
        appOpenPromiseResolve = resolve;
      });

      const mainAppKey = mainApplicationKey ?? "main";
      if (getCurrentScene() !== mainAppKey || forceRerender) {
        const runApplication = () =>
          AppRegistry.runApplication(mainAppKey, {
            rootTag,
            initialProps: {
              ...initialProps,
              __radon_onLayout: appOpenPromiseResolve,
              __radon_nextNavigationDescriptor: nextNavigationDescriptor,
              __radon_previewKey: undefined,
            },
            fabric,
          });
        if (forceRerender) {
          AppRegistry.runApplication("__radon_dummy_component", { rootTag, fabric });
          setTimeout(runApplication, 0);
        } else {
          runApplication();
        }
      } else {
        nextNavigationDescriptor && requestNavigationChange(nextNavigationDescriptor);
        appOpenPromiseResolve();
      }
      return appOpenPromise;
    },
    [rootTag, fabric]
  );

  const showStorybookStory = useCallback(
    async (componentTitle, storyName) => {
      const previewKey = await storybookPreview(componentTitle, storyName);
      previewKey !== undefined && openPreview(previewKey);
    },
    [handleNavigationChange]
  );

  const openNavigation = useCallback(
    (message) => {
      const isPreviewUrl = message.id.startsWith("preview://") || message.id.startsWith("sb://");
      if (isPreviewUrl) {
        openPreview(message.id);
        return;
      }

      const navigationDescriptor = navigationHistory.get(message.id) || {
        id: message.id,
        name: message.name || message.id,
        pathname: message.id,
        params: message.params || {},
      };

      const forceRerenderMainApp =
        navigationDescriptor.id === "__HOME__" && usesDefaultNavigationHook;
      openMainApp(navigationDescriptor, forceRerenderMainApp);
    },
    [openPreview, openMainApp, requestNavigationChange]
  );

  useEffect(() => {
    const listener = (message) => {
      const { type, data } = message;
      switch (type) {
        case "openPreview":
          openPreview(data.previewId);
          break;
        case "openUrl":
          openMainApp(undefined, false).then(() => {
            const url = data.url;
            Linking.openURL(url);
          });
          break;
        case "openNavigation":
          openNavigation(data);
          break;
        case "inspect":
          const { id, x, y, requestStack } = data;
          getInspectorDataForCoordinates(mainContainerRef, x, y, requestStack, (inspectorData) => {
            inspectorBridge.sendMessage({
              type: "inspectData",
              data: {
                id,
                ...inspectorData,
              },
            });
          });
          break;
        case "showStorybookStory":
          showStorybookStory(data.componentTitle, data.storyName);
          break;
      }
    };
    inspectorBridge.addMessageListener(listener);
    return () => inspectorBridge.removeMessageListener(listener);
  }, [openPreview, openMainApp, openNavigation, showStorybookStory]);

  useEffect(() => {
    const LoadingView = RNInternals.LoadingView;
    LoadingView.showMessage = (message) => {
      inspectorBridge.sendMessage({
        type: "fastRefreshStarted",
      });
    };
    const originalHide = LoadingView.hide;
    LoadingView.hide = () => {
      originalHide();
      inspectorBridge.sendMessage({
        type: "fastRefreshComplete",
      });
    };

    InternalImports.setupRenderOutlinesPlugin();
    InternalImports.setupNetworkPlugin();
    const orientationListenersCleanup = InternalImports.setupOrientationListeners();
    const inspectorAvailabilityListenersCleanup =
      InternalImports.setupInspectorAvailabilityListeners();

    const originalErrorHandler = global.ErrorUtils.getGlobalHandler();
    LogBox.ignoreAllLogs(true);

    function wrappedGlobalErrorHandler(error, isFatal) {
      try {
        // NOTE: this is necessary for two reasons:
        // 1. even though we wish to ignore warnings, without this, when displaying the LogBox,
        // the warnings will be included in the list of reported errors
        // 2. when the fullscreen LogBox is minimized, new errors won't bring it up unless we clear the old ones
        RNInternals.LogBoxData.clear();
        originalErrorHandler(error, isFatal);
      } catch {}
    }

    global.ErrorUtils.setGlobalHandler(wrappedGlobalErrorHandler);
    return () => {
      global.ErrorUtils.setGlobalHandler(originalErrorHandler);
      orientationListenersCleanup();
      inspectorAvailabilityListenersCleanup();
    };
  }, []);

  useEffect(() => {
    if (hasLayout) {
      const appKey = getCurrentScene();
      inspectorBridge.sendMessage({
        type: "appReady",
        data: {
          appKey,
          navigationPlugins: navigationPlugins.map((plugin) => plugin.name),
        },
      });

      const nextNavigationDescriptor = initialProps?.__radon_nextNavigationDescriptor;
      nextNavigationDescriptor && requestNavigationChange(nextNavigationDescriptor);

      const pluginsChangedCallback = () => {
        inspectorBridge.sendMessage({
          type: "devtoolPluginsChanged",
          data: {
            plugins: Array.from(devtoolPlugins.values()),
          },
        });
      };
      pluginsChangedCallback();

      devtoolPluginsChangedListeners.add(pluginsChangedCallback);
      return () => {
        devtoolPluginsChangedListeners.delete(pluginsChangedCallback);
      };
    }
  }, [hasLayout]);

  const onLayoutCallback = initialProps?.__radon_onLayout;

  return (
    <View
      ref={mainContainerRef}
      style={{ flex: 1 }}
      onLayout={(event) => {
        onLayoutCallback?.();
        setHasLayout(true);

        // iPad has issues with bugged Dimensions API, so we use the onLayout event
        // {width, height} of the main view wrapper to determine dimension changes
        // Android, on the other hand, has issues with determining layout {width, height}
        // after LogBox appears (because LogBox adds StatusBar for some reason),
        // so we use Dimensions.get("window") to get the current dimensions.
        if (Platform.OS === "android") {
          const { width, height } = Dimensions.get("window");
          DimensionsObserver.emitDimensionsChange({ width, height });
        } else {
          const { width, height } = event.nativeEvent.layout;
          DimensionsObserver.emitDimensionsChange({ width, height });
        }
      }}>
      {children}
    </View>
  );
}

export function createNestedAppWrapper(InnerWrapperComponent) {
  function WrapperComponent(props) {
    const { children, ...rest } = props;
    return (
      <AppWrapper {...rest}>
        <InnerWrapperComponent {...rest}>{children}</InnerWrapperComponent>
      </AppWrapper>
    );
  }
  return WrapperComponent;
}
