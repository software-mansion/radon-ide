import { WebView, TextEditor } from "vscode-extension-tester";
import { assert } from "chai";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";
import { getAppWebsocket } from "../server/webSocketServer.js";
import fs from "fs";
import { createCanvas } from "canvas";
import { cropCanvas } from "../utils/imageProcessing.js";

describe("preview", () => {
  let driver,
    appWebsocket,
    view,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService,
    radonSettingsService,
    vscodeHelperService;

  before(async () => {
    ({ driver, view } = get());

    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      radonSettingsService,
      appManipulationService,
      vscodeHelperService,
    } = initServices(driver));

    await managingDevicesService.deleteAllDevices();
    await managingDevicesService.addNewDevice("newDevice");
    try {
      await elementHelperService.findAndClickElementByTag(`modal-close-button`);
    } catch {}

    await appManipulationService.waitForAppToLoad();

    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async () => {
    radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);
  });

  // it("should open preview", async () => {
  //   await driver.switchTo().defaultContent();
  //   await vscodeHelperService.openFileInEditor("automatedTests.tsx");
  //   const editor = new TextEditor();
  //   await driver.wait(
  //     async () => (await editor.getCodeLenses("Open preview")).length > 0,
  //     5000
  //   );
  //   const lenses = await editor.getCodeLenses("Open preview");

  //   await lenses[0].click();
  //   await radonViewsService.openRadonIDEPanel();
  //   const urlInput = await elementHelperService.findAndWaitForElementByTag(
  //     "radon-top-bar-url-input"
  //   );
  //   const url = await urlInput.getAttribute("value");
  //   assert.equal(url, "preview:Button");
  // });

  it("should test show touches", async () => {
    await radonSettingsService.toggleShowTouches();
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    const canvas = await radonViewsService.getPhoneScreenSnapshot();
    const cropped = cropCanvas(canvas, position);

    const buffer = cropped.toBuffer("image/png");
    fs.writeFileSync("cropped.png", buffer);

    // console.log(pixels);
  });
});
