import { assert } from "chai";
import { WebView } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";

describe("13 - Reload app tests", () => {
  let driver,
    radonViewsService,
    appManipulationService,
    elementHelperService,
    managingDevicesService;

  before(async () => {
    driver = get().driver;
    ({
      radonViewsService,
      appManipulationService,
      elementHelperService,
      managingDevicesService,
    } = initServices(driver));

    await managingDevicesService.deleteAllDevices();
    await managingDevicesService.addNewDevice("newDevice");
    try {
      await elementHelperService.findAndClickElementByTag(`modal-close-button`);
    } catch {}

    const view = new WebView();
    await view.switchBack();
  });

  beforeEach(async function () {
    await radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();
  });

  it("should show 'Waiting for app to load' start up message", async function () {
    await elementHelperService.findAndClickElementByTag(
      "top-bar-reload-button-options-button"
    );
    await elementHelperService.findAndClickElementByTag(
      "top-bar-reload-button-option-reload-js"
    );
    const messageElement =
      await elementHelperService.findAndWaitForElementByTag("startup-message");
    assert.include(await messageElement.getText(), "Waiting for app to load");
  });

  it("should show 'Launching' start up message", async function () {
    await elementHelperService.findAndClickElementByTag(
      "top-bar-reload-button-options-button"
    );
    await elementHelperService.findAndClickElementByTag(
      "top-bar-reload-button-option-restart-app-process"
    );
    const messageElement =
      await elementHelperService.findAndWaitForElementByTag("startup-message");
    assert.include(await messageElement.getText(), "Launching");
  });

  it("should show 'Installing' start up message", async function () {
    await elementHelperService.findAndClickElementByTag(
      "top-bar-reload-button-options-button"
    );
    await elementHelperService.findAndClickElementByTag(
      "top-bar-reload-button-option-reinstall-app"
    );
    const messageElement =
      await elementHelperService.findAndWaitForElementByTag("startup-message");
    assert.include(await messageElement.getText(), "Installing");
  });

  it("should show 'Booting device' start up message", async function () {
    await elementHelperService.findAndClickElementByTag(
      "top-bar-reload-button-options-button"
    );
    await elementHelperService.findAndClickElementByTag(
      "top-bar-reload-button-option-reboot-device"
    );
    const messageElement =
      await elementHelperService.findAndWaitForElementByTag("startup-message");
    assert.include(await messageElement.getText(), "Booting device");
  });
});
