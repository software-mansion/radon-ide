import { ElementHelperService } from "./helperServices.js";
import { waitForMessage } from "../server/webSocketServer.js";
import { By, BottomBarPanel } from "vscode-extension-tester";
import * as fs from "fs";
import getConfiguration from "../configuration.js";
import { centerCoordinates } from "../utils/helpers.js";

export default class AppManipulationService {
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

    position = centerCoordinates(position);

    const rect = await phoneScreen.getRect();
    const phoneWidth = rect.width;
    const phoneHeight = rect.height;

    const actions = this.driver.actions({ bridge: true });

    await actions
      .move({
        // origin is center of phoneScreen
        origin: phoneScreen,
        x: Math.floor((position.x + position.width / 2) * phoneWidth),
        y: Math.floor((position.y + position.height / 2) * phoneHeight),
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
    if (getConfiguration().IS_ANDROID) await this.driver.sleep(3000);

    const position = await this.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await this.clickInsidePhoneScreen(position);

    // expo overlay has animation on close so there must be a delay
    await this.driver.sleep(1000);
  }
}
