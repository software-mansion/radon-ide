const { Dimensions, findNodeHandle } = require("react-native");
const getInspectorDataForViewAtPoint = require("react-native/Libraries/Inspector/getInspectorDataForViewAtPoint");

const getInspectorDataForInstance = (node) => {
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

const createStackElement = (
  frame, name, source
) => (
  {
    componentName: name,
    source: {
      fileName: source.fileName,
      line0Based: source.lineNumber - 1,
      column0Based: source.columnNumber - 1,
    },
    frame,
  });

const traverseComponentsTreeUp = (node, stack) => {
  // Optimization: we break after reaching fiber node corresponding to OffscreenComponent (with tag 22).
  // https://github.com/facebook/react/blob/c3570b158d087eb4e3ee5748c4bd9360045c8a26/packages/react-reconciler/src/ReactWorkTags.js#L62
  if (!node || node.tag === 22) {
    return stack;
  } else {
    const data = getInspectorDataForInstance(node);
    const item = data.hierarchy[data.hierarchy.length - 1];
    const inspectorData = item.getInspectorData((arg) => findNodeHandle(arg));

    const stackElementPromise = new Promise((resolve, _) => {
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
    });

    return stackElementPromise.then((stackElement) => {
      if (stackElement) {
        stack.push(stackElement);
      }
      return traverseComponentsTreeUp(node.return, stack);
    });
  }
};

export const getInspectorDataForCoordinates = (
  mainContainerRef, x, y, requestStack
) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");

  const scaleFrame = (frame) => ({
    x: frame.x / screenWidth,
    y: frame.y / screenHeight,
    width: frame.width / screenWidth,
    height: frame.height / screenHeight
  });

  return new Promise((resolve, _) => {
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
          resolve ({ frame: scaledFrame });
        }

        traverseComponentsTreeUp(viewData.closestInstance, [])
          .then((stack) => {
              const scaledStack = stack.map((stackElement) => ({
                ...stackElement,
                frame: scaleFrame(stackElement.frame)
              }));

              resolve({
                frame: scaledFrame,
                stack: scaledStack
              });
            }
          );
        }
    );
  });
};
