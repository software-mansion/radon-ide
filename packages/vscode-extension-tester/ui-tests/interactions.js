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

  // By.css('[data-test^="system-image-select-item-"]') doesnt work i dont know why
  const selectedSystemImage = await findAndWaitForElement(
    driver,
    By.xpath("//*[normalize-space(text())='iOS 18.5']"),
    "Timed out waiting for an element matching from system image list"
  );
  await selectedSystemImage.click();

  const deviceNameInput = await findAndWaitForElement(
    driver,
    By.css('[data-test="device-name-input"]'),
    "Timed out waiting for an element matching from system image list"
  );
  deviceNameInput.clear();
  deviceNameInput.sendKeys(deviceName);
}

export async function openRadonIDEPanel(browser, driver, workbench) {
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
