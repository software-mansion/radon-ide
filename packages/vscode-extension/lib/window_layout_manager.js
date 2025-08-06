const { Dimensions, Platform } = require("react-native");

// This manager exists solely due to the fact that Dimensions API is bugged on iPads since
// around 2020 and has yet to be fixed. See link below:
// https://github.com/facebook/react-native/issues/29290
// In order to provide a reliable way to get window dimensions across the lib,
// we use the onLayout event of the main view wrapper to determine dimension changes
// and synchronize them across the lib components, as well as getting proper window dimensions.

// The manager also provides a compatibility getScreenDimensionsCompat() method, which
// on ipads returns the same dimensions as getWindowDimensions() to avoid affecting the
// already-working part of the codebase that uses Dimensions.get("screen") when called on
// devices other than ipads.

/**
 * WindowDimensionsManager - Simplified dimensions change event manager
 * Provides means to get proper window dimensions across the lib, due to the fact
 * that Dimensions API is bugged and not reliable on iPads. Instead, the manager
 * uses the onLayout event of the main view wrapper to determine dimension changes
 * and synchronize them across the lib components.
 */
class WindowDimensionsManager {
  constructor() {
    this.dimensionsListeners = [];
    // Initialize with current window dimensions - before first dimension change
    // Dimensions.get() seems to return the proper dimensions of the window
    const { width, height } = Dimensions.get("window");
    this.currentWindowDimensions = { width, height };
  }

  /**
   * Emit dimenions change event with {width, height} of the window
   * @param {Object} dimensionEventProps - {width, height} of the window
   */
  emitDimensionsChange(dimensionEventProps) {
    this.currentWindowDimensions = dimensionEventProps;

    // Notify all listeners
    this.dimensionsListeners.forEach((callback) => {
      try {
        callback(dimensionEventProps);
      } catch (error) {
        console.error("Error in dimension change listener:", error);
      }
    });
  }

  /**
   * Get the current window dimensions
   * @returns {Object} Current window dimensions
   */
  getWindowDimensions() {
    return this.currentWindowDimensions;
  }

  /**
   * Get the current screen dimensions if available
   * On iPads, the function works exactly as getWindowDimensions(),
   * due to the fact that Dimensions.get("screen") is bugged on iPads.
   * @returns {Object} Current screen dimensions (window dimensions on iPads)
   */
  getScreenDimensionsCompat() {
    if (Platform.isPad) {
      return this.getWindowDimensions();
    }
    const { width, height } = Dimensions.get("screen");
    return { width, height };
  }

  /**
   * Add listener for dimensions changes - returns a subscription object with remove() method
   * @param {Function} callback - Callback function to handle dimensions change events
   * @returns {Object} Subscription object with remove() method
   */
  addListener(callback) {
    this.dimensionsListeners.push(callback);

    return {
      remove: () => {
        this.dimensionsListeners = this.dimensionsListeners.filter(
          (listener) => listener !== callback
        );
      },
    };
  }

  /**
   * Remove all listeners
   */
  removeAllListeners() {
    this.dimensionsListeners = [];
  }
}

// Singleton instance of WindowDimensionsManager used across lib
const windowDimensionsManager = new WindowDimensionsManager();

module.exports = windowDimensionsManager;
