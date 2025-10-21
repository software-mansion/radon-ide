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

async function getCallSourceFromStack(stack) {
  const parsedStack = RNInternals.parseErrorStack(stack);

  const { file } = parsedStack[0];

  const url = new URL(file);
  const metroAddress = url.origin;

  // unfortunately I don't believe this endpoint is documented in any public metro docs
  // but it is used by RN internally for error symbolication and here is its entry point in code:
  // https://github.com/facebook/metro/blob/34bb8913ec4b5b02690b39d2246599faf094f721/packages/metro/src/Server.js#L679
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

  const callerFrame = symbolicatedStack[1];

  return {
    fileName: callerFrame.file,
    lineNumber: callerFrame.lineNumber,
    columnNumber: callerFrame.column,
  }
}

export function preview(component) {
  // eslint-disable-next-line eqeqeq
  if (!component) {
    return;
  }

  getCallSourceFromStack(new Error().stack).then((callSource) => {
    const key = `preview:/${callSource.fileName}:${callSource.lineNumber}`;

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
