import { WebView } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("screenshots panel tests", () => {
  let driver,
    view,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService;
  const homeDir = os.homedir();

  before(async () => {
    ({ driver } = get());
    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
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
  });

  it("Should take a screenshot", async () => {
    // VSCode for some reason puts two dots in file name, but it's not an issue
    // it only happens in vscode instance opened by vscode-extension-tester which uses different save file dialog
    // regular VSCode instance use macOS default save file dialog
    const filePath = path.join(homeDir, "screenshotTest..png");

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

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  it("Should record screen", async () => {
    const filePath = path.join(homeDir, "recordingTest..mp4");

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
      "Timed out waiting for screenshot to be saved"
    );

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
});
