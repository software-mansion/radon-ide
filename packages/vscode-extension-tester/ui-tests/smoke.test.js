import { assert } from "chai";
import {
  VSBrowser,
  Workbench,
  By,
  WebView,
  EditorView,
  until,
} from "vscode-extension-tester";
import { paths, texts } from "../data/testData.js";
import {
  openProjectInVSCode,
  openRadonIDEPanel,
} from "../utils/projectLauncher.js";
import { waitForElement } from "../utils/helpers.js";

describe("Smoke tests Radon IDE", () => {
  let browser;
  let driver;
  let workbench;
  let view;
  let isSmokeFailed = false;

  beforeEach(async function () {
    if (isSmokeFailed) {
      this.skip();
    }

    console.log("Initializing VSBrowser...");
    browser = VSBrowser.instance;
    if (!browser) {
      console.error("Failed to initialize VSBrowser.");
      return;
    }
    driver = browser.driver;
    if (!driver) {
      console.error("Failed to obtain driver from VSBrowser.");
      return;
    }

    await browser.waitForWorkbench();

    workbench = new Workbench();

    view = new WebView();
    await openProjectInVSCode(browser, driver, paths.projectPath, workbench);
  });

  afterEach(async function () {
    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  it("should open Radon IDE webview using command line", async function () {
    try {
      await openRadonIDEPanel(browser, driver, workbench);
    } catch (error) {
      isSmokeFailed = true;
      throw error;
    }
  });

  it("should open Radon IDE view using Radon IDE button", async function () {
    await driver
      .findElement(By.css("div#swmansion\\.react-native-ide"))
      .click();
    const webview = await driver.wait(
      until.elementLocated(By.css('iframe[class*="webview"]')),
      10000,
      "Timed out waiting for Radon IDE webview"
    );
    await waitForElement(driver, webview);
    await driver.switchTo().frame(webview);

    const iframe = await driver.wait(
      until.elementLocated(By.css('iframe[title="Radon IDE"]')),
      10000,
      "Timed out waiting for Radon IDE iframe"
    );
    await waitForElement(driver, iframe);
    await driver.switchTo().frame(iframe);
  });

  it("should open Radon IDE webview for a specific project", async function () {
    await openRadonIDEPanel(browser, driver, workbench);

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
