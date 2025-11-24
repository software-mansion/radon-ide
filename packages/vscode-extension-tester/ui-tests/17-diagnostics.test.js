import { exec, execSync } from "child_process";
import * as fs from "fs";
import { WebView, EditorView } from "vscode-extension-tester";
import { assert } from "chai";
import initServices from "../services/index.js";
import { safeDescribe } from "../utils/helpers.js";
import { get } from "./setupTest.js";

safeDescribe("17 - Diagnostics tests", () => {
  let driver, elementHelperService, radonViewsService, managingDevicesService;

  before(async () => {
    driver = get().driver;

    ({ elementHelperService, radonViewsService, managingDevicesService } =
      initServices(driver));

    await managingDevicesService.deleteAllDevices();
    const view = new WebView();
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
      const errorElement = await elementHelperService.findAndClickElementByTag(
        `diagnostic-error-${name}`
      );
      assert.equal(
        await errorElement.getText(),
        errorMessage,
        `Error message for ${name} is not correct`
      );
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

  it("should show correct diagnostic for pods", async function () {
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

  it("should show correct diagnostic for ios", async function () {
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

  it("should show correct diagnostic for android", async function () {
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
  });

  it("should show correct diagnostic for cocoapods", async function () {
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
  });

  // it("should show correct diagnostic for react-native", async function () {
  //   const reactNativeVersion = getPackageVersion("react-native");
  //   await testDiagnostic(
  //     "reactNative",
  //     async () => {
  //       execSync("npm uninstall react-native");
  //       execSync("npm uninstall @react-native/new-app-screen");
  //       execSync("npm install");
  //     },
  //     async () => {
  //       execSync(`npm install react-native@${reactNativeVersion}`);
  //       execSync("npm install @react-native/new-app-screen");
  //       execSync("npm install");
  //     },
  //     `React Native was not found. Make sure to install React Native.`
  //   );
  // });
});
