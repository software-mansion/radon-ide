import { WebView, By, Key } from "vscode-extension-tester";
import { assert } from "chai";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";
import { getAppWebsocket } from "../server/webSocketServer.js";

describe("Device Settings", () => {
  let driver,
    appWebsocket,
    view,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService;

  before(async () => {
    ({ driver, view } = get());

    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
    } = initServices(driver));

    await managingDevicesService.deleteAllDevices();
    await managingDevicesService.addNewDevice("newDevice");
    try {
      await elementHelperService.findAndClickElementByTag(`modal-close-button`);
    } catch {}

    await appManipulationService.waitForAppToLoad();

    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async () => {
    radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);
  });

  it("should toggle device frame", async () => {
    await elementHelperService.findAndWaitForElementByTag("device-frame");

    radonViewsService.openRadonDeviceSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "device-settings-show-device-frame-switch"
    );
    driver.actions().sendKeys(Key.ESCAPE).perform();

    await elementHelperService.waitUntilElementGone(
      By.css("[data-testid='device-frame']")
    );

    radonViewsService.openRadonDeviceSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "device-settings-show-device-frame-switch"
    );
    driver.actions().sendKeys(Key.ESCAPE).perform();

    await elementHelperService.findAndWaitForElementByTag("device-frame");
  });

  it("should rotate device", async () => {
    async function rotateDevice(rotation) {
      radonViewsService.openRadonDeviceSettingsMenu();
      await elementHelperService.findAndClickElementByTag(
        "device-settings-rotate-device-menu-trigger"
      );

      // this menu shows up on hover, normal click does not work because menu disappears before click happens
      const rotationButton =
        await elementHelperService.findAndWaitForElementByTag(
          `device-settings-set-orientation-${rotation}`
        );
      await driver.executeScript("arguments[0].click();", rotationButton);

      // rotation animation
      await driver.sleep(1000);
    }

    await rotateDevice("landscape-left");

    let orientation =
      await appManipulationService.sendMessageAndWaitForResponse(
        appWebsocket,
        "getOrientation"
      );

    assert.equal(orientation.value, "landscape");

    await rotateDevice("portrait");

    orientation = await appManipulationService.sendMessageAndWaitForResponse(
      appWebsocket,
      "getOrientation"
    );

    assert.equal(orientation.value, "portrait");

    await rotateDevice("clockwise");

    orientation = await appManipulationService.sendMessageAndWaitForResponse(
      appWebsocket,
      "getOrientation"
    );

    assert.equal(orientation.value, "landscape");

    await rotateDevice("anticlockwise");

    orientation = await appManipulationService.sendMessageAndWaitForResponse(
      appWebsocket,
      "getOrientation"
    );

    assert.equal(orientation.value, "portrait");
  });

  it("should change device font size", async () => {
    async function waitForFontSizeChange(fontSize) {
      return await driver.wait(async () => {
        let newFontSize =
          await appManipulationService.sendMessageAndWaitForResponse(
            getAppWebsocket(),
            "getFontSize"
          );
        if (fontSize.value !== newFontSize.value) {
          return newFontSize;
        }
        return false;
      }, 3000);
    }

    await radonViewsService.openRadonDeviceSettingsMenu();
    let fontSize = await appManipulationService.sendMessageAndWaitForResponse(
      appWebsocket,
      "getFontSize"
    );
    await elementHelperService.findAndClickElementByTag(
      `device-settings-font-size-slider-track-dent-0`
    );

    fontSize = await waitForFontSizeChange(fontSize);

    for (let i = 1; i < 7; i++) {
      await elementHelperService.findAndClickElementByTag(
        `device-settings-font-size-slider-track-dent-${i}`
      );
      fontSize = await waitForFontSizeChange(fontSize);
    }
  });

  it("should change device appearance mode", async () => {
    await radonViewsService.openRadonDeviceSettingsMenu();

    await elementHelperService.findAndClickElementByTag(
      "device-appearance-light"
    );
    await driver.wait(async () => {
      const appearance =
        await appManipulationService.sendMessageAndWaitForResponse(
          getAppWebsocket(),
          "getColorScheme"
        );
      return appearance.value === "light";
    }, 5000);

    await elementHelperService.findAndClickElementByTag(
      "device-appearance-dark"
    );
    await driver.wait(async () => {
      const appearance =
        await appManipulationService.sendMessageAndWaitForResponse(
          getAppWebsocket(),
          "getColorScheme"
        );
      return appearance.value === "dark";
    }, 5000);
  });
});
