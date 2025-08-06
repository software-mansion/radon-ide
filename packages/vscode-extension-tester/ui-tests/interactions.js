import { findAndWaitForElement } from "../utils/helpers.js";
import { By } from "vscode-extension-tester";

export async function openDeviceCreationModal(driver) {
  const deviceSelectButton = await findAndWaitForElement(
    driver,
    By.css('[data-test="device-select-trigger"]'),
    "Timed out waiting for 'Select device button' element"
  );
  deviceSelectButton.click();

  const manageDevicesButton = await findAndWaitForElement(
    driver,
    By.css('[data-test="manage-devices-button"]'),
    "Timed out waiting for 'Manage devices' element"
  );
  manageDevicesButton.click();

  const createNewDeviceButton = await findAndWaitForElement(
    driver,
    By.css('[data-test="create-new-device-button"]'),
    "Timed out waiting for 'Create new device' element"
  );
  createNewDeviceButton.click();
}

export async function openRadonSettingsMenu(driver) {
  const radonSettingsButton = await findAndWaitForElement(
    driver,
    By.css('[data-test="radon-settings-button"]'),
    "Timed out waiting for 'Radon settings' button"
  );
  await radonSettingsButton.click();
}

export async function fillDeviceCreationForm(driver, deviceName) {
  const deviceTypeSelect = await findAndWaitForElement(
    driver,
    By.css('[data-test="device-type-select"]'),
    "Timed out waiting for 'select device type' element"
  );
  deviceTypeSelect.click();

  const selectedDevice = await findAndWaitForElement(
    driver,
    By.css('[data-test^="device-type-select-item-"]'),
    "Timed out waiting for an element matching from devices list"
  );
  await selectedDevice.click();

  const systemImageSelect = await findAndWaitForElement(
    driver,
    By.css('[data-test="system-image-select"]'),
    "Timed out waiting for 'select system image' element"
  );
  systemImageSelect.click();

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
  deviceNameInput.clear().then(() => {
    deviceNameInput.sendKeys(deviceName);
  });
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

  const createDeviceButton = await findAndWaitForElement(
    driver,
    By.css('[data-test="create-device-button"]'),
    "Timed out waiting for 'Create device' button"
  );
  createDeviceButton.click();
}

export async function modifyDeviceName(driver, deviceName, modifiedDeviceName) {
  const deviceRenameButton = await findAndWaitForElement(
    driver,
    By.css(`[data-test="rename-device-${deviceName}"]`),
    "Timed out waiting for device edit button"
  );

  deviceRenameButton.click();
  const deviceNameInput = await findAndWaitForElement(
    driver,
    By.css('[data-test="rename-device-input"]'),
    "Timed out waiting for device name input"
  );
  await deviceNameInput.clear();
  deviceNameInput.sendKeys(modifiedDeviceName);
  const saveButton = await findAndWaitForElement(
    driver,
    By.css('[data-test="rename-device-save-button"]'),
    "Timed out waiting for device rename save button"
  );
  saveButton.click();
}

export async function deleteDevice(driver, deviceName) {
  const deviceDeleteButton = await findAndWaitForElement(
    driver,
    By.css(`[data-test="delete-button-device-${deviceName}"]`),
    "Timed out waiting for device delete button"
  );

  deviceDeleteButton.click();

  const confirmDeleteButton = await findAndWaitForElement(
    driver,
    By.css('[data-test="confirm-delete-device-button"]'),
    "Timed out waiting for confirm delete button"
  );
  confirmDeleteButton.click();
}

export async function deleteAllDevices(driver) {
  await openRadonIDEPanel(driver);
  const deviceSelectButton = await findAndWaitForElement(
    driver,
    By.css('[data-test="device-select-trigger"]'),
    "Timed out waiting for 'Select device button' element"
  );
  deviceSelectButton.click();

  const manageDevicesButton = await findAndWaitForElement(
    driver,
    By.css('[data-test="manage-devices-button"]'),
    "Timed out waiting for 'Manage devices' element"
  );
  manageDevicesButton.click();

  try {
    while (true) {
      const deviceDeleteButton = await findAndWaitForElement(
        driver,
        By.css(`[data-test^="delete-button-device-"]`),
        "Timed out waiting for device delete button"
      );

      deviceDeleteButton.click();

      const confirmDeleteButton = await findAndWaitForElement(
        driver,
        By.css('[data-test="confirm-delete-device-button"]'),
        "Timed out waiting for confirm delete button"
      );
      confirmDeleteButton.click();
    }
  } catch (e) {}
}
