import { By } from "vscode-extension-tester";
import { findAndWaitForElement } from "../utils/helpers.js";
import {
  openRadonIDEPanel,
  addNewDevice,
  modifyDeviceName,
  deleteDevice,
  deleteAllDevices,
} from "./interactions.js";
import { sharedTestLifecycle } from "./setupTest.js";

describe("Adding device tests", () => {
  const get = sharedTestLifecycle();

  after(async function () {
    const { driver } = get();
    await deleteAllDevices(driver);
  });

  it("should add device to Radon IDE", async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    const newDeviceName = `TestDevice-${Date.now()}`;

    addNewDevice(driver, newDeviceName);

    await findAndWaitForElement(
      driver,
      By.css(`[data-test="manage-devices-menu-row-device-${newDeviceName}"]`),
      `Timed out waiting for device with name: ${newDeviceName}`
    );
  });

  it("should modify device name in Radon IDE", async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    const deviceName = `TestDevice-${Date.now()}`;

    await addNewDevice(driver, deviceName);

    const modifiedDeviceName = `ModifiedDevice-${Date.now()}`;

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
    const { driver } = get();
    await openRadonIDEPanel(driver);
    const deviceName = `deviceToDelete-${Date.now()}`;
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
        `Timed out waiting for device with modified name: ${deviceName}`,
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
