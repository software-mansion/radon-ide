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
  "DrawerLayoutAndroid",
  "FlatList",
  "Image",
  "Modal",
  "Pressable",
  "RefreshControl",
  "SafeAreaView",
  "SafeAreaView",
  "ScrollView",
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
]);

let inited = false;
let options = {
  isEnabled: false,
  reportRenders: () => {},
  componentBlocklist: CORE_COMPONENT_NAMES,
};

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

    const measurements = await Promise.all(
      nearestFibers.map((hostFiber) => {
        return new Promise((resolve) => {
          const resolveMeasurements = (x, y, width, height) => {
            x += windowX;
            y += windowY;
            // NOTE: we send values as % of the window size
            // to avoid having to account for display/window scale
            x /= windowWidth;
            y /= windowHeight;
            width /= windowWidth;
            height /= windowHeight;
            resolve({ x, y, width, height });
          };
          if (FabricUIManager) {
            FabricUIManager.measureInWindow(hostFiber.stateNode.node, resolveMeasurements);
          } else {
            // NOTE: we need to delay until the next frame to obtain the post-render measurements
            setTimeout(() => {
              UIManager.measureInWindow(hostFiber.stateNode._nativeTag, resolveMeasurements);
            });
          }
        });
      })
    );

    if (measurements.length === 0) {
      continue;
    }

    if (!blueprint) {
      blueprintMap.set(getFiberId(fiber), {
        name,
        count: 1,
        elements: measurements,
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
