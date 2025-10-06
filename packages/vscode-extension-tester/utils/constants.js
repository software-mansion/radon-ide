export const paths = {
  projectPath: "../data/react-native-app",
};
import * as fs from "fs";

const raw = fs.readFileSync("./data/react-native-app/package.json");
const data = JSON.parse(raw);

export const texts = {
  pageTitle: paths.projectPath.split("/").pop(),
  expectedProjectName: process.env.PROJECT_NAME
    ? process.env.PROJECT_NAME.replace(/[-_]/g, "")
    : data.name,
};
