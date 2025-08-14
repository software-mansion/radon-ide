import {
  VSBrowser,
  WebView,
  Workbench,
  EditorView,
} from "vscode-extension-tester";
import path from "path";
import fs from "fs";

let driver, workbench, view, browser;

before(async function () {
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
  await workbench.executeCommand("Notifications: Clear All Notifications");
  await workbench.executeCommand("View: Close All Editors");

  view = new WebView();
});

afterEach(async function () {
  if (this.currentTest.state === "failed") {
    driver = VSBrowser.instance.driver;
    const image = await driver.takeScreenshot();

    const screenshotDir = path.join(process.cwd(), "screenshots");
    const filePath = path.join(screenshotDir, `${this.currentTest.title}.png`);

    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.writeFileSync(filePath, image, "base64");
    console.log(`Saved screenshot: ${filePath}`);
  }
  view = new WebView();
  await view.switchBack();
  await new EditorView().closeAllEditors();
});

export function get() {
  return { driver, workbench, view, browser };
}
