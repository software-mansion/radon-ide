module.exports = {
  parseErrorStack: require("__REACT_NATIVE_INTERNALS__/Libraries/Core/Devtools/parseErrorStack")
    .default,
  get LogBoxData() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/LogBox/Data/LogBoxData");
  },
  get SceneTracker() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/Utilities/SceneTracker").default;
  },
  get getInspectorDataForViewAtPoint() {
    return require("__REACT_NATIVE_INTERNALS__/src/private/devsupport/devmenu/elementinspector/getInspectorDataForViewAtPoint")
      .default;
  },
  get LoadingView() {
    return require("__REACT_NATIVE_INTERNALS__/Libraries/Utilities/DevLoadingView").default;
  },
  get XHRInterceptor() {
    return require("__REACT_NATIVE_INTERNALS__/src/private/devsupport/devmenu/elementinspector/XHRInterceptor")
      .default;
  },
};
