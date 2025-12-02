import * as fs from "fs";
import { By, BottomBarPanel, Key } from "vscode-extension-tester";
import getConfiguration from "../configuration.js";
import { centerCoordinates } from "../utils/helpers.js";
import { waitForMessage } from "../server/webSocketServer.js";
import { TIMEOUTS } from "../utils/timeouts.js";
import { ElementHelperService } from "./helperServices.js";
import RadonViewsService from "./radonViewsService.js";

export default class AppManipulationService {
  constructor(driver) {
    this.driver = driver;
    this.elementHelperService = new ElementHelperService(driver);
  }

  async waitForAppToLoad() {
    let currentMessage = "";
    let firstMessageAppearanceTime = Date.now();

    await this.driver.wait(
      async () => {
        const phoneScreen = await this.elementHelperService.safeFind(
          By.css('[data-testid="phone-screen"]')
        );

        if (await phoneScreen?.isDisplayed()) {
          return phoneScreen;
        }

        await this._checkForBuildError();

        try {
          const messageElement = await this.elementHelperService.safeFind(
            By.css('[data-testid="startup-message"]')
          );

          if (!messageElement) return false;

          const rawText = await messageElement.getText();
          const message = rawText.replace(/\./g, "").replace(/\s+/g, "").trim();

          // In case the device startup process freezes
          if (
            !currentMessage.includes("Building") &&
            currentMessage === message
          ) {
            if (
              Date.now() - firstMessageAppearanceTime >
              TIMEOUTS.STARTUP_FREEZE
            ) {
              await this.restartDevice();
            }
          } else {
            currentMessage = message;
            firstMessageAppearanceTime = Date.now();
          }
        } catch (err) {
          if (err.name !== "StaleElementReferenceError") throw err;
        }
        return false;
      },
      TIMEOUTS.APP_LOAD,
      "Timed out waiting for phone-screen"
    );
  }

  async _checkForBuildError() {
    const errorPopup = await this.elementHelperService.safeFind(
      By.css('[data-testid="alert-dialog-content"]')
    );

    if (await errorPopup?.isDisplayed()) {
      try {
        await this.elementHelperService.findAndClickElementByTag(
          "alert-open-logs-button"
        );
      } catch (err) {
        if (err.name !== "StaleElementReferenceError") return;
      }
      await this.driver.sleep(TIMEOUTS.SHORT);
      await this.driver.switchTo().defaultContent();

      const bottomBar = await new BottomBarPanel().openOutputView();
      const text = await bottomBar.getText();

      console.log("Build error saved to output.txt");
      await this.driver.sleep(TIMEOUTS.SHORT);
      fs.writeFileSync("output.txt", text);
      await this.driver.sleep(TIMEOUTS.SHORT);

      throw new Error("App error popup displayed");
    }
  }

  async restartDevice() {
    const runningDevice =
      await this.elementHelperService.findAndWaitForElementByTag(
        "device-select-value-text"
      );
    const runningDeviceName = await runningDevice.getText();

    await this.elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-select-dropdown-trigger"
    );
    await this.elementHelperService.findAndWaitForElementByTag(
      "device-select-menu"
    );
    await this.elementHelperService.findAndClickElementByTag(
      `device-running-badge-${runningDeviceName}`
    );
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
    await this.elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-select-dropdown-trigger"
    );
    await this.elementHelperService.findAndClickElementByTag(
      `device-${runningDeviceName}`
    );
  }

  async clickInsidePhoneScreen(position, rightClick = false) {
    const phoneScreen = await this.elementHelperService.findAndWaitForElement(
      By.css(`[data-testid="phone-screen"]`),
      "Timed out waiting for phone-screen"
    );

    const centeredPosition = centerCoordinates(position);
    const rect = await phoneScreen.getRect();

    const targetX = Math.floor(
      (centeredPosition.x + centeredPosition.width / 2) * rect.width
    );
    const targetY = Math.floor(
      (centeredPosition.y + centeredPosition.height / 2) * rect.height
    );

    const actions = this.driver.actions({ bridge: true });
    const button = rightClick ? 2 : 0;

    await actions
      .move({
        // Origin is the center of phoneScreen
        origin: phoneScreen,
        x: targetX,
        y: targetY,
      })
      // The .click() method does not trigger the "show touch" visual on the phone screen
      .press(button)
      .pause(TIMEOUTS.PRESS_DELAY)
      .release(button)
      .perform();
  }

  async clickInPhoneAndWaitForMessage(position, retries = 1) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const messagePromise = waitForMessage();
        await this.clickInsidePhoneScreen(position);
        return await messagePromise;
      } catch (err) {
        lastError = err;
        console.log(
          `Attempt ${
            attempt + 1
          } to click in phone and wait for message failed: ${err.message}`
        );
        const radonViewsService = new RadonViewsService(this.driver);
        await radonViewsService.openAndGetDebugConsoleElement();
        await this.driver.sleep(20000);
        if (attempt === retries) {
          console.log("Error while waiting for message from app:");
          throw lastError;
        }
      }
    }
  }

  async getButtonCoordinates(appWebsocket, buttonID) {
    const response = await this.sendMessageAndWaitForResponse(
      appWebsocket,
      `getPosition:${buttonID}`
    );
    return response.position;
  }

  async sendMessageAndWaitForResponse(appWebsocket, message) {
    if (!appWebsocket) {
      console.warn("No appWebsocket provided to sendMessageAndWaitForResponse");
    }

    const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const messagePromise = waitForMessage(id);

    appWebsocket.send(JSON.stringify({ message, id }));

    return await messagePromise;
  }

  async hideExpoOverlay(appWebsocket) {
    // The Expo developer menu overlay loads slower on the Android app; since it is a test app, I cannot check it programmatically
    if (getConfiguration().IS_ANDROID) {
      await this.driver.sleep(TIMEOUTS.ANDROID_OVERLAY);
    }

    const position = await this.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await this.clickInsidePhoneScreen(position);

    // Expo overlay has an animation on close, so there must be a delay
    await this.driver.sleep(TIMEOUTS.SHORT);
  }
}
