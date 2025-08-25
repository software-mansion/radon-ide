export const paths = {
  projectPath: "../data/react-native-app",
};

export const texts = {
  pageTitle: paths.projectPath.split("/").pop(),
  expectedProjectName: process.env.PROJECT_NAME
    ? process.env.PROJECT_NAME.replace(/[-_]/g, "")
    : "reactNative77",
};
