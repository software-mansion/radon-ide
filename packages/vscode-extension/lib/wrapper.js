"use no memo";

const { useContext, useState, useEffect, useRef, useCallback } = require("react");
const {
  LogBox,
  AppRegistry,
  Dimensions,
  RootTagContext,
  View,
  Linking,
  findNodeHandle,
} = require("react-native");
const { storybookPreview } = require("./storybook_helper");

// https://github.com/facebook/react/blob/c3570b158d087eb4e3ee5748c4bd9360045c8a26/packages/react-reconciler/src/ReactWorkTags.js#L62
const OffscreenComponentReactTag = 22;

const navigationPlugins = [];
export function registerNavigationPlugin(name, plugin) {
  navigationPlugins.push({ name, plugin });
}

const devtoolPlugins = new Set(["network"]);
let devtoolPluginsChanged = undefined;
export function registerDevtoolPlugin(name) {
  devtoolPlugins.add(name);
  devtoolPluginsChanged?.();
}

let navigationHistory = new Map();

const InternalImports = {
  get PREVIEW_APP_KEY() {
    return require("./preview").PREVIEW_APP_KEY;
  },
  get enableNetworkInspect() {
    return require("./network").enableNetworkInspect;
  },
  get reduxDevtoolsExtensionCompose() {
    return require("./plugins/redux-devtools").compose;
  },
};

window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = function (...args) {
  return InternalImports.reduxDevtoolsExtensionCompose(...args);
};

const RNInternals = {
  get getInspectorDataForViewAtPoint() {
    return require("react-native/Libraries/Inspector/getInspectorDataForViewAtPoint");
  },
  get SceneTracker() {
    return require("react-native/Libraries/Utilities/SceneTracker");
  },
  get LoadingView() {
    // In React Native 0.75 LoadingView was moved to DevLoadingView
    // We need to use `try catch` pattern for both files as it has special semantics
    // in bundler. If require isn't surrounded with try catch it will need to resolve
    // at build time.
    try {
      return require("react-native/Libraries/Utilities/LoadingView");
    } catch (e) {}
    try {
      return require("react-native/Libraries/Utilities/DevLoadingView");
    } catch (e) {}
    throw new Error("Couldn't locate LoadingView module");
  },
};

function getCurrentScene() {
  return RNInternals.SceneTracker.getActiveScene().name;
}

function emptyNavigationHook() {
  return {
    getCurrentNavigationDescriptor: () => undefined,
    requestNavigationChange: () => {},
  };
}

function useAgentListener(agent, eventName, listener, deps = []) {
  useEffect(() => {
    if (agent) {
      agent._bridge.addListener(eventName, listener);
      return () => {
        agent._bridge.removeListener(eventName, listener);
      };
    }
  }, [agent, ...deps]);
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
      const data = rendererConfig.getInspectorDataForInstance(node);
      const item = data.hierarchy[data.hierarchy.length - 1];
      stackItems.push(item);
      node = node.return;
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
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");

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
              try {
                inspectorData.measure((_x, _y, viewWidth, viewHeight, pageX, pageY) => {
                  const source = inspectorData.source;
                  res({
                    componentName: inspectorData.name,
                    source: {
                      fileName: source.fileName,
                      line0Based: source.lineNumber - 1,
                      column0Based: source.columnNumber - 1,
                    },
                    frame: {
                      x: pageX / screenWidth,
                      y: pageY / screenHeight,
                      width: viewWidth / screenWidth,
                      height: viewHeight / screenHeight,
                    },
                  });
                });
              } catch (e) {
                rej(e);
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
  const rootTag = useContext(RootTagContext);
  const [devtoolsAgent, setDevtoolsAgent] = useState(null);
  const [hasLayout, setHasLayout] = useState(false);
  const mainContainerRef = useRef();

  const mountCallback = initialProps?.__RNIDE_onMount;
  useEffect(() => {
    mountCallback?.();
  }, [mountCallback]);

  const layoutCallback = initialProps?.__RNIDE_onLayout;

  const handleNavigationChange = useCallback(
    (navigationDescriptor) => {
      navigationHistory.set(navigationDescriptor.id, navigationDescriptor);
      devtoolsAgent?._bridge.send("RNIDE_navigationChanged", {
        displayName: navigationDescriptor.name,
        id: navigationDescriptor.id,
      });
    },
    [devtoolsAgent]
  );

  const useNavigationMainHook = navigationPlugins[0]?.plugin.mainHook || emptyNavigationHook;
  const { requestNavigationChange } = useNavigationMainHook({
    onNavigationChange: handleNavigationChange,
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
      AppRegistry.runApplication(InternalImports.PREVIEW_APP_KEY, {
        rootTag,
        initialProps: { ...initialProps, previewKey },
        fabric,
      });
      const urlPrefix = previewKey.startsWith("sb://") ? "sb:" : "preview:";
      handleNavigationChange({ id: previewKey, name: urlPrefix + preview.name });
    },
    [rootTag, handleNavigationChange, initialProps, fabric]
  );

  const closePreview = useCallback(() => {
    let closePromiseResolve;
    const closePreviewPromise = new Promise((resolve) => {
      closePromiseResolve = resolve;
    });
    if (getCurrentScene() === InternalImports.PREVIEW_APP_KEY) {
      AppRegistry.runApplication("main", {
        rootTag,
        initialProps: {
          __RNIDE_onLayout: closePromiseResolve,
        },
        fabric,
      });
    } else {
      closePromiseResolve();
    }
    return closePreviewPromise;
  }, [rootTag, fabric]);

  const showStorybookStory = useCallback(
    async (componentTitle, storyName) => {
      const previewKey = await storybookPreview(componentTitle, storyName);
      previewKey !== undefined && openPreview(previewKey);
    },
    [handleNavigationChange]
  );

  useAgentListener(
    devtoolsAgent,
    "RNIDE_openPreview",
    (payload) => {
      try {
        openPreview(payload.previewId);
        devtoolsAgent._bridge.send("RNIDE_openPreviewResult", payload);
      } catch (e) {
        devtoolsAgent._bridge.send("RNIDE_openPreviewResult", { ...payload, error: true });
      }
    },
    [openPreview]
  );

  useAgentListener(
    devtoolsAgent,
    "RNIDE_openUrl",
    (payload) => {
      closePreview().then(() => {
        const url = payload.url;
        Linking.openURL(url);
      });
    },
    [closePreview]
  );

  useAgentListener(
    devtoolsAgent,
    "RNIDE_openNavigation",
    (payload) => {
      const isPreviewUrl = payload.id.startsWith("preview://") || payload.id.startsWith("sb://");
      if (isPreviewUrl) {
        openPreview(payload.id);
        return;
      }
      const navigationDescriptor = navigationHistory.get(payload.id);
      closePreview().then(() => {
        navigationDescriptor && requestNavigationChange(navigationDescriptor);
      });
    },
    [openPreview, closePreview, requestNavigationChange]
  );

  useAgentListener(
    devtoolsAgent,
    "RNIDE_inspect",
    (payload) => {
      const { id, x, y, requestStack } = payload;

      getInspectorDataForCoordinates(mainContainerRef, x, y, requestStack, (inspectorData) => {
        devtoolsAgent._bridge.send("RNIDE_inspectData", {
          id,
          ...inspectorData,
        });
      });
    },
    [mainContainerRef]
  );

  useAgentListener(
    devtoolsAgent,
    "RNIDE_showStorybookStory",
    (payload) => {
      showStorybookStory(payload.componentTitle, payload.storyName);
    },
    [showStorybookStory]
  );

  useAgentListener(
    devtoolsAgent,
    "RNIDE_enableNetworkInspect",
    (payload) => {
      InternalImports.enableNetworkInspect(devtoolsAgent, payload);
    },
    []
  );

  useAgentListener(devtoolsAgent, "RNIDE_loadFileBasedRoutes", (payload) => {
    // todo: maybe rename it to `navigationState` or something like that because this is not just history anymore.
    for (const route of payload) {
      navigationHistory.set(route.id, route);
    }
    devtoolsAgent?._bridge.send(
      "RNIDE_navigationInit",
      payload.map((route) => ({
        displayName: route.name,
        id: route.id,
      }))
    );
  });

  useEffect(() => {
    if (devtoolsAgent) {
      LogBox.uninstall();
      const LoadingView = RNInternals.LoadingView;
      LoadingView.showMessage = (message) => {
        devtoolsAgent._bridge.send("RNIDE_fastRefreshStarted");
      };
      const originalHide = LoadingView.hide;
      LoadingView.hide = () => {
        originalHide();
        devtoolsAgent._bridge.send("RNIDE_fastRefreshComplete");
      };
    }
  }, [devtoolsAgent]);

  useEffect(() => {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    hook.off("react-devtools", setDevtoolsAgent);
    if (hook.reactDevtoolsAgent) {
      setDevtoolsAgent(hook.reactDevtoolsAgent);
    } else {
      hook.on("react-devtools", setDevtoolsAgent);
      return () => {
        hook.off("react-devtools", setDevtoolsAgent);
      };
    }
  }, [setDevtoolsAgent]);

  useEffect(() => {
    if (!!devtoolsAgent && hasLayout) {
      const appKey = getCurrentScene();
      devtoolsAgent._bridge.send("RNIDE_appReady", {
        appKey,
        navigationPlugins: navigationPlugins.map((plugin) => plugin.name),
      });
      devtoolPluginsChanged = () => {
        devtoolsAgent._bridge.send("RNIDE_devtoolPluginsChanged", {
          plugins: Array.from(devtoolPlugins.values()),
        });
      };
      devtoolPluginsChanged();
      return () => {
        devtoolPluginsChanged = undefined;
      };
    }
  }, [!!devtoolsAgent && hasLayout]);

  return (
    <View
      ref={mainContainerRef}
      style={{ flex: 1 }}
      onLayout={() => {
        layoutCallback?.();
        setHasLayout(true);
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
