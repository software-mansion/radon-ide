module.exports = {
  parseErrorStack: require("__REACT_NATIVE_INTERNALS__/Libraries/Core/Devtools/parseErrorStack"),
  get LogBoxData() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/LogBox/Data/LogBoxData");
  },
  get SceneTracker() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/Utilities/SceneTracker");
  },
  get getInspectorDataForViewAtPoint() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/Inspector/getInspectorDataForViewAtPoint");
  },
  get LoadingView() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/Utilities/DevLoadingView");
  },
  get XHRInterceptor() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/Network/XHRInterceptor");
  },
  get FabricUIManager() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/ReactNative/FabricUIManager");
  },
};
