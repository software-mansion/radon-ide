import { assert } from "chai";
import { By, WebView, EditorView, Key } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";

describe("Adding device tests", () => {
  let driver, elementHelperService, radonViewsService, managingDevicesService;

  beforeEach(async function () {
    ({ driver } = get());
    ({ elementHelperService, radonViewsService, managingDevicesService } =
      initServices(driver));
    const view = new WebView();

    await view.switchBack();
    await new EditorView().closeAllEditors();
    await managingDevicesService.deleteAllDevices();
    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  it("should add device to Radon IDE", async function () {
    await radonViewsService.openRadonIDEPanel();
    const newDeviceName = `${Date.now()}`;

    await managingDevicesService.addNewDevice(newDeviceName);

    await elementHelperService.findAndWaitForElement(
      By.css(`[data-testid="manage-devices-menu-row-device-${newDeviceName}"]`),
      `Timed out waiting for device with name: ${newDeviceName}`,
      20000
    );
  });

  it("should modify device name in Radon IDE", async function () {
    await radonViewsService.openRadonIDEPanel();
    const deviceName = `${Date.now()}`;

    await managingDevicesService.addNewDevice(deviceName);

    const modifiedDeviceName = `${Date.now()}`;

    await managingDevicesService.modifyDeviceName(
      deviceName,
      modifiedDeviceName
    );

    await elementHelperService.findAndWaitForElement(
      By.css(
        `[data-testid="manage-devices-menu-row-device-${modifiedDeviceName}"]`
      ),
      `Timed out waiting for device with modified name: ${modifiedDeviceName}`
    );
  });

  it("should delete device from Radon IDE", async function () {
    await radonViewsService.openRadonIDEPanel();
    const deviceName = `${Date.now()}`;
    let deviceFound = false;

    await managingDevicesService.addNewDevice(deviceName);

    await managingDevicesService.deleteDevice(deviceName);

    const deviceSelectButton = await elementHelperService.findAndWaitForElement(
      By.css('[data-testid="radon-bottom-bar-device-select-dropdown-trigger"]'),
      "Timed out waiting for 'Select device button' element"
    );
    deviceSelectButton.click();

    try {
      await elementHelperService.findAndWaitForElement(
        By.css(`[data-testid="manage-devices-menu-row-device-${deviceName}"]`),
        `Timed out waiting for device to delete: ${deviceName}`,
        3000
      );
      deviceFound = true;
    } catch (e) {
      deviceFound = false;
    }

    if (deviceFound) {
      throw new Error("Device was not successfully deleted.");
    }
  });

  it("should stop running device", async function () {
    await radonViewsService.openRadonIDEPanel();
    const deviceName = `${Date.now()}`;

    await managingDevicesService.addNewDevice(deviceName);
    await elementHelperService.findAndClickElementByTag("modal-close-button");
    await elementHelperService.findAndWaitForElementByTag("phone-wrapper");
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-select-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag("device-select-menu");

    await elementHelperService.findAndWaitForElementByTag(
      `device-${deviceName}`
    );

    await elementHelperService.findAndClickElementByTag("device-running-badge");
    await elementHelperService.waitUntilElementGone(
      By.css(`[data-testid="phone-wrapper"]`),
      10000,
      "Timed out waiting for phone screen to disappear"
    );
  });

  it("should switch between devices using shortcuts", async function () {
    const deviceName1 = "device1";
    const deviceName2 = "device2";
    await radonViewsService.openRadonIDEPanel();
    await managingDevicesService.addNewDevice(deviceName1);
    await elementHelperService.findAndClickElementByTag("modal-close-button");
    await managingDevicesService.addNewDevice(deviceName2);
    await elementHelperService.findAndClickElementByTag(
      `device-row-start-button-device-${deviceName2}`
    );
    const chosenDevice = await elementHelperService.findAndWaitForElementByTag(
      "device-select-value-text"
    );

    await driver.wait(async () => {
      const text = await chosenDevice.getText();
      return text === deviceName2;
    }, 5000);

    await driver
      .actions()
      .keyDown(Key.COMMAND)
      .keyDown(Key.SHIFT)
      .sendKeys("9")
      .keyUp(Key.SHIFT)
      .keyUp(Key.COMMAND)
      .perform();

    await driver.wait(async () => {
      const text = await chosenDevice.getText();
      return text === deviceName1;
    }, 5000);

    await driver
      .actions()
      .keyDown(Key.COMMAND)
      .keyDown(Key.SHIFT)
      .sendKeys("9")
      .keyUp(Key.SHIFT)
      .keyUp(Key.COMMAND)
      .perform();

    await driver.wait(async () => {
      const text = await chosenDevice.getText();
      return text === deviceName2;
    }, 5000);
  });
});
