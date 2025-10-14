import * as fs from "fs";
import { exec } from "child_process";
import { assert } from "chai";
import {
  WebView,
  EditorView,
  Key,
  BottomBarPanel,
} from "vscode-extension-tester";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";

describe("14 - Error tests", () => {
  let driver, appWebsocket;
  let {
    radonViewsService,
    appManipulationService,
    elementHelperService,
    managingDevicesService,
    vscodeHelperService,
  } = initServices(driver);

  before(async () => {
    exec(
      `cp ${process.cwd()}/.watchmanconfig ${process.cwd()}/data/react-native-app/.watchmanconfig`
    );
    exec(
      `cp ${process.cwd()}/metro.config.js ${process.cwd()}/data/react-native-app/metro.config.js`
    );
    driver = get().driver;
    ({
      radonViewsService,
      appManipulationService,
      elementHelperService,
      managingDevicesService,
      vscodeHelperService,
    } = initServices(driver));

    await managingDevicesService.deleteAllDevices();
    await managingDevicesService.addNewDevice("newDevice");
    try {
      await elementHelperService.findAndClickElementByTag(`modal-close-button`);
    } catch {}

    const view = new WebView();
    await view.switchBack();
  });

  beforeEach(async function () {});

  it("should show bundle error", async function () {
    await vscodeHelperService.openCommandLineAndExecute("View: Split Editor");
    await vscodeHelperService.openFileInEditor(
      "/data/react-native-app/shared/automatedTests.tsx"
    );
    const editor = await new EditorView().openEditor("automatedTests.tsx", 1);
    const originalText = await editor.getText();
    try {
      await editor.moveCursor(1, 1);
      await editor.typeText(`
        import notExisting from 'not-existing';
        notExisting();
        `);
      await editor.save();

      await radonViewsService.openRadonIDEPanel();
      await appManipulationService.waitForAppToLoad();
      await driver.switchTo().defaultContent();
      await radonViewsService.openRadonIDEPanel();

      await driver.wait(
        async () => {
          try {
            await elementHelperService.findAndWaitForElementByTag(
              "alert-dialog-content"
            );
            return true;
          } catch {
            return false;
          }
        },
        // it may take some time for radon to fast refresh especially on GitHub CI
        20000,
        "Error dialog did not show up"
      );
      const dialogTitle = await elementHelperService.findAndWaitForElementByTag(
        "alert-dialog-title"
      );
      assert.equal(await dialogTitle.getText(), "Bundle error");
    } finally {
      await driver.switchTo().defaultContent();
      const editor = await new EditorView().openEditor("automatedTests.tsx", 1);
      await editor.setText(originalText);
      await editor.save();
    }
  });
});
