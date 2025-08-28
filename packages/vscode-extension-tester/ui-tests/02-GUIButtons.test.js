import {
  findAndClickElementByTag,
  findAndWaitForElementByTag,
} from "../utils/helpers.js";
import {
  openRadonIDEPanel,
  openRadonSettingsMenu,
  deleteAllDevices,
} from "./interactions.js";
import { WebView, EditorView } from "vscode-extension-tester";

import { get } from "./setupTest.js";

describe("Main interface buttons tests", () => {
  let driver;

  before(async () => {
    driver = get().driver;
    await deleteAllDevices(driver);
    const view = new WebView();
    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  beforeEach(async function () {
    ({ driver } = get());
    await openRadonIDEPanel(driver);
    await findAndWaitForElementByTag(
      driver,
      "radon-top-bar-settings-dropdown-trigger"
    );
  });

  it("Should open device settings window", async function () {
    await findAndClickElementByTag(
      driver,
      "radon-bottom-bar-device-settings-dropdown-trigger"
    );

    await findAndWaitForElementByTag(driver, "device-settings-dropdown-menu");
  });

  it("Should open radon settings window", async function () {
    await openRadonSettingsMenu(driver);

    await findAndWaitForElementByTag(driver, "radon-settings-dropdown-menu");
  });

  it("Should open diagnostics window", async function () {
    await openRadonSettingsMenu(driver);
    await findAndClickElementByTag(
      driver,
      "settings-dropdown-run-diagnostics-button"
    );

    await findAndWaitForElementByTag(driver, "diagnostics-view");
  });

  it("Should open manage devices window", async function () {
    await openRadonSettingsMenu(driver);
    await findAndClickElementByTag(
      driver,
      "settings-dropdown-manage-devices-button"
    );
    await findAndWaitForElementByTag(driver, "manage-devices-view");
  });

  it("Should open send feedback window", async function () {
    await openRadonSettingsMenu(driver);
    await findAndClickElementByTag(
      driver,
      "radon-bottom-bar-send-feedback-button"
    );
    await findAndWaitForElementByTag(driver, "feedback-view");
  });

  it("Should open radon tools window", async function () {
    await findAndClickElementByTag(
      driver,
      "radon-top-bar-tools-dropdown-trigger"
    );

    await findAndWaitForElementByTag(driver, "radon-tools-dropdown-menu");
  });

  it("Should open radon select device menu", async function () {
    await findAndClickElementByTag(
      driver,
      "radon-bottom-bar-device-select-dropdown-trigger"
    );

    await findAndWaitForElementByTag(driver, "device-select-menu");
  });

  it("Should open radon select approot menu", async function () {
    await findAndClickElementByTag(
      driver,
      "radon-bottom-bar-approot-select-dropdown-trigger"
    );

    await findAndWaitForElementByTag(driver, "approot-select-dropdown-content");
  });
});
