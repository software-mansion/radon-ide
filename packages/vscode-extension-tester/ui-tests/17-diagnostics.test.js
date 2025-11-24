import { execSync } from "child_process";
import path from "path";
import * as fs from "fs";
import { WebView, EditorView } from "vscode-extension-tester";
import { assert } from "chai";
import initServices from "../services/index.js";
import { safeDescribe, itIf } from "../utils/helpers.js";
import { get } from "./setupTest.js";

const raw = fs.readFileSync("./data/react-native-app/package.json");
const data = JSON.parse(raw);
const IS_EXPO = data.name.includes("expo");

safeDescribe("17 - Diagnostics tests", () => {
  let driver;
  let {
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService,
  } = initServices();

  before(async () => {
    driver = get().driver;

    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
    } = initServices(driver));

    await managingDevicesService.prepareDevices();
    await appManipulationService.waitForAppToLoad();

    let view = new WebView();
    await view.switchBack();

    await managingDevicesService.deleteAllDevices();
    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  beforeEach(async function () {
    ({ driver } = get());
    await radonViewsService.openRadonIDEPanel();
    await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-settings-dropdown-trigger"
    );
    await radonViewsService.openRadonSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "settings-dropdown-run-diagnostics-button"
    );

    await elementHelperService.findAndWaitForElementByTag("diagnostics-view");
  });

  async function testDiagnostic(
    name,
    damageFunction,
    fixFunction,
    errorMessage
  ) {
    await elementHelperService.findAndWaitForElementByTag(
      `diagnostic-icon-${name}-installed`
    );
    await damageFunction();
    try {
      await elementHelperService.findAndClickElementByTag(
        "rerun-diagnostics-button"
      );
      console.log(`Testing ${name} diagnostic`);
      await elementHelperService.findAndWaitForElementByTag(
        `diagnostic-icon-${name}-notInstalled`
      );
      if (errorMessage) {
        const errorElement =
          await elementHelperService.findAndClickElementByTag(
            `diagnostic-error-${name}`
          );
        assert.equal(
          await errorElement.getText(),
          errorMessage,
          `Error message for ${name} is not correct`
        );
      }
    } finally {
      await fixFunction();
      await elementHelperService.findAndClickElementByTag(
        "rerun-diagnostics-button"
      );
      await elementHelperService.findAndWaitForElementByTag(
        `diagnostic-icon-${name}-installed`
      );
    }
  }

  function getPackageVersion(packageName) {
    const packageJson = JSON.parse(
      fs.readFileSync("./data/react-native-app/package.json", "utf8")
    );
    if (!packageJson.dependencies || !packageJson.dependencies[packageName]) {
      throw new Error(`${packageName} not found in dependencies`);
    }
    return packageJson.dependencies[packageName];
  }

  it("should show correct diagnostic for node", async function () {
    await testDiagnostic(
      "nodejs",
      async () => {
        execSync("brew unlink node");
      },
      async () => {
        execSync("brew link node");
      },
      `Node.js was not found, or the version in the PATH does not satisfy minimum version requirements. You can find more information in our documentation.`
    );
  });

  it("should show correct diagnostic for npm", async function () {
    await testDiagnostic(
      "packageManager",
      async () => {
        execSync("rm /opt/homebrew/bin/npm");
      },
      async () => {
        execSync("brew unlink node && brew link node");
      },
      `Package manager not found or uninstalled. Make sure to install the package manager used in the project.`
    );
  });

  it("should show correct diagnostic for node_modules", async function () {
    await testDiagnostic(
      "nodeModules",
      async () => {
        execSync(
          "mv ./data/react-native-app/node_modules ./data/react-native-app/not_node_modules"
        );
      },
      async () => {
        execSync(
          "mv ./data/react-native-app/not_node_modules ./data/react-native-app/node_modules"
        );
      },
      `Node modules are not installed.`
    );
  });

  itIf(!IS_EXPO, "should show correct diagnostic for pods", async function () {
    await testDiagnostic(
      "pods",
      async () => {
        execSync(
          "mv ./data/react-native-app/ios/Pods ./data/react-native-app/ios/not_Pods"
        );
      },
      async () => {
        execSync(
          "mv ./data/react-native-app/ios/not_Pods ./data/react-native-app/ios/Pods"
        );
      },
      `Pods are not installed.`
    );
  });

  itIf(!IS_EXPO, "should show correct diagnostic for ios", async function () {
    await testDiagnostic(
      "ios",
      async () => {
        execSync(
          "mv ./data/react-native-app/ios ./data/react-native-app/not_ios"
        );
      },
      async () => {
        execSync(
          "mv ./data/react-native-app/not_ios ./data/react-native-app/ios"
        );
      },
      `"ios" directory does not exist in the main application directory`
    );
  });

  itIf(
    !IS_EXPO,
    "should show correct diagnostic for android",
    async function () {
      await testDiagnostic(
        "android",
        async () => {
          execSync(
            "mv ./data/react-native-app/android ./data/react-native-app/not_android"
          );
        },
        async () => {
          execSync(
            "mv ./data/react-native-app/not_android ./data/react-native-app/android"
          );
        },
        `"android" directory does not exist in the main application directory`
      );
    }
  );

  itIf(
    !IS_EXPO,
    "should show correct diagnostic for cocoapods",
    async function () {
      await testDiagnostic(
        "cocoaPods",
        async () => {
          execSync("brew unlink cocoapods");
          execSync(
            "mv ./data/react-native-app/Gemfile ./data/react-native-app/not_Gemfile"
          );
        },
        async () => {
          execSync("brew link cocoapods");
          execSync(
            "mv ./data/react-native-app/not_Gemfile ./data/react-native-app/Gemfile"
          );
        },
        `CocoaPods was not found. Make sure to install CocoaPods.`
      );
    }
  );

  itIf(
    !IS_EXPO,
    "should show correct diagnostic for react-native",
    async function () {
      const reactNativeVersion = getPackageVersion("react-native");
      const targetDir = path.join(process.cwd(), "data", "react-native-app");
      await testDiagnostic(
        "reactNative",
        async () => {
          execSync("npm uninstall react-native", { cwd: targetDir });
          execSync("npm uninstall @react-native/new-app-screen", {
            cwd: targetDir,
          });
        },
        async () => {
          execSync(`npm install react-native@${reactNativeVersion}`, {
            cwd: targetDir,
          });
          execSync("npm install @react-native/new-app-screen", {
            cwd: targetDir,
          });
        },
        `React Native is not installed or it is older than supported version 0.71.0.`
      );
    }
  );

  itIf(IS_EXPO, "should show correct diagnostic for expo", async function () {
    const targetDir = path.join(process.cwd(), "data", "react-native-app");
    const packageJsonPath = path.join(targetDir, "package.json");
    const originalPackageJson = fs.readFileSync(packageJsonPath, "utf8");

    await testDiagnostic(
      "expo",
      async () => {
        const packageData = JSON.parse(originalPackageJson);

        const filterDeps = (deps) => {
          if (!deps) return {};
          const newDeps = {};
          Object.keys(deps).forEach((key) => {
            if (!key.startsWith("expo") && !key.startsWith("@expo")) {
              newDeps[key] = deps[key];
            }
          });
          return newDeps;
        };

        if (packageData.dependencies) {
          packageData.dependencies = filterDeps(packageData.dependencies);
        }
        if (packageData.devDependencies) {
          packageData.devDependencies = filterDeps(packageData.devDependencies);
        }

        fs.writeFileSync(packageJsonPath, JSON.stringify(packageData, null, 2));
        execSync("npm install", { cwd: targetDir, stdio: "inherit" });
      },
      async () => {
        if (originalPackageJson) {
          fs.writeFileSync(packageJsonPath, originalPackageJson);
          execSync("npm install", { cwd: targetDir, stdio: "inherit" });
        }
      }
    );
  });

  itIf(
    IS_EXPO,
    "should show correct diagnostic for expo-router",
    async function () {
      const targetDir = path.join(process.cwd(), "data", "react-native-app");
      const packageJsonPath = path.join(targetDir, "package.json");
      const originalPackageJson = fs.readFileSync(packageJsonPath, "utf8");
      await testDiagnostic(
        "expoRouter",
        async () => {
          execSync("npm uninstall expo-router", { cwd: targetDir });
        },
        async () => {
          if (originalPackageJson) {
            fs.writeFileSync(packageJsonPath, originalPackageJson);
            execSync("npm install", { cwd: targetDir, stdio: "inherit" });
          }
        }
      );
    }
  );
});
