import * as fs from "fs";
import { assert } from "chai";
import { WebView, EditorView, Key, By } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";

function stringifySorted(obj) {
  if (typeof obj !== "object" || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return JSON.stringify(obj.map(stringifySorted));

  const sortedKeys = Object.keys(obj).sort();
  const sortedObj = {};
  for (const key of sortedKeys) {
    sortedObj[key] = obj[key];
  }
  return JSON.stringify(sortedObj);
}

const deleteLaunchConfigs = () => {
  const launchConfigsPath = "./data/react-native-app/.vscode/launch.json";

  if (fs.existsSync(launchConfigsPath)) {
    fs.unlinkSync(launchConfigsPath);
  }
};

const copyLaunchConfigs = () => {
  fs.mkdirSync("./data/react-native-app/.vscode", { recursive: true });
  fs.copyFileSync(
    "./files_for_tests/launch.json",
    "./data/react-native-app/.vscode/launch.json"
  );
};

describe("15 - Launch Configuration Tests", () => {
  let driver;
  let { elementHelperService, radonViewsService, managingDevicesService } =
    initServices(driver);

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
    deleteLaunchConfigs();
  });

  it("Should add launch configuration", async function () {
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-approot-select-dropdown-trigger"
    );

    await elementHelperService.findAndClickElementByTag(
      "add-launch-config-button"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "launch-configuration-modal"
    );

    const nameInput = await elementHelperService.findAndWaitForElementByTag(
      "launch-configuration-name-input"
    );

    await nameInput.sendKeys("testConfig");

    await elementHelperService.findAndClickElementByTag(
      "launch-configuration-modal-save-button"
    );

    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-approot-select-dropdown-trigger"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "approot-select-item-testConfig"
    );
  });

  it("Should delete launch configuration", async function () {
    copyLaunchConfigs();

    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-approot-select-dropdown-trigger"
    );

    await elementHelperService.findAndClickElementByTag(
      "edit-launch-config-button-testConfig"
    );

    await elementHelperService.findAndClickElementByTag(
      "launch-configuration-delete-button"
    );

    await elementHelperService.findAndClickElementByTag(
      "confirm-delete-launch-configuration-button"
    );
  });

  it("Should modify launch configuration", async function () {
    copyLaunchConfigs();

    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-approot-select-dropdown-trigger"
    );

    await elementHelperService.findAndClickElementByTag(
      "edit-launch-config-button-testConfig"
    );

    const nameInput = await elementHelperService.findAndWaitForElementByTag(
      "launch-configuration-name-input"
    );

    await nameInput.sendKeys(Key.chord(Key.COMMAND, "a"));
    await nameInput.sendKeys("newTestConfig");

    await elementHelperService.findAndClickElementByTag(
      "launch-configuration-modal-save-button"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "approot-select-item-newTestConfig"
    );
  });

  it("Should create correct launch configuration .json file", async function () {
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-approot-select-dropdown-trigger"
    );

    await elementHelperService.findAndClickElementByTag(
      "add-launch-config-button"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "launch-configuration-modal"
    );

    const nameInput = await elementHelperService.findAndWaitForElementByTag(
      "launch-configuration-name-input"
    );

    await nameInput.sendKeys("testConfig");

    const metroConfigPathInput =
      await elementHelperService.findAndWaitForElementByTag(
        "launch-configuration-metro-config-path-input"
      );

    await metroConfigPathInput.sendKeys("test/test");

    const useExpoSelect = await elementHelperService.findAndClickElementByTag(
      "launch-configuration-use-expo-select"
    );

    (
      await useExpoSelect.findElement(
        By.xpath(`//vscode-option[contains(text(), 'No')]`)
      )
    ).click();

    const prebuildSelect = await elementHelperService.findAndClickElementByTag(
      "launch-configuration-use-prebuild-select"
    );

    (
      await prebuildSelect.findElement(
        By.xpath(`//vscode-option[contains(text(), 'No')]`)
      )
    ).click();

    await elementHelperService.findAndClickElementByTag(
      "env-add-variable-button"
    );

    const envEditorKeyInput =
      await elementHelperService.findAndWaitForElementByTag(
        "env-editor-key-input"
      );

    await envEditorKeyInput.sendKeys("TEST_KEY");

    const envEditorValueInput =
      await elementHelperService.findAndWaitForElementByTag(
        "env-editor-value-input"
      );

    await envEditorValueInput.sendKeys("TEST_VALUE");

    await elementHelperService.findAndClickElementByTag(
      "env-editor-save-variable-button"
    );

    const iosConfigInput =
      await elementHelperService.findAndWaitForElementByTag(
        "launch-configuration-ios-configuration-input"
      );

    await iosConfigInput.sendKeys("Release");

    await elementHelperService.findAndClickElementByTag(
      "launch-configuration-android-build-settings-tab"
    );

    const androidConfigInput =
      await elementHelperService.findAndWaitForElementByTag(
        "launch-configuration-android-configuration-input"
      );

    await androidConfigInput.sendKeys("Release");
    await elementHelperService.findAndClickElementByTag(
      "launch-configuration-modal-save-button"
    );

    await driver.wait(async () => {
      return fs.existsSync("data/react-native-app/.vscode/launch.json");
    });
    const configPattern = JSON.parse(
      fs.readFileSync("files_for_tests/launch_pattern.json", "utf8")
    );
    const createdConfig = JSON.parse(
      fs.readFileSync("data/react-native-app/.vscode/launch.json", "utf8")
    );

    assert.equal(
      stringifySorted(configPattern),
      stringifySorted(createdConfig),
      "Created launch configuration file is different than expected"
    );
  });
});
