import {
  VSBrowser,
  WebView,
  Workbench,
  EditorView,
  BottomBarPanel,
} from "vscode-extension-tester";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";

const IS_RECORDING = process.env.IS_RECORDING === "true";

let appWebsocket;

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  appWebsocket = ws;

  ws.on("message", (message) => {
    const msg = JSON.parse(message);
    console.log("Received message:", msg);
  });

  ws.on("close", () => {
    appWebsocket = null;
    console.log("Client disconnected");
  });
});

export function waitForMessage(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!appWebsocket) {
      reject(new Error("No websocket connection"));
      return;
    }

    const timer = setTimeout(() => {
      appWebsocket.off("message", handler);
      reject(new Error("Timeout waiting for message"));
    }, timeoutMs);

    const handler = (message) => {
      clearTimeout(timer);
      appWebsocket.off("message", handler);
      const msg = JSON.parse(message);
      resolve(msg);
    };

    appWebsocket.on("message", handler);
  });
}

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
    recorder = await startRecording(driver, { interval: 100 });
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
  let bottomBar = new BottomBarPanel();
  await bottomBar.toggle(false);
  await new EditorView().closeAllEditors();
});

after(async function () {
  if (IS_RECORDING && recorder) {
    await recorder.stop();
  }
  wss.close(() => {
    console.log("WebSocket server closed");
  });
});

export function get() {
  return { driver, workbench, view, browser, appWebsocket };
}
