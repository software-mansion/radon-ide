import { execSync } from "child_process";
import { WebView, EditorView } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { safeDescribe } from "../utils/helpers.js";
import { get } from "./setupTest.js";
import { assert } from "chai";

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

  it("should correct node diagnostic", async function () {
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

  it("should correct npm diagnostic", async function () {
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

  it("should correct node_modules diagnostic", async function () {
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

  it("should correct pods diagnostic", async function () {
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

  it("should correct ios diagnostic", async function () {
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

  it("should correct android diagnostic", async function () {
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
});
