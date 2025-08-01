import { assert } from "chai";
import { By } from "vscode-extension-tester";
import { findAndWaitForElement } from "../utils/helpers.js";
import {
  openRadonIDEPanel,
  addNewDevice,
  modifyDeviceName,
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
});
