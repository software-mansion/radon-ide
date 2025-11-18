import { assert } from "chai";
import { WebView } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { safeDescribe } from "../utils/helpers.js";
import { get } from "./setupTest.js";

safeDescribe("13 - Reload app tests", () => {
  let driver,
    appWebsocket,
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

    await managingDevicesService.prepareDevices();

    const view = new WebView();
    await view.switchBack();
  });

  beforeEach(async function () {
    await radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();
    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);

    await appManipulationService.hideExpoOverlay(appWebsocket);
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

    await appManipulationService.waitForAppToLoad();
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

    await appManipulationService.waitForAppToLoad();
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

    await appManipulationService.waitForAppToLoad();
  });

  it("should show 'Booting device' start up message", async function () {
    await elementHelperService.findAndClickElementByTag(
      "top-bar-reload-button-options-button"
    );
    await elementHelperService.findAndClickElementByTag(
      "top-bar-reload-button-option-reboot-device"
    );

    await driver.wait(async () => {
      const messageElement =
        await elementHelperService.findAndWaitForElementByTag(
          "startup-message"
        );
      assert.include(await messageElement.getText(), "Booting device");

      await appManipulationService.waitForAppToLoad();
    }, 10000);
  });
});
