module.exports = {
  parseErrorStack: require("react-native/Libraries/Core/Devtools/parseErrorStack").default,
  AppRegistry: require("react-native/Libraries/ReactNative/AppRegistry").default,
  get LogBoxData() {
    return require("react-native/Libraries/LogBox/Data/LogBoxData");
  },
  get SceneTracker() {
    return require("react-native/Libraries/Utilities/SceneTracker").default;
  },
  get getInspectorDataForViewAtPoint() {
    return require("react-native/src/private/inspector/getInspectorDataForViewAtPoint").default;
  },
  get LoadingView() {
    return require("react-native/Libraries/Utilities/DevLoadingView").default;
  },
  get XHRInterceptor() {
    return require("react-native/src/private/inspector/XHRInterceptor").default;
  },
};