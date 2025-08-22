import {
  VSBrowser,
  WebView,
  Workbench,
  EditorView,
} from "vscode-extension-tester";
import path from "path";
import fs from "fs";

const IS_RECORDING = process.env.IS_RECORDING === "true";

function startRecording(driver, options = {}) {
  const screenshotsDir = path.join(process.cwd(), "videos");
  if (fs.existsSync(screenshotsDir)) {
    fs.rmSync(screenshotsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(screenshotsDir, { recursive: true });

  let frame = 0;
  const interval = options.interval || 100;

  const intervalId = setInterval(async () => {
    try {
      const image = await driver.takeScreenshot();
      const filePath = path.join(
        screenshotsDir,
        `frame-${String(frame).padStart(4, "0")}.png`
      );
      fs.writeFileSync(filePath, image, "base64");
      frame++;
    } catch (error) {
      if (
        error.name === "NoSuchSessionError" ||
        error.message.includes("invalid session id")
      ) {
        console.warn(
          "Session ended during recording. Stopping screenshot capture."
        );
        clearInterval(intervalId);
      } else {
      }
    }
  }, interval);

  return {
    stop: () => clearInterval(intervalId),
  };
}

let driver, workbench, view, browser;
let recorder;

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
  if (IS_RECORDING) {
    recorder = await startRecording(driver, { interval: 200 });
  }
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

after(async function () {
  if (IS_RECORDING && recorder) {
    await recorder.stop();
  }
});

export function get() {
  return { driver, workbench, view, browser };
}
