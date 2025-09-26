import { createCanvas } from "canvas";
import { ElementHelperService } from "./helperServices.js";
import { By, BottomBarPanel } from "vscode-extension-tester";
import AppManipulationService from "./appManipulationService.js";

export default class RadonViewsService {
  constructor(driver) {
    this.driver = driver;
    this.elementHelperService = new ElementHelperService(driver);
    this.appManipulationService = new AppManipulationService(driver);
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

    await this.driver.sleep(1000);
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

    await this.driver.sleep(500);
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
    await this.appManipulationService.waitForAppToLoad();
    await this.openAndGetDebugConsoleElement();
    const debugView = await new BottomBarPanel().openDebugConsoleView();
    await debugView.clearText();
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
  }

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
