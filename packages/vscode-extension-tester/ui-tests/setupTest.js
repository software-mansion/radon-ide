import {
  VSBrowser,
  WebView,
  Workbench,
  EditorView,
} from "vscode-extension-tester";
import { paths } from "../data/testData.js";
import { openProjectInVSCode } from "../utils/projectLauncher.js";
import path from "path";
import fs from "fs";

export function sharedTestLifecycle() {
  let browser, driver, workbench, view;
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
    if (this.currentTest.state === "failed") {
      const driver = VSBrowser.instance.driver;
      const image = await driver.takeScreenshot();

      const screenshotDir = path.join(process.cwd(), "screenshots");
      const filePath = path.join(
        screenshotDir,
        `${this.currentTest.title}.png`
      );

      fs.mkdirSync(screenshotDir, { recursive: true });
      fs.writeFileSync(filePath, image, "base64");
      console.log(`Saved screenshot: ${filePath}`);
    }

    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  return () => ({ browser, driver, workbench, view });
}
