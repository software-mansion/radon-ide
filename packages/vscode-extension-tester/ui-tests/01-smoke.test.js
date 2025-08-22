import { assert } from "chai";
import { By } from "vscode-extension-tester";
import { texts } from "../data/testData.js";
import { waitForElement, findAndWaitForElement } from "../utils/helpers.js";
import { openRadonIDEPanel } from "./interactions.js";
import { sharedTestLifecycle } from "./setupTest.js";

describe("Smoke tests Radon IDE", () => {
  const get = sharedTestLifecycle();

  it("should open Radon IDE webview using Radon IDE button", async function () {
    const { driver } = get();
    try {
      await openRadonIDEPanel(driver);
    } catch (error) {
      isSmokeFailed = true;
      throw error;
    }
  });

  it("should open Radon IDE view using command line", async function () {
    const { driver, workbench } = get();
    await workbench.executeCommand("RNIDE.openPanel");

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
  });

  it("should open Radon IDE webview for a specific project", async function () {
    const { driver } = get();
    await openRadonIDEPanel(driver);

    const title = await driver.getTitle();
    assert.equal(
      title,
      "Radon IDE — " + texts.pageTitle,
      `Page title should be: ${texts.pageTitle}`
    );

    const approot = await driver.findElement(
      By.css('[data-test="approot-select-value"]')
    );
    await waitForElement(driver, approot);

    const text = await approot.getText();
    assert.equal(
      text,
      texts.expectedProjectName,
      "Text of the element should be a name of the project"
    );
  });
});
