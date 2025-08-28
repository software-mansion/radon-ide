import { By, VSBrowser, WebView, EditorView } from "vscode-extension-tester";
import { findAndWaitForElement } from "../utils/helpers.js";
import {
  openRadonIDEPanel,
  addNewDevice,
  modifyDeviceName,
  deleteDevice,
  deleteAllDevices,
} from "./interactions.js";
import { get } from "./setupTest.js";

describe("Adding device tests", () => {
  let driver;

  beforeEach(async function () {
    ({ driver } = get());
    const view = new WebView();

    await view.switchBack();
    await new EditorView().closeAllEditors();
    await deleteAllDevices(driver);
    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  it("should add device to Radon IDE", async function () {
    await openRadonIDEPanel(driver);
    const newDeviceName = `${Date.now()}`;

    addNewDevice(driver, newDeviceName);

    await findAndWaitForElement(
      driver,
      By.css(`[data-test="manage-devices-menu-row-device-${newDeviceName}"]`),
      `Timed out waiting for device with name: ${newDeviceName}`,
      20000
    );
  });

  it("should modify device name in Radon IDE", async function () {
    await openRadonIDEPanel(driver);
    const deviceName = `${Date.now()}`;

    await addNewDevice(driver, deviceName);

    const modifiedDeviceName = `${Date.now()}`;

    await modifyDeviceName(driver, deviceName, modifiedDeviceName);

    await findAndWaitForElement(
      driver,
      By.css(
        `[data-test="manage-devices-menu-row-device-${modifiedDeviceName}"]`
      ),
      `Timed out waiting for device with modified name: ${modifiedDeviceName}`
    );
  });

  it("should delete device from Radon IDE", async function () {
    await openRadonIDEPanel(driver);
    const deviceName = `${Date.now()}`;
    let deviceFound = false;

    await addNewDevice(driver, deviceName);

    await deleteDevice(driver, deviceName);

    const deviceSelectButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="radon-bottom-bar-device-select-dropdown-trigger"]'),
      "Timed out waiting for 'Select device button' element"
    );
    deviceSelectButton.click();

    try {
      await findAndWaitForElement(
        driver,
        By.css(`[data-test="manage-devices-menu-row-device-${deviceName}"]`),
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
});
