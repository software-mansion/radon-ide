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
const { Dimensions } = require("react-native");
const FabricUIManager = getFabricUIManager();

let options = {
  isEnabled: false,
  reportRenders: () => {},
};

async function onRender(fibers) {
  const blueprintMap = new Map();
  for (const fiber of fibers) {
    if (!isCompositeFiber(fiber)) {
      continue;
    }
    const name = typeof fiber.type === "string" ? fiber.type : getDisplayName(fiber);
    if (!name) {
      continue;
    }
    const blueprint = blueprintMap.get(fiber);
    const nearestFibers = getNearestHostFibers(fiber);
    const didCommit = didFiberCommit(fiber);
    const { width: windowWidth, height: windowHeight } = Dimensions.get("window");

    const measurements = await Promise.all(
      nearestFibers.map((hostFiber) => {
        return new Promise((resolve) => {
          FabricUIManager.measureInWindow(hostFiber.stateNode.node, (x, y, width, height) => {
            // NOTE: we send values as % of the window size
            // to avoid having to account for display/window scale
            x /= windowWidth;
            y /= windowHeight;
            width /= windowWidth;
            height /= windowHeight;
            resolve({ x, y, width, height });
          });
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

// eslint-disable-next-line @typescript-eslint/no-shadow
export const enableInstrumentation = (options) => {
  setInstrumentationOptions(options);
  instrument({
    onCommitFiberRoot: (rendererID, root) => onCommitFiberRoot(rendererID, root),
  });
};

export const setInstrumentationOptions = (partialOptions) => {
  options = { ...options, ...partialOptions };
};
