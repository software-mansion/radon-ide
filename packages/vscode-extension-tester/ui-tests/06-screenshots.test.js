import { WebView, Key, By } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("6 - screenshots tests", () => {
  let driver,
    view,
    appWebsocket,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService,
    radonSettingsService;
  const cwd = process.cwd() + "/data";

  before(async () => {
    ({ driver } = get());
    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
      radonSettingsService,
    } = initServices(driver));

    await managingDevicesService.deleteAllDevices();
    await managingDevicesService.addNewDevice("newDevice");
    await elementHelperService.findAndClickElementByTag("modal-close-button");
    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async () => {
    await radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);
  });

  it("Should take a screenshot", async () => {
    // VSCode for some reason puts two dots in file name, but it's not an issue
    // it only happens in vscode instance opened by vscode-extension-tester which uses different save file dialog
    // regular VSCode instance use macOS default save file dialog
    const filePath = path.join(cwd, "screenshotTest..png");

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await elementHelperService.findAndClickElementByTag(
      "capture-screenshot-button"
    );
    await driver.sleep(1000);

    await radonViewsService.findAndFillSaveFileForm("screenshotTest");

    await driver.wait(
      async () => {
        return fs.existsSync(filePath);
      },
      10000,
      "Timed out waiting for screenshot to be saved"
    );
  });

  it("Should take a screenshot using shortcut", async () => {
    const filePath = path.join(cwd, "screenshotTestShortcut..png");

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await driver
      .actions()
      .keyDown(Key.COMMAND)
      .keyDown(Key.SHIFT)
      .sendKeys("a")
      .keyUp(Key.SHIFT)
      .keyUp(Key.COMMAND)
      .perform();

    await radonViewsService.findAndFillSaveFileForm("screenshotTestShortcut");

    await driver.wait(
      async () => {
        return fs.existsSync(filePath);
      },
      10000,
      "Timed out waiting for screenshot to be saved"
    );
  });

  it("Should record screen", async () => {
    const filePath = path.join(cwd, "recordingTest..mp4");

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await elementHelperService.findAndClickElementByTag(
      "toggle-recording-button"
    );
    // recording for 4 sec
    await driver.sleep(4000);
    await elementHelperService.findAndClickElementByTag(
      "toggle-recording-button"
    );
    await driver.sleep(1000);

    await radonViewsService.findAndFillSaveFileForm("recordingTest");

    await driver.wait(
      async () => {
        return fs.existsSync(filePath);
      },
      10000,
      "Timed out waiting for recording to be saved"
    );
  });

  it("Should record screen using shortcut", async () => {
    const filePath = path.join(cwd, "recordingTest..mp4");

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await driver
      .actions()
      .keyDown(Key.COMMAND)
      .keyDown(Key.SHIFT)
      .sendKeys("e")
      .keyUp(Key.SHIFT)
      .keyUp(Key.COMMAND)
      .perform();
    // recording for 4 sec
    await driver.sleep(4000);

    await driver
      .actions()
      .keyDown(Key.COMMAND)
      .keyDown(Key.SHIFT)
      .sendKeys("e")
      .keyUp(Key.SHIFT)
      .keyUp(Key.COMMAND)
      .perform();

    await radonViewsService.findAndFillSaveFileForm("recordingTest");

    await driver.wait(
      async () => {
        return fs.existsSync(filePath);
      },
      10000,
      "Timed out waiting for recording to be saved"
    );
  });

  it("Should open replay overlay", async () => {
    await radonSettingsService.setEnableReplays(true);

    // some time to wait for replay to record
    await driver.sleep(3000);

    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-show-replay-button"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "replay-overlay",
      "Timed out waiting for replay overlay to appear"
    );
  });

  it("Should open replay overlay using shortcut", async () => {
    await radonSettingsService.setEnableReplays(true);

    // some time to wait for replay to record
    await driver.sleep(3000);

    await driver
      .actions()
      .keyDown(Key.COMMAND)
      .keyDown(Key.SHIFT)
      .sendKeys("r")
      .keyUp(Key.SHIFT)
      .keyUp(Key.COMMAND)
      .perform();

    await elementHelperService.findAndWaitForElementByTag(
      "replay-overlay",
      "Timed out waiting for replay overlay to appear"
    );
  });

  it("Should save replay", async () => {
    const filePath = path.join(cwd, "replayTest..mp4");

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await radonSettingsService.setEnableReplays(true);

    await elementHelperService.waitUntilElementGone(
      By.css("[data-testid='vhs-rewind']")
    );

    // simulate some actions in app
    let position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "toggle-element-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);
    await driver.sleep(2000);
    position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "toggle-element-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-show-replay-button"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "replay-overlay",
      "Timed out waiting for replay overlay to appear"
    );

    await elementHelperService.findAndClickElementByTag("replay-save-button");
    await radonViewsService.findAndFillSaveFileForm("replayTest");

    await driver.wait(
      async () => {
        return fs.existsSync(filePath);
      },
      10000,
      "Timed out waiting for recording to be saved"
    );
  });
});
