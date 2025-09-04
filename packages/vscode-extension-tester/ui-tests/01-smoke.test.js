import { assert } from "chai";
import { By } from "vscode-extension-tester";
import { texts } from "../data/testData.js";
import { ElementHelperService } from "../utils/helpers.js";
import { RadonViewsService } from "./interactions.js";
import { get } from "./setupTest.js";

describe("Smoke tests Radon IDE", () => {
  let driver, workbench, elementHelperService, radonViewsService;

  beforeEach(async function () {
    ({ driver, workbench } = get());
    elementHelperService = new ElementHelperService(driver);
    radonViewsService = new RadonViewsService(driver);
  });

  it("should open Radon IDE webview using Radon IDE button", async function () {
    try {
      await radonViewsService.openRadonIDEPanel();
    } catch (error) {
      throw error;
    }
  });

  it("should open Radon IDE view using command line", async function () {
    await workbench.executeCommand("RNIDE.openPanel");

    const webview = await elementHelperService.findAndWaitForElement(
      By.css('iframe[class*="webview"]'),
      "Timed out waiting for Radon IDE webview"
    );
    await driver.switchTo().frame(webview);

    const iframe = await elementHelperService.findAndWaitForElement(
      By.css('iframe[title="Radon IDE"]'),
      "Timed out waiting for Radon IDE iframe"
    );
    await driver.switchTo().frame(iframe);
  });

  it("should open Radon IDE webview for a specific project", async function () {
    await radonViewsService.openRadonIDEPanel();

    const title = await driver.getTitle();
    assert.equal(
      title,
      "Radon IDE — " + texts.pageTitle,
      `Page title should be: ${texts.pageTitle}`
    );

    const approot = await elementHelperService.findAndWaitForElement(
      By.css('[data-testid="approot-select-value"]')
    );

    await driver.wait(async () => {
      const text = await approot.getText();
      return text.toLowerCase() === texts.expectedProjectName.toLowerCase();
    }, 5000);
  });
});
