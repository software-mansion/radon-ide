const { Dimensions, findNodeHandle } = require("react-native");

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
      const inspectorData = item.getInspectorData((arg) => findNodeHandle(arg));
      
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

export function getInspectorDataForCoordinates(mainContainerRef, x, y, requestStack, callback) {
  const getInspectorDataForViewAtPoint = 
    require("react-native/Libraries/Inspector/getInspectorDataForViewAtPoint");

  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");

  function scaleFrame(frame) {
    return {
      x: frame.x / screenWidth,
      y: frame.y / screenHeight,
      width: frame.width / screenWidth,
      height: frame.height / screenHeight
    };
  };

  getInspectorDataForViewAtPoint(
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
