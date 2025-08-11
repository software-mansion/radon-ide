const { Dimensions, AppState, Platform } = require("react-native");
const inspectorBridge = require("./inspector_bridge");
const DimensionsObserver = require("./dimensions_observer");

// Below module is used to determine whether we should make
// inspector-and-alike overlays available, as they exhibit
// unexpected behavior when the app is not edge-to-edge, because
// of margins, which are unavailable to fetch using react-native API.

// epsilon for dimensions comparison, needed for some cases of Android devices
// where the screen (Dimensions API) and window (ifnotmation from main View layout)
// dimensions are differ on the 5th decimal place (for unknown reason)
// This value is chosen empirically until information about this behavior is found
const eps = 1;

const INSPECTOR_AVAILABLE_STATUS = "available";
const INSPECTOR_UNAVAILABLE_EDGE_TO_EDGE_STATUS = "unavailableEdgeToEdge";
const INSPECTOR_UNAVAILABLE_INACTIVE_STATUS = "unavailableInactive";

let isAppStateActive = true;
let isEdgeToEdge = true;
let isFocused = true;
let lastEstablishedAvailability = null;

const determineIfEdgeToEdge = () => {
  // Because of Dimensions API being bugged on iPads (dimensions change "lags"
  // behind one event firing), we have to find a way to properly compare the
  // screen and window dimensions. Additionally, Dimensions API is not reliable
  // on iPads when the app is in split mode.

  // We compare the greater and lesser dimensions to use in predicates because:
  // - if the aspect ratio (width/height) is greater or lesser than 1 in both cases,
  //   it means we are properly comparing the corresponding screen dimensions
  // - if the aspect ratio is different, that means one of the Windows dimensions will
  //   will always be lesser than screen dimension, as the aspect ratio has to remain constant
  //   it means that, for there to be an equality, one of the Window dimensions would have
  //   to be greater than the screen dimension, which is not physically possible

  // IPAD ISSUE:
  // This way of determining the edge-to-edge availability does not work on iPads when
  // Stage Manager is used for React Native before version 77 - windowWidth and windowHeight
  // will always be equal to the screenWidth and screenHeight, the onLayout event does not
  // register the layout change properly.
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");
  const { width: windowWidth, height: windowHeight } = DimensionsObserver.getWindowDimensions();

  const { screenGreater, screenLesser } =
    screenWidth > screenHeight
      ? { screenGreater: screenWidth, screenLesser: screenHeight }
      : { screenGreater: screenHeight, screenLesser: screenWidth };
  const { windowGreater, windowLesser } =
    windowWidth > windowHeight
      ? { windowGreater: windowWidth, windowLesser: windowHeight }
      : { windowGreater: windowHeight, windowLesser: windowWidth };

  return (
    Math.abs(screenGreater - windowGreater) <= eps && Math.abs(screenLesser - windowLesser) <= eps
  );
};

const updateAvailabilityAndSendMessage = () => {
  let availabilityStatus = INSPECTOR_AVAILABLE_STATUS;
  if (!isEdgeToEdge) {
    availabilityStatus = INSPECTOR_UNAVAILABLE_EDGE_TO_EDGE_STATUS;
  }
  if (!isAppStateActive || !isFocused) {
    availabilityStatus = INSPECTOR_UNAVAILABLE_INACTIVE_STATUS;
  }

  if (availabilityStatus !== lastEstablishedAvailability) {
    lastEstablishedAvailability = availabilityStatus;
    inspectorBridge.sendMessage({
      type: "inspectorAvailabilityChanged",
      data: availabilityStatus,
    });
  }
};

const initializeInspectorAvailability = () => {
  isEdgeToEdge = determineIfEdgeToEdge();
  isAppStateActive = AppState.currentState === "active";
  updateAvailabilityAndSendMessage();
};

export function setup() {
  initializeInspectorAvailability();

  // Define callbacks inside the setup, in order for dimensionsObserver to be able
  // to properly differentiate between created functions
  const handleDimensionsChange = () => {
    isEdgeToEdge = determineIfEdgeToEdge();
    updateAvailabilityAndSendMessage();
  };

  const handleAppStateChange = (appState) => {
    isAppStateActive = appState === "active";
    updateAvailabilityAndSendMessage();
  };

  const handleBlurChange = () => {
    isFocused = false;
    updateAvailabilityAndSendMessage();
  };

  const handleFocusChange = () => {
    isFocused = true;
    updateAvailabilityAndSendMessage();
  };

  let appBlurSubscription = null;
  let appFocusSubscription = null;

  const dimensionEventSubscription = DimensionsObserver.addListener(handleDimensionsChange);
  const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

  // iOS does not support "blur" and "focus" events on AppState

  if (Platform.OS === "android") {
    // The `focus` and `blur` events are separate from `change` event and from the app state.
    // On android the app state remains active in situations where on iPad it would become inactive -
    // that is when the app switcher is used, notification drawer is pulled, etc.
    // Upon these actions on android `blur` and `focus` events are fired, which
    // do not change the app state but allow for detecting such situations. More on that:
    // https://reactnative.dev/docs/appstate

    appBlurSubscription = AppState.addEventListener("blur", handleBlurChange);
    appFocusSubscription = AppState.addEventListener("focus", handleFocusChange);
  }

  return function cleanup() {
    if (dimensionEventSubscription) {
      dimensionEventSubscription.remove();
    }
    if (appStateSubscription) {
      appStateSubscription.remove();
    }

    if (appBlurSubscription) {
      appBlurSubscription.remove();
    }
    if (appFocusSubscription) {
      appFocusSubscription.remove();
    }
  };
}
