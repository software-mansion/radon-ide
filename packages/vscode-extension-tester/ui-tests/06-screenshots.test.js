import { WebView } from "vscode-extension-tester";
import {
  findAndWaitForElement,
  findAndClickElementByTag,
} from "../utils/helpers.js";
import {
  openRadonIDEPanel,
  findAndFillSaveFileForm,
  waitForAppToLoad,
  deleteAllDevices,
  addNewDevice,
} from "./interactions.js";
import { get } from "./setupTest.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("screenshots panel tests", () => {
  let driver, view;
  const homeDir = os.homedir();

  before(async () => {
    ({ driver } = get());
    await deleteAllDevices(driver);
    await addNewDevice(driver, "newDevice");
    await findAndClickElementByTag(driver, "modal-close-button");
    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async () => {
    await openRadonIDEPanel(driver);
    await waitForAppToLoad(driver);
  });

  it("Should take a screenshot", async () => {
    const filePath = path.join(homeDir, "testScreenshot..png");

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await findAndClickElementByTag(driver, "capture-screenshot-button");
    await driver.sleep(1000);

    await findAndFillSaveFileForm(driver, "testScreenshot");

    await driver.wait(
      async () => {
        return fs.existsSync(filePath);
      },
      10000,
      "Timed out waiting for screenshot to be saved"
    );
  });

  it("Should record screen", async () => {
    const filePath = path.join(homeDir, "testRecording..mp4");

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await findAndClickElementByTag(driver, "toggle-recording-button");
    // recording for 4 sec
    await driver.sleep(4000);
    await findAndClickElementByTag(driver, "toggle-recording-button");
    await driver.sleep(1000);

    await findAndFillSaveFileForm(driver, "testRecording");

    await driver.wait(
      async () => {
        return fs.existsSync(filePath);
      },
      10000,
      "Timed out waiting for screenshot to be saved"
    );
  });
});
