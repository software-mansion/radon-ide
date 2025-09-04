import { WebView } from "vscode-extension-tester";
import { ElementHelperService } from "../utils/helpers.js";
import {
  RadonViewsService,
  ManagingDevicesService,
  AppManipulationService,
  findAndFillSaveFileForm,
} from "./interactions.js";
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
    elementHelperService = new ElementHelperService(driver);
    radonViewsService = new RadonViewsService(driver);
    managingDevicesService = new ManagingDevicesService(driver);
    appManipulationService = new AppManipulationService(driver);

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
    const filePath = path.join(homeDir, "testScreenshot..png");

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await elementHelperService.findAndClickElementByTag(
      "capture-screenshot-button"
    );
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

    await elementHelperService.findAndClickElementByTag(
      "toggle-recording-button"
    );
    // recording for 4 sec
    await driver.sleep(4000);
    await elementHelperService.findAndClickElementByTag(
      "toggle-recording-button"
    );
    await driver.sleep(1000);

    await elementHelperService.findAndFillSaveFileForm("testRecording");

    await driver.wait(
      async () => {
        return fs.existsSync(filePath);
      },
      10000,
      "Timed out waiting for screenshot to be saved"
    );
  });
});
