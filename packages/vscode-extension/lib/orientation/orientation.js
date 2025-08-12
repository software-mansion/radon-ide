const { Platform } = require("react-native");
const ExpoOrientationStrategy = require("./ExpoOrientationStrategy");
const OrientationLockerStrategy = require("./OrientationLockerStrategy");
const IosDefaultOrientationStrategy = require("./IosDefaultOrientationStrategy");
const AndroidDefaultOrientationStrategy = require("./AndroidDefaultOrientationStrategy");

/**
 * Selects the appropriate orientation strategy based on available libraries.
 * iOS Priority order:
 * 1. Expo Screen Orientation (expo-screen-orientation)
 * 2. React Native Orientation Locker (react-native-orientation-locker)
 * 3. Default strategy using React Native core APIs
 *
 * Only one of the external libraries will be available at a time.
 *
 * For android, we use default AndroidOrientationStrategy, as the API
 * provided by React Native is reliable and also fires on app start.
 */

const getOrientationStrategy = () => {
  if(Platform.OS === "android") {
    return AndroidDefaultOrientationStrategy.getStrategy();
  }

  if (ExpoOrientationStrategy) {
    return ExpoOrientationStrategy.getStrategy();
  }

  if (OrientationLockerStrategy) {
    return OrientationLockerStrategy.getStrategy();
  }

  return IosDefaultOrientationStrategy.getStrategy();
};

const orientationStrategy = getOrientationStrategy();

/**
 * Sets up orientation tracking using the selected strategy.
 * Initializes orientation state and sets up event listeners.
 *
 * @returns {Function} cleanup function to remove listeners
 */
export function setup() {
  orientationStrategy.initializeOrientationAndSendInitMessage();

  // Setup orientation listener using the strategy
  const cleanup = orientationStrategy.setupOrientationListener();

  return cleanup;
}
