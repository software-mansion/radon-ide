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
import { getLocal } from "mockttp";
import {
  initServer,
  getAppWebsocket,
  closeServer,
} from "../server/webSocketServer.js";
import initServices from "../services/index.js";
import startRecording from "../utils/screenRecording.js";
import getConfiguration from "../configuration.js";
import { texts } from "../utils/constants.js";
import jwt from "jsonwebtoken";
import { execSync } from "child_process";

const { IS_RECORDING } = getConfiguration();

let driver, workbench, view, browser;
let recorder;
const failedTests = [];
let mockServer;

const CA_CERT = ".proxy-ca-cert.pem";
const CA_KEY = ".proxy-key.pem";
const CA_NAME = "Local Proxy CA Tests Radon IDE";

function generateCerts() {
  if (!fs.existsSync(CA_CERT) || !fs.existsSync(CA_KEY)) {
    console.log("Generating new CA certificate and key...");
    execSync(`
      openssl req -x509 -newkey rsa:2048 -sha256 -days 1 \
        -nodes -keyout ${CA_KEY} -out ${CA_CERT} \
        -subj "/CN=${CA_NAME}"
    `);
    console.log("Generated .proxy-key.pem and .proxy-ca-cert.pem");
  }
}

function addToCertificateToStore() {
  try {
    execSync(
      `security add-certificates -k ~/Library/Keychains/login.keychain-db ${CA_CERT}`
    );
    console.log("CA certificate added to macOS trust store");
  } catch {
    console.warn("Could not add CA to trust store automatically.");
  }
}

function removeFromCertificateStore() {
  try {
    execSync(
      `security delete-certificate -c "${CA_NAME}" ~/Library/Keychains/login.keychain-db`
    );
    console.log("CA certificate removed from macOS certificate store");
  } catch {
    console.warn("Could not remove CA from certificate store automatically.");
  }
}

before(async function () {
  const PRIVATE_KEY =
    process.env.RADON_TESTS_SIM_SERVER_DEBUG_KEY ||
    fs.readFileSync("ec_private_key.pem", "utf8");
  generateCerts();
  addToCertificateToStore();

  mockServer = getLocal({
    https: {
      key: fs.readFileSync(CA_KEY),
      cert: fs.readFileSync(CA_CERT),
      tlsInterceptOnly: [{ hostname: "portal.ide.swmansion.com" }],
    },
  });

  mockServer
    .forPost("https://portal.ide.swmansion.com/api/create-token")
    .thenCallback(async (request) => {
      const bodyText = await request.body.getText();
      let fingerprint = null;

      const body = JSON.parse(bodyText);
      fingerprint = body.fingerprint || null;

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        cp_fpr: fingerprint,
        iat: now,
        exp: now + 60 * 60 * 2,
      };

      const token = jwt.sign(payload, PRIVATE_KEY, { algorithm: "ES256" });

      return {
        statusCode: 200,
        json: { token, fingerprint },
      };
    });

  await mockServer.forAnyRequest().thenPassThrough();
  await mockServer.start(8081);

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

  const radonViewsService = initServices(driver).radonViewsService;
  await radonViewsService.activateRadonIDELicense();
});

export const cleanUpAfterTest = async () => {
  // in case some modal stayed opened after tests
  await driver.actions().sendKeys(Key.ESCAPE).perform();

  const { vscodeHelperService } = initServices(driver);
  view = new WebView();
  await view.switchBack();
  let bottomBar = new BottomBarPanel();
  await bottomBar.toggle(false);
  await new EditorView().closeAllEditors();
  await driver.switchTo().defaultContent();

  await vscodeHelperService.openCommandLineAndExecute(
    "Developer: Reload Window"
  );

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
};

afterEach(async function () {
  if (this.currentTest.state === "failed") {
    driver = VSBrowser.instance.driver;
    const image = await driver.takeScreenshot();

    const screenshotDir = path.join(process.cwd(), "screenshots");
    const filePath = path.join(
      screenshotDir,
      `${this.currentTest.title}-${Date.now()}.png`
    );

    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.writeFileSync(filePath, image, "base64");
    console.log(`Saved screenshot: ${filePath}`);
    failedTests.push(this.currentTest.fullTitle());
  }

  await cleanUpAfterTest();
});

after(async function () {
  removeFromCertificateStore();
  if (IS_RECORDING && recorder) {
    await recorder.stop();
  }
  mockServer.stop();
  closeServer();
  console.log(
    `==== Summary app: ${texts.expectedProjectName} | code version: ${
      process.env["CODE_VERSION"] || "latest"
    } ====`
  );
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
    console.log("============");
  }, 0);
});

export function get() {
  return { driver, workbench, view, browser, appWebsocket: getAppWebsocket() };
}
