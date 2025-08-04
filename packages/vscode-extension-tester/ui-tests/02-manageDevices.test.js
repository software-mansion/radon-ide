import { assert } from "chai";
import { By } from "vscode-extension-tester";
import { findAndWaitForElement } from "../utils/helpers.js";
import {
  openRadonIDEPanel,
  addNewDevice,
  modifyDeviceName,
  deleteDevice,
} from "./interactions.js";
import { sharedTestLifecycle } from "./setupTest.js";

describe("Adding device tests", () => {
  const get = sharedTestLifecycle();

  it("should add device to Radon IDE", async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    const newDeviceName = `TestDevice-${Date.now()}`;

    addNewDevice(driver, newDeviceName);

    await findAndWaitForElement(
      driver,
      By.css(`[data-test="device-${newDeviceName}"]`),
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
      By.css(`[data-test="device-${modifiedDeviceName}"]`),
      `Timed out waiting for device with modified name: ${modifiedDeviceName}`
    );
  });

  it("should delete device from Radon IDE", async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);
    const deviceName = `TestDevice-${Date.now()}`;
    let deviceFound = false;

    await addNewDevice(driver, deviceName);

    await deleteDevice(driver, deviceName);

    const deviceSelectButton = await findAndWaitForElement(
      driver,
      By.css('[data-test="device-select-trigger"]'),
      "Timed out waiting for 'Select device button' element"
    );
    deviceSelectButton.click();

    try {
      await findAndWaitForElement(
        driver,
        By.css(`[data-test="device-${deviceName}"]`),
        `Timed out waiting for device with modified name: ${deviceName}`,
        5000
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
