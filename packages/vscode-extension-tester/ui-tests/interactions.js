import {
  findAndWaitForElement,
  findAndClickElementByTag,
  waitUntilElementGone,
} from "../utils/helpers.js";
import { By } from "vscode-extension-tester";

// #region Opening radon views
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
export async function openRadonSettingsMenu(driver) {
  await findAndClickElementByTag(
    driver,
    "radon-top-bar-settings-dropdown-trigger"
  );
}
//#endregion

// #region Managing devices
// #region Adding devices
export async function openDeviceCreationModal(driver) {
  await findAndClickElementByTag(
    driver,
    "radon-bottom-bar-device-select-dropdown-trigger"
  );

  await findAndClickElementByTag(
    driver,
    "device-select-menu-manage-devices-button"
  );

  await findAndClickElementByTag(
    driver,
    "manage-devices-menu-create-new-device-button"
  );
}

export async function fillDeviceCreationForm(driver, deviceName) {
  await findAndClickElementByTag(
    driver,
    "creating-device-form-device-type-select"
  );

  const selectedDevice = await findAndWaitForElement(
    driver,
    By.css('[data-test^="creating-device-form-device-type-select-item-"]'),
    "Timed out waiting for an element matching from devices list"
  );
  await selectedDevice.click();

  await findAndClickElementByTag(
    driver,
    "creating-device-form-system-image-select"
  );

  const selectedSystemImage = await findAndWaitForElement(
    driver,
    By.css(
      '[data-test^="creating-device-form-system-image-select-item-"]:not(.select-item-marked)'
    ),
    "Timed out waiting for an element matching from system image list"
  );
  await selectedSystemImage.click();

  const deviceNameInput = await findAndWaitForElement(
    driver,
    By.css('[data-test="creating-device-form-name-input"]'),
    "Timed out waiting for an element matching from system image list"
  );
  deviceNameInput.click();

  await driver.executeScript("arguments[0].value = '';", deviceNameInput);
  await deviceNameInput.clear();

  await driver.wait(async () => {
    const value = await deviceNameInput.getAttribute("value");
    return value === "";
  }, 3000);

  await deviceNameInput.sendKeys(deviceName);
}

export async function addNewDevice(driver, newDeviceName) {
  await openDeviceCreationModal(driver);

  await fillDeviceCreationForm(driver, newDeviceName);

  await findAndClickElementByTag(
    driver,
    "creating-device-form-confirmation-button"
  );
}
// #endregion

// #region Deleting devices
export async function deleteDevice(driver, deviceName) {
  await findAndClickElementByTag(
    driver,
    `manage-devices-menu-delete-button-device-${deviceName}`
  );

  await findAndClickElementByTag(driver, `confirm-delete-device-button`);
}

export async function deleteAllDevices(driver) {
  await openRadonIDEPanel(driver);
  await findAndClickElementByTag(
    driver,
    `radon-bottom-bar-device-select-dropdown-trigger`
  );
  await findAndClickElementByTag(
    driver,
    `device-select-menu-manage-devices-button`
  );

  try {
    while (true) {
      const deviceDeleteButton = await findAndWaitForElement(
        driver,
        By.css(`[data-test^="manage-devices-menu-delete-button-device-"]`),
        "Timed out waiting for device delete button",
        5000
      );
      await deviceDeleteButton.click();
      await findAndClickElementByTag(driver, `confirm-delete-device-button`);

      await waitUntilElementGone(
        driver,
        By.css(`[data-test="device-removing-confirmation-view"]`),
        3000,
        "delete confirmation modal did not disappear"
      );
    }
  } catch (e) {}
}
// #endregion

// #region Modifying devices
export async function modifyDeviceName(driver, deviceName, modifiedDeviceName) {
  await findAndClickElementByTag(
    driver,
    `manage-devices-menu-rename-button-device-${deviceName}`
  );

  const deviceNameInput = await findAndWaitForElement(
    driver,
    By.css('[data-test="renaming-device-view-input"]'),
    "Timed out waiting for device name input"
  );

  await driver.executeScript("arguments[0].value = '';", deviceNameInput);
  await deviceNameInput.clear();

  await driver.wait(async () => {
    const value = await deviceNameInput.getAttribute("value");
    return value === "";
  }, 3000);
  deviceNameInput.sendKeys(modifiedDeviceName);

  await findAndClickElementByTag(driver, `renaming-device-view-save-button`);
}

// #endregion
// #endregion

// #region Managing Webviews
export async function findWebViewIFrame(driver, iframeTitle) {
  await driver.switchTo().defaultContent();
  const webviews = await driver.findElements(
    By.css('iframe[class*="webview"]')
  );
  for (let webview of webviews) {
    await driver.switchTo().frame(webview);
    try {
      const iframe = await findAndWaitForElement(
        driver,
        By.css(`iframe[title="${iframeTitle}"]`),
        `Timed out waiting for Radon IDE iframe with title ${iframeTitle}`
      );
      return iframe;
    } catch (error) {
      await driver.switchTo().defaultContent();
    }
  }
  throw new Error(
    `Could not find iframe with title ${iframeTitle} in any webview`
  );
}

// #region Saving files
export async function findAndFillSaveFileForm(driver, filename) {
  await driver.switchTo().defaultContent();

  const quickInput = await findAndWaitForElement(
    driver,
    By.css(".quick-input-widget input"),
    "Timed out waiting for quick input",
    10000
  );

  await quickInput.click();
  await quickInput.sendKeys(Key.chord(Key.COMMAND, "a"), "~");
  await quickInput.sendKeys(filename, Key.ENTER);
}
// #endregion
