import {
  findAndWaitForElement,
  findAndClickElementByTag,
} from "../utils/helpers.js";
import { By } from "vscode-extension-tester";

export async function openDeviceCreationModal(driver) {
  await findAndClickElementByTag(driver, "device-select-trigger");

  await findAndClickElementByTag(driver, "manage-devices-button");

  await findAndClickElementByTag(driver, "create-new-device-button");
}

export async function openRadonSettingsMenu(driver) {
  await findAndClickElementByTag(driver, "radon-settings-button");
}

export async function fillDeviceCreationForm(driver, deviceName) {
  await findAndClickElementByTag(driver, "device-type-select");

  const selectedDevice = await findAndWaitForElement(
    driver,
    By.css('[data-test^="device-type-select-item-"]'),
    "Timed out waiting for an element matching from devices list"
  );
  await selectedDevice.click();

  await findAndClickElementByTag(driver, "system-image-select");

  const selectedSystemImage = await findAndWaitForElement(
    driver,
    By.css('[data-test^="system-image-select-item-"]'),
    "Timed out waiting for an element matching from system image list"
  );
  await selectedSystemImage.click();

  const deviceNameInput = await findAndWaitForElement(
    driver,
    By.css('[data-test="device-name-input"]'),
    "Timed out waiting for an element matching from system image list"
  );
  await deviceNameInput.clear();
  await driver.wait(async () => {
    const value = await deviceNameInput.getAttribute("value");
    return value === "";
  }, 1000);
  deviceNameInput.sendKeys(deviceName);
}

export async function openRadonIDEPanel(driver) {
  await driver.findElement(By.css("div#swmansion\\.react-native-ide")).click();

  const webview = await findAndWaitForElement(
    driver,
    By.css('iframe[class*="webview"]'),
    "Timed out waiting for Radon IDE webview"
  );
  await driver.switchTo().frame(webview);

  const iframe = await findAndWaitForElement(
    driver,
    By.css('iframe[title="Radon IDE"]'),
    "Timed out waiting for Radon IDE iframe"
  );
  await driver.switchTo().frame(iframe);
}

export async function addNewDevice(driver, newDeviceName) {
  await openDeviceCreationModal(driver);

  await fillDeviceCreationForm(driver, newDeviceName);

  await findAndClickElementByTag(driver, "create-device-button");
}

export async function modifyDeviceName(driver, deviceName, modifiedDeviceName) {
  await findAndClickElementByTag(driver, `rename-device-${deviceName}`);

  const deviceNameInput = await findAndWaitForElement(
    driver,
    By.css('[data-test="rename-device-input"]'),
    "Timed out waiting for device name input"
  );
  await deviceNameInput.clear();
  await driver.wait(async () => {
    const value = await deviceNameInput.getAttribute("value");
    return value === "";
  }, 1000);
  deviceNameInput.sendKeys(modifiedDeviceName);

  await findAndClickElementByTag(driver, `rename-device-save-button`);
}

export async function deleteDevice(driver, deviceName) {
  await findAndClickElementByTag(driver, `delete-button-device-${deviceName}`);

  await findAndClickElementByTag(driver, `confirm-delete-device-button`);
}

export async function deleteAllDevices(driver) {
  await openRadonIDEPanel(driver);
  await findAndClickElementByTag(driver, `device-select-trigger`);

  await findAndClickElementByTag(driver, `manage-devices-button`);

  try {
    while (true) {
      const deviceDeleteButton = await findAndWaitForElement(
        driver,
        By.css(`[data-test^="delete-button-device-"]`),
        "Timed out waiting for device delete button"
      );
      await deviceDeleteButton.click();

      await findAndClickElementByTag(driver, `confirm-delete-device-button`);
    }
  } catch (e) {}
}
