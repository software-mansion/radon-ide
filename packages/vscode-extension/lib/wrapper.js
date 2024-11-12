"use no memo";

const { useContext, useState, useEffect, useRef, useCallback } = require("react");
const {
  LogBox,
  AppRegistry,
  Dimensions,
  RootTagContext,
  View,
  Linking,
  findNodeHandle
} = require("react-native");
const { storybookPreview } = require("./storybook_helper");

const navigationPlugins = [];
export function registerNavigationPlugin(name, plugin) {
  navigationPlugins.push({ name, plugin });
}

let navigationHistory = new Map();

const InternalImports = {
  get PREVIEW_APP_KEY() {
    return require("./preview").PREVIEW_APP_KEY;
  }
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

function getInspectorDataForInstance(node) {
  const renderers = Array.from(window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.values());
  if (!renderers) {
    return {};
  }
  for (const renderer of renderers) {
    if (renderer.rendererConfig?.getInspectorDataForInstance) {
      const data = renderer.rendererConfig.getInspectorDataForInstance(node);
      return data ?? {};
    }
  }
  return {};
};

function createStackElement(
  frame, name, source
) {
  return {
    componentName: name,
    source: {
      fileName: source.fileName,
      line0Based: source.lineNumber - 1,
      column0Based: source.columnNumber - 1,
    },
    frame,
  };
};

// Returns an array of promises which resolve to elements of the components hierarchy stack.
function traverseComponentsTreeUp(startNode) {
  const stackPromises = [];
  let node = startNode;

  // Optimization: we break after reaching fiber node corresponding to OffscreenComponent (with tag 22).
  // https://github.com/facebook/react/blob/c3570b158d087eb4e3ee5748c4bd9360045c8a26/packages/react-reconciler/src/ReactWorkTags.js#L62
  while (node && node.tag !== 22) {
    const data = getInspectorDataForInstance(node);

    data.hierarchy?.length && stackPromises.push(new Promise((resolve, reject) => {
      const item = data.hierarchy[data.hierarchy.length - 1];
      const inspectorData = item.getInspectorData(findNodeHandle);
      
      try {
        inspectorData.measure((_x, _y, viewWidth, viewHeight, pageX, pageY) => {
          const stackElementFrame = {
            x: pageX,
            y: pageY,
            width: viewWidth,
            height: viewHeight
          };

          stackElement = (inspectorData.source) ? 
            createStackElement(stackElementFrame, item.name, inspectorData.source) : undefined;

          resolve(stackElement);
        });
      } catch (e) {
        reject(e);
      }
    }));

    node = node.return;
  }

  return stackPromises;
};

function getInspectorDataForCoordinates(mainContainerRef, x, y, requestStack, callback) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");

  function scaleFrame(frame) {
    return {
      x: frame.x / screenWidth,
      y: frame.y / screenHeight,
      width: frame.width / screenWidth,
      height: frame.height / screenHeight
    };
  };

  RNInternals.getInspectorDataForViewAtPoint(
    mainContainerRef.current,
    x * screenWidth,
    y * screenHeight,
    (viewData) => {
      const frame = viewData.frame;
      const scaledFrame = scaleFrame({
        x: frame.left,
        y: frame.top,
        width: frame.width,
        height: frame.height
      });

      if (!requestStack) {
        callback({ frame: scaledFrame });
      }

      Promise.all(traverseComponentsTreeUp(viewData.closestInstance, []))
        .then((stack) => stack.filter(Boolean))
        .then((stack) => 
          stack.map((stackElement) => ({
            ...stackElement,
            frame: scaleFrame(stackElement.frame)
          }))
        ).then((scaledStack) => 
          callback({
            frame: scaledFrame,
            stack: scaledStack
          }));
      }
  );
};

export function AppWrapper({ children, initialProps, ..._rest }) {
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
      AppRegistry.runApplication(InternalImports.PREVIEW_APP_KEY, {
        rootTag,
        initialProps: { previewKey },
      });
      const preview = global.__RNIDE_previews.get(previewKey);
      const urlPrefix = previewKey.startsWith("sb://") ? "sb:" : "preview:";
      handleNavigationChange({ id: previewKey, name: urlPrefix + preview.name });
    },
    [rootTag, handleNavigationChange]
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
      });
    } else {
      closePromiseResolve();
    }
    return closePreviewPromise;
  }, [rootTag]);

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
      openPreview(payload.previewId);
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

      getInspectorDataForCoordinates(
        mainContainerRef, 
        x,
        y,
        requestStack,
        (inspectorData) => {
          devtoolsAgent._bridge.send("RNIDE_inspectData", {
            id,
            ...inspectorData
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

  useEffect(() => {
    if (devtoolsAgent) {
      LogBox.uninstall();
      const LoadingView = RNInternals.LoadingView;
      LoadingView.showMessage = (message) => {
        devtoolsAgent._bridge.send("RNIDE_fastRefreshStarted");
      };
      LoadingView.hide = () => {
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
