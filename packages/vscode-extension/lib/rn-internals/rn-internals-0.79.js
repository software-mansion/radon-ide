module.exports = {
  parseErrorStack: require("__REACT_NATIVE_INTERNALS__/Libraries/Core/Devtools/parseErrorStack")
    .default,
  symbolicateStackTrace: require("__REACT_NATIVE_INTERNALS__/Libraries/Core/Devtools/symbolicateStackTrace")
    .default,
  get LogBoxData() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/LogBox/Data/LogBoxData");
  },
  get SceneTracker() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/Utilities/SceneTracker").default;
  },
  get getInspectorDataForViewAtPoint() {
    return require("__REACT_NATIVE_INTERNALS__/src/private/inspector/getInspectorDataForViewAtPoint")
      .default;
  },
  get LoadingView() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/Utilities/DevLoadingView").default;
  },
  get XHRInterceptor() {
    return require("__REACT_NATIVE_INTERNALS__/src/private/inspector/XHRInterceptor").default;
  },
  get FabricUIManager() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/ReactNative/FabricUIManager");
  },
};
