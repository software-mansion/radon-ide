import fs from "fs";
import path from "path";
import {
  VSBrowser,
  WebView,
  Workbench,
  EditorView,
  BottomBarPanel,
  Key,
} from "vscode-extension-tester";
import {
  initServer,
  getAppWebsocket,
  closeServer,
} from "../server/webSocketServer.js";
import startRecording from "../utils/screenRecording.js";
import getConfiguration from "../configuration.js";

const { IS_RECORDING } = getConfiguration();

let driver, workbench, view, browser;
let recorder;
const failedTests = [];

before(async function () {
  initServer(8080);
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
  await workbench.executeCommand("Notifications: Toggle Do Not Disturb Mode");
  await workbench.executeCommand("View: Close All Editors");

  view = new WebView();
  if (IS_RECORDING) {
    recorder = startRecording(driver, { interval: 100 });
  }
  await workbench.executeCommand("Chat: Open Chat");
  await workbench.executeCommand("View: Toggle Secondary Side Bar Visibility");
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
    failedTests.push(this.currentTest.fullTitle());
  }
  view = new WebView();
  await view.switchBack();
  let bottomBar = new BottomBarPanel();
  await bottomBar.toggle(false);
  await new EditorView().closeAllEditors();
  await driver.switchTo().defaultContent();

  // this method of reloading window seems to be more reliable than workbench.executeCommand("Developer: Reload Window")
  await driver
    .actions()
    .keyDown(Key.SHIFT)
    .keyDown(Key.COMMAND)
    .sendKeys("p")
    .keyUp(Key.COMMAND)
    .keyUp(Key.SHIFT)
    .perform();
  await driver.actions().sendKeys("Developer: Reload Window").perform();
  await driver.actions().sendKeys(Key.ENTER).perform();

  driver.wait(async () => {
    try {
      workbench = new Workbench();
    } catch {
      return false;
    }
    return true;
  }, 10000);

  // waiting for vscode to get ready after reload
  await driver.wait(async () => {
    try {
      await workbench.getTitleBar().getTitle();
      return true;
    } catch {
      return false;
    }
  }, 10000);
});

after(async function () {
  if (IS_RECORDING && recorder) {
    await recorder.stop();
  }
  closeServer();
  // console log additional informations after standard mocha report
  setTimeout(() => {
    if (failedTests.length > 0) {
      const failingTestNumbers = [
        ...new Set(failedTests.map((x) => x.split(" - ")[0])),
      ];
      console.log("Test suit numbers that failed:");
      console.log(failingTestNumbers.join(" "));
      console.log(
        "To re-run test suits that failed use one of the commands below:"
      );
      console.log(
        `npm run prepare-and-run-tests -- <test-app> ${failingTestNumbers.join(
          " "
        )}`
      );
      console.log(
        `npm run run-tests-on-VM -- <test-app> ${failingTestNumbers.join(" ")}`
      );
    }
  }, 0);
});

export function get() {
  return { driver, workbench, view, browser, appWebsocket: getAppWebsocket() };
}
