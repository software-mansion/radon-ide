import { ElementHelperService } from "../utils/helpers.js";
import { RadonViewsService, ManagingDevicesService } from "./interactions.js";
import { WebView, EditorView } from "vscode-extension-tester";

import { get } from "./setupTest.js";

describe("Main interface buttons tests", () => {
  let driver, elementHelperService, radonViewsService, managingDevicesService;

  before(async () => {
    driver = get().driver;
    elementHelperService = new ElementHelperService(driver);
    radonViewsService = new RadonViewsService(driver);
    managingDevicesService = new ManagingDevicesService(driver);
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
  });

  it("Should open device settings window", async function () {
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-settings-dropdown-trigger"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "device-settings-dropdown-menu"
    );
  });

  it("Should open radon settings window", async function () {
    await radonViewsService.openRadonSettingsMenu();

    await elementHelperService.findAndWaitForElementByTag(
      "radon-settings-dropdown-menu"
    );
  });

  it("Should open diagnostics window", async function () {
    await radonViewsService.openRadonSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "settings-dropdown-run-diagnostics-button"
    );

    await elementHelperService.findAndWaitForElementByTag("diagnostics-view");
  });

  it("Should open manage devices window", async function () {
    await radonViewsService.openRadonSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "settings-dropdown-manage-devices-button"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "manage-devices-view"
    );
  });

  it("Should open send feedback window", async function () {
    await radonViewsService.openRadonSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-send-feedback-button"
    );
    await elementHelperService.findAndWaitForElementByTag("feedback-view");
  });

  it("Should open radon tools window", async function () {
    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
  });

  it("Should open radon select device menu", async function () {
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-select-dropdown-trigger"
    );

    await elementHelperService.findAndWaitForElementByTag("device-select-menu");
  });

  it("Should open radon select approot menu", async function () {
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-approot-select-dropdown-trigger"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "approot-select-dropdown-content"
    );
  });
});
