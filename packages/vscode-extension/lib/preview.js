const { useEffect, useState } = require("react");
const { AppRegistry, SafeAreaView, View } = require("react-native");

export const PREVIEW_APP_KEY = "RNIDE_preview";

global.__RNIDE_previews ||= new Map();

export function Preview({ previewKey }) {
  const previewData = global.__RNIDE_previews.get(previewKey);
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
    <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      {previewData.component}
    </SafeAreaView>
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

export function preview(component) {
  // eslint-disable-next-line eqeqeq
  if (!component || component._source == null) {
    return;
  }

  const key = `preview:/${component._source.fileName}:${component._source.lineNumber}`;

  const lastPreview = global.__RNIDE_previews.get(key);

  global.__RNIDE_previews.set(key, {
    component,
    name: getComponentName(component),
  });

  // send update request to the last preview instance if it existed
  if (lastPreview && lastPreview.renderTrigger) {
    setTimeout(lastPreview.renderTrigger, 0);
  }
}

AppRegistry.registerComponent(PREVIEW_APP_KEY, () => Preview);
