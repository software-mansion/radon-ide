import * as path from "path";
import dotenv from "dotenv";
import { By, BottomBarPanel, Key } from "vscode-extension-tester";
import { createCanvas } from "canvas";
import { TIMEOUTS } from "../utils/timeouts.js";
import { ElementHelperService } from "./helperServices.js";
import AppManipulationService from "./appManipulationService.js";

dotenv.config();
const licenseKey = process.env.RADON_IDE_LICENSE_KEY || "";

// Determine modifier key (Command for Mac, Control for Windows/Linux)
const MODIFIER_KEY = Key.COMMAND;

export default class RadonViewsService {
  constructor(driver) {
    this.driver = driver;
    this.elementHelperService = new ElementHelperService(driver);
    this.appManipulationService = new AppManipulationService(driver);
  }

  async openRadonIDEPanel() {
    await this.driver.switchTo().defaultContent();
    const radonIDEButton =
      await this.elementHelperService.findAndWaitForElement(
        By.css("div#swmansion\\.react-native-ide")
      );
    await radonIDEButton.click();

    await this.switchToRadonIDEFrame();

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

  async activateRadonIDELicense() {
    if (await this.hasActiveLicense()) {
      return;
    }

    await this.driver.switchTo().defaultContent();

    await this.openRadonIDEPanel();
    await this.elementHelperService.findAndClickElementByTag(
      "open-activate-license-modal-button"
    );
    const keyInput = await this.elementHelperService.findAndClickElementByTag(
      "license-key-input"
    );
    await keyInput.sendKeys(licenseKey);
    await this.driver.sleep(TIMEOUTS.SHORT);
    await this.elementHelperService.findAndClickElementByTag(
      "activate-license-button"
    );
    await this.elementHelperService.findAndClickElementByTag(
      "activate-license-confirm-button"
    );
  }

  async hasActiveLicense() {
    await this.openRadonIDEPanel();
    if (
      await this.elementHelperService.safeFind(
        By.css('[data-testid="open-activate-license-modal-button"]')
      )
    ) {
      return false;
    }
    return true;
  }

  async switchToRadonIDEFrame() {
    await this.driver.switchTo().defaultContent();

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

    await this.driver.sleep(TIMEOUTS.SHORT);
    await this.driver.switchTo().defaultContent();

    const debugConsole = await this.elementHelperService.findAndWaitForElement(
      By.css(`#workbench\\.panel\\.repl`),
      "Timed out waiting for debug console"
    );

    return debugConsole;
  }

  async showZoomControls() {
    const zoomControlsWrapper =
      await this.elementHelperService.findAndWaitForElementByTag(
        "button-group-left-wrapper"
      );
    const actions = this.driver.actions({ async: true });
    await actions.move({ origin: zoomControlsWrapper }).perform();

    await this.driver.sleep(TIMEOUTS.ANIMATION || 500);
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
    // Debug console button is only active when app is started
    await this.appManipulationService.waitForAppToLoad();
    await this.openAndGetDebugConsoleElement();
    await new BottomBarPanel().openDebugConsoleView();

    // In VS Code 1.99.1 method clearText() does not work
    await this.driver
      .actions()
      .keyDown(MODIFIER_KEY)
      .sendKeys("k")
      .keyUp(MODIFIER_KEY)
      .perform();

    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
  }

  async findAndFillSaveFileForm(filename) {
    await this.driver.switchTo().defaultContent();

    const quickInput = await this.driver.wait(async () => {
      try {
        return await this.elementHelperService.findAndWaitForElement(
          By.css(".quick-input-widget .input"),
          "Timed out waiting for quick input"
        );
      } catch {
        return false;
      }
    }, TIMEOUTS.MEDIUM);

    await this.driver.executeScript("arguments[0].value = '';", quickInput);

    const fullPath = path.join(process.cwd(), "data", filename);
    await quickInput.sendKeys(fullPath);
    await this.driver.sleep(TIMEOUTS.SHORT);
    // await quickInput.sendKeys(Key.ENTER);

    const quickInputButton =
      await this.elementHelperService.findAndWaitForElement(
        By.css(".quick-input-action"),
        "Timed out waiting for quick input button"
      );

    await quickInputButton.click();
    await this.driver.sleep(TIMEOUTS.SHORT);
  }

  async findWebViewIFrame(iframeTitle) {
    await this.driver.switchTo().defaultContent();
    const webviews = await this.driver.findElements(
      By.css('iframe[class*="webview"]')
    );

    for (const webview of webviews) {
      await this.driver.switchTo().frame(webview);
      try {
        const iframe = await this.elementHelperService.findAndWaitForElement(
          By.css(`iframe[title="${iframeTitle}"]`),
          `Timed out waiting for Radon IDE iframe with title ${iframeTitle}`,
          TIMEOUTS.DEFAULT
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
