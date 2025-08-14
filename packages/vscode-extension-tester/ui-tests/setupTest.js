import {
  VSBrowser,
  WebView,
  Workbench,
  EditorView,
} from "vscode-extension-tester";
import path from "path";
import fs from "fs";

async function startRecording(driver, options = {}) {
  const screenshotsDir = path.join(process.cwd(), "videos");
  fs.mkdirSync(screenshotsDir, { recursive: true });

  let running = true;

  async function recordLoop() {
    let frame = 0;
    while (running) {
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
          break;
        } else {
          console.error("Error while taking screenshot:", error);
        }
      }
      await new Promise((r) => setTimeout(r, options.interval || 100));
    }
  }

  const recordingPromise = recordLoop();

  return {
    stop: () => {
      running = false;
      return recordingPromise;
    },
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
  recorder = await startRecording(driver, { interval: 100 });
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
  await recorder.stop();
});

export function get() {
  return { driver, workbench, view, browser };
}
