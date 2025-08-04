const { Dimensions, AppState } = require("react-native");
const inspectorBridge = require("./inspector_bridge");

let currentIsAppStateActive = true;
let currentIsEdgeToEdge = true;
let lastEstablishedAvailability = null;

const updateAvailabilityAndSendMessage = () => {
  const availability = currentIsAppStateActive && currentIsEdgeToEdge;

  if (availability !== lastEstablishedAvailability) {
    lastEstablishedAvailability = availability;
    inspectorBridge.sendMessage({
      type: "inspectorAvailabilityChanged",
      data: availability,
    });
  }
};

// Fire additionally on Dimensions change because of iOS "lag" issue described
// in the above context.
const handleDimensionsChange = () => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");
  const { width: windowWidth, height: windowHeight } = Dimensions.get("window");
  currentIsEdgeToEdge = screenWidth === windowWidth && screenHeight === windowHeight;
  updateAvailabilityAndSendMessage();
};

const handleAppStateChange = (appState) => {
  currentIsAppStateActive = appState === "active";
  updateAvailabilityAndSendMessage();
};

const initializeInspectorAvailability = () => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");
  const { width: windowWidth, height: windowHeight } = Dimensions.get("window");
  currentIsEdgeToEdge = screenWidth === windowWidth && screenHeight === windowHeight;
  currentIsAppStateActive = AppState.currentState === "active";
  updateAvailabilityAndSendMessage();
};

export function setup() {
  initializeInspectorAvailability();

  const dimensionEventSubscription = Dimensions.addEventListener("change", handleDimensionsChange);
  const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

  return function cleanup() {
    if (dimensionEventSubscription) {
      dimensionEventSubscription.remove();
    }
    if (appStateSubscription) {
      appStateSubscription.remove();
    }
  };
}
