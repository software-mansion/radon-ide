module.exports = {
  get parseErrorStack() {
    return require("react-native/Libraries/Core/Devtools/parseErrorStack");
  },
  get LogBoxData() {
    return require("react-native/Libraries/LogBox/Data/LogBoxData");
  },
  get SceneTracker() {
    return require("react-native/Libraries/Utilities/SceneTracker");
  },
  get getInspectorDataForViewAtPoint() {
    return require("react-native/Libraries/Inspector/getInspectorDataForViewAtPoint");
  },
  get LoadingView() {
    return require("react-native/Libraries/Utilities/DevLoadingView");
  },
  get XHRInterceptor() {
    return require("react-native/Libraries/Network/XHRInterceptor");
  },
};