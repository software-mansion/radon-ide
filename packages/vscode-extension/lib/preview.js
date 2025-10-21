const { useEffect, useState } = require("react");
const { AppRegistry, View } = require("react-native");
const RNInternals = require("./rn-internals/rn-internals");

export const PREVIEW_APP_KEY = "RNIDE_preview";

global.__RNIDE_previews ||= new Map();

export function Preview({ __radon_previewKey }) {
  const previewData = global.__RNIDE_previews.get(__radon_previewKey);
  if (!previewData || !previewData.component) {
    return null;
  }

  // only needed to force re-render when new preview is registered
  const [_, setDummyState] = useState(0);
  useEffect(() => {
    previewData.renderTrigger = () => {
      setDummyState((s) => s + 1);
    };
    return () => {
      previewData.renderTrigger = null;
    };
  }, [previewData]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      {previewData.component}
    </View>
  );
}

function getComponentName({ type }) {
  const name = type.name;
  const isClassOrFunctionComponent = name !== undefined;
  if (isClassOrFunctionComponent) {
    return name;
  }

  const isForwardedRef = type["$$typeof"] === Symbol.for("react.forward_ref");
  if (isForwardedRef) {
    return "(forwarded ref)";
  }

  return "(unnamed)";
}

async function getSourceFromComponent(component) {
  if (component._source) {
    return component._source;
  }

  const debugStack = component._debugStack;
  const parsedStack = RNInternals.parseErrorStack(debugStack.stack);

  const { file } = parsedStack[1];

  const url = new URL(file);
  const metroAddress = url.origin;

  const metroSymbolicateResponse = await fetch(
    `${metroAddress}/symbolicate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stack: parsedStack,
        extraData: {
        }
      }),
    }
  );

  const metroSymbolicateJson = await metroSymbolicateResponse.json();

  const symbolicatedStack = metroSymbolicateJson.stack;

  return {
    fileName: symbolicatedStack[1].file,
    lineNumber: symbolicatedStack[1].lineNumber,
    columnNumber: symbolicatedStack[1].column,
  }
}

export function preview(component) {

  console.log("Frytki preview registered", RNInternals.parseErrorStack(component._debugStack.stack));
  // eslint-disable-next-line eqeqeq
  if (!component || (component._debugStack == null && component._source == null)) {
    return;
  }

  getSourceFromComponent(component).then((source) => {
    const key = `preview:/${source.fileName}:${source.lineNumber}`;

    const lastPreview = global.__RNIDE_previews.get(key);

    global.__RNIDE_previews.set(key, {
      component,
      name: getComponentName(component),
    });

    // send update request to the last preview instance if it existed
    if (lastPreview && lastPreview.renderTrigger) {
      setTimeout(lastPreview.renderTrigger, 0);
    }
  });
}

AppRegistry.registerComponent(PREVIEW_APP_KEY, () => Preview);
