const ExpoOrientationStrategy = require("./ExpoOrientationStrategy");
const OrientationLockerStrategy = require("./OrientationLockerStrategy");
const DefaultOrientationStrategy = require("./DefaultOrientationStrategy");

/**
 * Selects the appropriate orientation strategy based on available libraries.
 * Priority order:
 * 1. Expo Screen Orientation (expo-screen-orientation)
 * 2. React Native Orientation Locker (react-native-orientation-locker)  
 * 3. Default strategy using React Native core APIs
 * 
 * Only one of the external libraries will be available at a time.
 */
const getOrientationStrategy = () => {
  if (ExpoOrientationStrategy.isStrategyAvailable()) {
    return ExpoOrientationStrategy.getStrategy();
  }

  if (OrientationLockerStrategy.isStrategyAvailable()) {
    return OrientationLockerStrategy.getStrategy();
  }
  return DefaultOrientationStrategy.getStrategy();
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
