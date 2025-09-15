import { ElementHelperService } from "./helperServices.js";
import { waitForMessage } from "../server/webSocketServer.js";
import {
  By,
  Key,
  WebView,
  EditorView,
  BottomBarPanel,
  OutputView,
} from "vscode-extension-tester";
import * as fs from "fs";
import config from "../configuration.js";
import { createCanvas } from "canvas";

// #region Opening radon views
export class RadonViewsService {
  constructor(driver) {
    this.driver = driver;
    this.elementHelperService = new ElementHelperService(driver);
  }

  async openRadonIDEPanel() {
    const radonIDEButton =
      await this.elementHelperService.findAndWaitForElement(
        By.css("div#swmansion\\.react-native-ide")
      );
    await radonIDEButton.click();

    const webview = await this.elementHelperService.findAndWaitForElement(
      By.css('iframe[class*="webview"]'),
      "Timed out waiting for Radon IDE webview"
    );
    await this.driver.switchTo().frame(webview);

    const iframe = await this.elementHelperService.findAndWaitForElement(
      By.css('iframe[title="Radon IDE"]'),
      "Timed out waiting for Radon IDE iframe"
    );

    await this.driver.switchTo().frame(iframe);
    await this.driver.wait(async () => {
      try {
        await this.driver.findElement(
          By.css("[data-testid=vscode-progress-ring]")
        );
      } catch {
        return true;
      }
      return false;
    });
  }

  async switchToRadonIDEFrame() {
    this.driver.switchTo().defaultContent();
    const webview = await this.elementHelperService.findAndWaitForElement(
      By.css('iframe[class*="webview"]'),
      "Timed out waiting for Radon IDE webview"
    );
    await this.driver.switchTo().frame(webview);
    const iframe = await this.elementHelperService.findAndWaitForElement(
      By.css('iframe[title="Radon IDE"]'),
      "Timed out waiting for Radon IDE iframe"
    );

    await this.driver.switchTo().frame(iframe);
  }

  async openRadonSettingsMenu() {
    await this.elementHelperService.findAndClickElementByTag(
      "radon-top-bar-settings-dropdown-trigger"
    );
  }

  async openRadonDeviceSettingsMenu() {
    await this.elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-settings-dropdown-trigger"
    );
  }

  async openRadonToolsMenu() {
    await this.elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );

    await this.elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
  }

  async openAndGetDebugConsoleElement() {
    await this.elementHelperService.findAndClickElementByTag(
      "radon-top-bar-debug-console-button"
    );

    // without this delay function above does not open debug window
    await this.driver.sleep(1000);
    await this.driver.switchTo().defaultContent();
    const debugConsole = await this.elementHelperService.findAndWaitForElement(
      // vscode sets this id
      By.css(`#workbench\\.panel\\.repl`),
      "Timed out waiting for debug console"
    );

    return debugConsole;
  }

  async clickOnSourceInDebugConsole(debugConsole, textPattern) {
    const outputLine = await debugConsole.findElement(
      By.xpath(`//span[contains(text(), '${textPattern}')]/ancestor::div[1]`)
    );

    const source = await outputLine.findElement(By.css(".source"));
    const [file, lineNumber] = (await source.getText()).split(":");
    await source.click();
    return { file, lineNumber };
  }

  async clearDebugConsole() {
    await this.openAndGetDebugConsoleElement();
    const debugView = await new BottomBarPanel().openDebugConsoleView();
    await debugView.clearText();
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
  }

  // #region Saving files
  async findAndFillSaveFileForm(filename) {
    await this.driver.switchTo().defaultContent();

    const quickInput = await this.elementHelperService.findAndWaitForElement(
      By.css(".quick-input-widget input"),
      "Timed out waiting for quick input"
    );

    await this.driver.executeScript("arguments[0].value = '';", quickInput);

    await quickInput.sendKeys(process.cwd() + "/data/");
    await quickInput.sendKeys(filename);

    const quickInputButton =
      await this.elementHelperService.findAndWaitForElement(
        By.css(".quick-input-action"),
        "Timed out waiting for quick input button"
      );

    quickInputButton.click();
  }

  // #region WebView

  async findWebViewIFrame(iframeTitle) {
    await this.driver.switchTo().defaultContent();
    const webviews = await this.driver.findElements(
      By.css('iframe[class*="webview"]')
    );
    for (let webview of webviews) {
      await this.driver.switchTo().frame(webview);
      try {
        const iframe = await this.elementHelperService.findAndWaitForElement(
          By.css(`iframe[title="${iframeTitle}"]`),
          `Timed out waiting for Radon IDE iframe with title ${iframeTitle}`,
          5000
        );
        return iframe;
      } catch (error) {
        await this.driver.switchTo().defaultContent();
      }
    }
    throw new Error(
      `Could not find iframe with title ${iframeTitle} in any webview`
    );
  }

  async getPhoneScreenSnapshot() {
    const pixels = await this.driver.executeScript(() => {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const { data, width, height } = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );
      return { data: Array.from(data), width, height };
    });
    const canvas = createCanvas(pixels.width, pixels.height);
    const ctx = canvas.getContext("2d");

    const imageData = ctx.createImageData(pixels.width, pixels.height);
    imageData.data.set(pixels.data);
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }
}

//#endregion

// #region Radon settings
export class RadonSettingsService {
  constructor(driver) {
    this.driver = driver;
    this.elementHelperService = new ElementHelperService(driver);
  }

  async setShowTouches(value = true) {
    await this.elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-settings-dropdown-trigger"
    );

    const switchElement =
      await this.elementHelperService.findAndWaitForElementByTag(
        "device-settings-show-touches-switch"
      );
    const switchElementState =
      (await switchElement.getAttribute("data-state")) == "checked";

    if (value !== switchElementState) {
      switchElement.click();
    }
    this.driver.actions().sendKeys(Key.ESCAPE).perform();
  }

  async setEnableReplays(value = true) {
    await this.elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-settings-dropdown-trigger"
    );

    const switchElement =
      await this.elementHelperService.findAndWaitForElementByTag(
        "device-settings-enable-replays-switch"
      );
    const switchElementState =
      (await switchElement.getAttribute("data-state")) == "checked";

    if (value !== switchElementState) {
      switchElement.click();
    }
    this.driver.actions().sendKeys(Key.ESCAPE).perform();
  }
}
// #endregion

// #region Managing devices
// #region Adding devices
export class ManagingDevicesService {
  constructor(driver) {
    this.driver = driver;
    this.elementHelperService = new ElementHelperService(driver);
    this.radonViewsService = new RadonViewsService(driver);
  }

  async openDeviceCreationModal() {
    const dropdownButton =
      await this.elementHelperService.findAndWaitForElementByTag(
        "radon-bottom-bar-device-select-dropdown-trigger"
      );

    await this.driver.wait(async () => {
      return await dropdownButton.isEnabled();
    });

    dropdownButton.click();

    await this.elementHelperService.findAndClickElementByTag(
      "device-select-menu-manage-devices-button"
    );

    await this.elementHelperService.findAndClickElementByTag(
      "manage-devices-menu-create-new-device-button"
    );
  }

  async fillDeviceCreationForm(deviceName) {
    await this.elementHelperService.findAndClickElementByTag(
      "creating-device-form-device-type-select"
    );

    const device = config.isAndroid ? "pixel" : "com.apple";

    const selectedDevice =
      await this.elementHelperService.findAndWaitForElement(
        By.css(
          `[data-testid^="creating-device-form-device-type-select-item-${device}"]`
        ),
        "Timed out waiting for an element matching from devices list"
      );
    await selectedDevice.click();

    await this.elementHelperService.findAndClickElementByTag(
      "creating-device-form-system-image-select"
    );

    const selectedSystemImage =
      await this.elementHelperService.findAndWaitForElement(
        By.css(
          '[data-testid^="creating-device-form-system-image-select-item-"]:not(.select-item-marked)'
        ),
        "Timed out waiting for an element matching from system image list"
      );
    await selectedSystemImage.click();

    const deviceNameInput =
      await this.elementHelperService.findAndWaitForElement(
        By.css('[data-testid="creating-device-form-name-input"]'),
        "Timed out waiting for an element matching from system image list"
      );

    deviceNameInput.click();
    await deviceNameInput.sendKeys(Key.chord(Key.COMMAND, "a"));
    deviceNameInput.clear();
    await this.driver.wait(async () => {
      const value = await deviceNameInput.getAttribute("value");
      return value === "";
    }, 3000);
    await deviceNameInput.sendKeys(deviceName);
  }

  async addNewDevice(newDeviceName) {
    await this.openDeviceCreationModal();
    await this.fillDeviceCreationForm(newDeviceName);

    await this.elementHelperService.findAndClickElementByTag(
      "creating-device-form-confirmation-button"
    );
  }
  // #endregion

  // #region Deleting devices
  async deleteDevice(deviceName) {
    await this.elementHelperService.findAndClickElementByTag(
      `manage-devices-menu-delete-button-device-${deviceName}`
    );

    await this.elementHelperService.findAndClickElementByTag(
      `confirm-delete-device-button`
    );
  }
  async deleteAllDevices() {
    await this.radonViewsService.openRadonIDEPanel();
    await this.elementHelperService.findAndClickElementByTag(
      `radon-bottom-bar-device-select-dropdown-trigger`
    );
    await this.elementHelperService.findAndClickElementByTag(
      `device-select-menu-manage-devices-button`
    );

    try {
      while (true) {
        const deviceDeleteButton =
          await this.elementHelperService.findAndWaitForElement(
            By.css(
              `[data-testid^="manage-devices-menu-delete-button-device-"]`
            ),
            "Timed out waiting for device delete button",
            5000
          );
        await deviceDeleteButton.click();
        await this.elementHelperService.findAndClickElementByTag(
          `confirm-delete-device-button`
        );

        await this.elementHelperService.waitUntilElementGone(
          By.css(`[data-testid="device-removing-confirmation-view"]`),
          3000,
          "delete confirmation modal did not disappear"
        );
      }
    } catch (e) {}
    this.elementHelperService.findAndClickElementByTag(`modal-close-button`);
    const view = new WebView();
    await view.switchBack();
    await new EditorView().closeAllEditors();
    await this.radonViewsService.openRadonIDEPanel();
  }
  // #endregion

  // #region Modifying devices
  async modifyDeviceName(deviceName, modifiedDeviceName) {
    await this.elementHelperService.findAndClickElementByTag(
      `manage-devices-menu-rename-button-device-${deviceName}`
    );

    const deviceNameInput =
      await this.elementHelperService.findAndWaitForElement(
        By.css('[data-testid="renaming-device-view-input"]'),
        "Timed out waiting for device name input"
      );

    deviceNameInput.click();
    await deviceNameInput.sendKeys(Key.chord(Key.COMMAND, "a"), Key.BACK_SPACE);
    deviceNameInput.clear();
    await this.driver.wait(async () => {
      return (await deviceNameInput.getAttribute("value")) === "";
    });
    await deviceNameInput.sendKeys(modifiedDeviceName);

    await this.elementHelperService.findAndClickElementByTag(
      `renaming-device-view-save-button`
    );
  }
}

// #endregion
// #endregion

// #region App manipulation

export class AppManipulationService {
  constructor(driver) {
    this.driver = driver;
    this.elementHelperService = new ElementHelperService(driver);
  }

  async waitForAppToLoad() {
    await this.driver.wait(
      async () => {
        const phoneScreen = await this.elementHelperService.safeFind(
          By.css('[data-testid="phone-screen"]')
        );
        if (await phoneScreen?.isDisplayed()) {
          return phoneScreen;
        }

        const errorPopup = await this.elementHelperService.safeFind(
          By.css('[data-testid="alert-dialog-content"]')
        );
        if (await errorPopup?.isDisplayed()) {
          this.elementHelperService.findAndClickElementByTag(
            "alert-open-logs-button"
          );
          await this.driver.sleep(1000);
          await this.driver.switchTo().defaultContent();
          const bottomBar = await new BottomBarPanel().openOutputView();
          const text = await bottomBar.getText();
          console.log("build error saved to output.txt");
          await this.driver.sleep(1000);
          fs.writeFileSync("output.txt", text);
          await this.driver.sleep(1000);
          throw new Error("App error popup displayed");
        }

        return false;
      },
      600000,
      "Timed out waiting for phone-screen"
    );
  }

  async clickInsidePhoneScreen(position, rightClick = false) {
    const phoneScreen = await this.elementHelperService.findAndWaitForElement(
      By.css(`[data-testid="phone-screen"]`),
      "Timed out waiting for phone-screen"
    );

    const rect = await phoneScreen.getRect();
    const phoneWidth = rect.width;
    const phoneHeight = rect.height;

    const actions = this.driver.actions({ bridge: true });

    await actions
      .move({
        // origin is center of phoneScreen
        origin: phoneScreen,
        x: Math.floor((position.x + position.width / 2 - 0.5) * phoneWidth),
        y: Math.floor((position.y + position.height / 2 - 0.5) * phoneHeight),
      })
      // .click() method does not trigger show touch on phone screen
      .press(rightClick ? 2 : 0)
      .pause(250)
      .release(rightClick ? 2 : 0)
      .perform();
  }

  async clickInPhoneAndWaitForMessage(position) {
    const messagePromise = waitForMessage();
    await this.clickInsidePhoneScreen(position);
    return await messagePromise;
  }

  async getButtonCoordinates(appWebsocket, buttonID) {
    const response = await this.sendMessageAndWaitForResponse(
      appWebsocket,
      `getPosition:${buttonID}`
    );
    return response.position;
  }

  async sendMessageAndWaitForResponse(appWebsocket, message) {
    if (!appWebsocket)
      console.warn("No appWebsocket provided to sendMessageAndWaitForResponse");

    const id = Date.now() + "-" + Math.floor(Math.random() * 1e6);
    const messagePromise = waitForMessage(id);
    appWebsocket.send(JSON.stringify({ message: message, id: id }));
    const msg = await messagePromise;
    return msg;
  }

  async hideExpoOverlay(appWebsocket) {
    // expo developer menu overlay loads slower on android app, it's test app so I can't check it programmatically
    if (config.isAndroid) await this.driver.sleep(3000);

    const position = await this.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await this.clickInsidePhoneScreen(position);

    // expo overlay has animation on close so there must be a delay
    await this.driver.sleep(1000);
  }
}

// #endregion
