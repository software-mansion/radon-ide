import {
  findAndWaitForElement,
  findAndClickElementByTag,
  waitUntilElementGone,
  findAndWaitForElementByTag,
} from "../utils/helpers.js";
import { waitForMessage } from "./setupTest.js";
import { By, WebView, Key } from "vscode-extension-tester";

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
  await driver.wait(async () => {
    try {
      await driver.findElement(By.css("[data-test=vscode-progress-ring]"));
    } catch {
      return true;
    }
    return false;
  });
}
export async function openRadonSettingsMenu(driver) {
  await findAndClickElementByTag(
    driver,
    "radon-top-bar-settings-dropdown-trigger"
  );
}
export async function openRadonDeviceSettingsMenu(driver) {
  await findAndClickElementByTag(
    driver,
    "radon-bottom-bar-device-settings-dropdown-trigger"
  );
}
export async function openAndGetDebugConsoleElement(driver) {
  await findAndClickElementByTag(driver, `radon-top-bar-debug-console-button`);

  // without this delay function above does not open debug window
  await driver.sleep(1000);
  await driver.switchTo().defaultContent();
  const debugConsole = await findAndWaitForElement(
    driver,
    // vscode sets this id
    By.css(`#workbench\\.panel\\.repl`),
    "Timed out waiting for debug console"
  );

  return debugConsole;
}
export async function clickOnSourceInDebugConsole(debugConsole, textPattern) {
  const outputLine = await debugConsole.findElement(
    By.xpath(`//span[contains(text(), '${textPattern}')]/ancestor::div[1]`)
  );

  const source = await outputLine.findElement(By.css(".source"));
  const [file, lineNumber] = (await source.getText()).split(":");
  await source.click();
  return { file, lineNumber };
}
//#endregion

// #region Radon settings
export async function toggleShowTouches(driver) {
  await findAndClickElementByTag(
    driver,
    "radon-bottom-bar-device-settings-dropdown-trigger"
  );
  await findAndClickElementByTag(driver, "device-settings-show-touches-switch");
  driver.actions().sendKeys(Key.ESCAPE).perform();
}
// #endregion

// #region Managing devices
// #region Adding devices
export async function openDeviceCreationModal(driver) {
  const dropdownButton = await findAndWaitForElementByTag(
    driver,
    "radon-bottom-bar-device-select-dropdown-trigger"
  );

  await driver.wait(async () => {
    return await dropdownButton.isEnabled();
  });

  dropdownButton.click();

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
  await deviceNameInput.sendKeys(Key.chord(Key.COMMAND, "a"));
  deviceNameInput.clear();
  await driver.wait(async () => {
    return (await deviceNameInput.getAttribute("value")) === "";
  });
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
  findAndClickElementByTag(driver, `modal-close-button`);
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

  deviceNameInput.click();
  await deviceNameInput.sendKeys(Key.chord(Key.COMMAND, "a"), Key.BACK_SPACE);
  await deviceNameInput.clear();
  await driver.wait(async () => {
    return (await deviceNameInput.getAttribute("value")) === "";
  });
  await deviceNameInput.sendKeys(modifiedDeviceName);

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
        `Timed out waiting for Radon IDE iframe with title ${iframeTitle}`,
        5000
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
  while ((await quickInput.getAttribute("value")).length > 0) {
    await quickInput.sendKeys(Key.BACK_SPACE);
    await quickInput.sendKeys(Key.DELETE);
  }
  await quickInput.sendKeys("~");
  await quickInput.sendKeys(filename, Key.ENTER);
}
// #region App manipulation

export async function waitForAppToLoad(driver) {
  await driver.wait(
    async () => {
      try {
        const el = await driver.findElement(
          By.css('[data-test="phone-screen"]')
        );
        if (await el.isDisplayed()) {
          return el;
        }
      } catch {}

      try {
        const popup = await driver.findElement(
          By.css('[data-test="alert-dialog-content"]')
        );
        if (await popup.isDisplayed()) {
          findAndClickElementByTag(driver, "alert-open-logs-button");
          return popup;
        }
      } catch {}

      return false;
    },
    600000,
    "Timed out waiting for phone-screen"
  );
}

export async function clickInsidePhoneScreen(driver, position) {
  const phoneScreen = await findAndWaitForElement(
    driver,
    By.css(`[data-test="phone-screen"]`),
    "Timed out waiting for phone-screen"
  );

  const rect = await phoneScreen.getRect();
  const phoneWidth = rect.width;
  const phoneHeight = rect.height;

  const actions = driver.actions({ bridge: true });
  await actions
    .move({
      // origin is center of phoneScreen
      origin: phoneScreen,
      x: Math.floor((position.x + position.width / 2) * phoneWidth),
      y: Math.floor((position.y + position.height / 2) * phoneHeight),
    })
    // .click() method does not trigger show touch on phone screen
    .press()
    .pause(250)
    .release()
    .perform();
}

export async function getButtonCoordinates(appWebsocket, buttonID) {
  const messagePromise = waitForMessage();
  appWebsocket.send(`getPosition:${buttonID}`);
  const position = await messagePromise;

  if (!position) {
    throw new Error("No position received from getPosition");
  }

  return position;
}

// #endregion
