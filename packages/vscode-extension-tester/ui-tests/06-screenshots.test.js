import { By, Key } from "vscode-extension-tester";
import {
  findAndWaitForElement,
  findAndClickElementByTag,
} from "../utils/helpers.js";
import { openRadonIDEPanel, findAndFillSaveFileForm } from "./interactions.js";
import { get } from "./setupTest.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("screenshots panel tests", () => {
  const { driver } = get();
  const homeDir = os.homedir();

  it("Should take a screenshot", async () => {
    const filePath = path.join(homeDir, "testScreenshot..png");

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await openRadonIDEPanel(driver);

    await findAndWaitForElement(
      driver,
      By.css(`[data-test="phone-screen"]`),
      "Timed out waiting for phone-screen",
      600000
    );

    await findAndClickElementByTag(driver, "capture-screenshot-button");
    await driver.sleep(1000);

    findAndFillSaveFileForm(driver, "testScreenshot");

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

    await openRadonIDEPanel(driver);

    await findAndWaitForElement(
      driver,
      By.css(`[data-test="phone-screen"]`),
      "Timed out waiting for phone-screen",
      600000
    );

    await findAndClickElementByTag(driver, "toggle-recording-button");
    await driver.sleep(4000);
    await findAndClickElementByTag(driver, "toggle-recording-button");
    await driver.sleep(1000);

    findAndFillSaveFileForm(driver, "testRecording");

    await driver.wait(
      async () => {
        return fs.existsSync(filePath);
      },
      10000,
      "Timed out waiting for screenshot to be saved"
    );
  });
});
