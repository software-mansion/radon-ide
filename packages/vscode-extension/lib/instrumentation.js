const {
  didFiberCommit,
  getDisplayName,
  getFiberId,
  getNearestHostFibers,
  getType,
  instrument,
  isCompositeFiber,
  traverseRenderedFibers,
} = require("__RNIDE_lib__/bippy");
const { getFabricUIManager } = require("react-native/Libraries/ReactNative/FabricUIManager.js");
const { Dimensions, StatusBar, UIManager, Platform } = require("react-native");
const FabricUIManager = getFabricUIManager();

const CORE_COMPONENT_NAMES = new Set([
  "ActivityIndicator",
  "Button",
  "CellRenderer",
  "DrawerLayoutAndroid",
  "FlatList",
  "Image",
  "InternalTextInput",
  "ItemWithSeparator",
  "Modal",
  "Pressable",
  "RefreshControl",
  "SafeAreaView",
  "SafeAreaView",
  "ScrollView",
  "ScrollViewStickyHeader",
  "SectionList",
  "Switch",
  "Text",
  "TextInput",
  "TouchableHighlight",
  "TouchableNativeFeedback",
  "TouchableOpacity",
  "TouchableWithoutFeedback",
  "View",
  "VirtualizedList",
  "VirtualizedListContextProvider",
  "VirtualizedListCellContextProvider",
  "Wrapper",
]);

let inited = false;
let options = {
  isEnabled: false,
  reportRenders: () => {},
  componentBlocklist: CORE_COMPONENT_NAMES,
};

function mergeRects(lhs, rhs) {
  const minX = Math.min(lhs.x, rhs.x);
  const minY = Math.min(lhs.y, rhs.y);
  const maxX = Math.max(lhs.x + lhs.width, rhs.x + rhs.width);
  const maxY = Math.max(lhs.y + lhs.height, rhs.y + rhs.height);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

const ANIMATED_COMPONENT_REGEX = /Animated\((.*)\)/;
function stripAnimatedFromComponentName(name) {
  const matches = ANIMATED_COMPONENT_REGEX.exec(name);
  return matches ? matches[1] : null;
}

function shouldHideComponent(name) {
  const stripped = stripAnimatedFromComponentName(name);
  return (
    options.componentBlocklist.has(name) || (stripped && options.componentBlocklist.has(stripped))
  );
}

function getWindowRect() {
  if (Platform.OS === "android") {
    const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");
    const statusBarHeight = StatusBar.currentHeight || 0;
    return {
      x: 0,
      y: statusBarHeight,
      width: screenWidth,
      height: screenHeight,
    };
  } else {
    const { width: windowWidth, height: windowHeight } = Dimensions.get("window");
    return {
      x: 0,
      y: 0,
      width: windowWidth,
      height: windowHeight,
    };
  }
}

async function onRender(fibers) {
  const blueprintMap = new Map();
  const { x: windowX, y: windowY, width: windowWidth, height: windowHeight } = getWindowRect();

  for (const fiber of fibers) {
    if (!isCompositeFiber(fiber)) {
      continue;
    }
    const name = typeof fiber.type === "string" ? fiber.type : getDisplayName(fiber);
    if (!name || shouldHideComponent(name)) {
      continue;
    }
    const blueprint = blueprintMap.get(fiber);
    const nearestFibers = getNearestHostFibers(fiber);
    const didCommit = didFiberCommit(fiber);

    if (nearestFibers.length === 0) {
      continue;
    }

    const boundingRect = await nearestFibers
      .map((hostFiber) => {
        return new Promise((resolve) => {
          const resolveMeasurements = (x, y, width, height) => {
            resolve({ x, y, width, height });
          };
          if (FabricUIManager) {
            FabricUIManager.measureInWindow(hostFiber.stateNode.node, resolveMeasurements);
          } else {
            // NOTE: we need to delay until the next frame to obtain the post-render measurements
            const tag = hostFiber.stateNode._nativeTag;
            setTimeout(() => {
              UIManager.measureInWindow(tag, resolveMeasurements);
            });
          }
        });
      })
      .reduce(async (acc, measurement) => {
        return mergeRects(await acc, await measurement);
      });

    boundingRect.x += windowX;
    boundingRect.y += windowY;
    // NOTE: we send values as % of the window size
    // to avoid having to account for display/window scale
    boundingRect.x /= windowWidth;
    boundingRect.y /= windowHeight;
    boundingRect.width /= windowWidth;
    boundingRect.height /= windowHeight;

    if (!blueprint) {
      blueprintMap.set(getFiberId(fiber), {
        name,
        count: 1,
        boundingRect,
        didCommit: didCommit ? 1 : 0,
      });
    } else {
      blueprint.count++;
    }
  }
  options.reportRenders(Array.from(blueprintMap.entries()));
}

const isValidFiber = (_fiber) => {
  return true;
};

function onCommitFiberRoot(_rendererID, root) {
  if (!options.isEnabled) {
    return;
  }
  const renderedFibers = [];
  traverseRenderedFibers(root.current, (fiber, _phase) => {
    const type = getType(fiber.type);
    if (!type) {
      return null;
    }

    if (!isValidFiber(fiber)) {
      return null;
    }

    renderedFibers.push(fiber);
  });
  onRender(renderedFibers);
}

export const setInstrumentationOptions = (partialOptions) => {
  const componentBlocklist = partialOptions.componentBlocklist
    ? new Set(partialOptions.componentBlocklist)
    : options.componentBlocklist;
  options = { ...options, componentBlocklist, ...partialOptions };
  if (!inited) {
    inited = true;
    instrument({
      onCommitFiberRoot: (rendererID, root) => onCommitFiberRoot(rendererID, root),
    });
  }
};
