import * as fs from "fs";
import { assert } from "chai";
import {
  WebView,
  EditorView,
  Key,
  BottomBarPanel,
} from "vscode-extension-tester";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";
import { exec } from "child_process";

describe("14 - Error tests", () => {
  let driver,
    radonViewsService,
    appManipulationService,
    elementHelperService,
    managingDevicesService,
    appWebsocket,
    vscodeHelperService;

  before(async () => {
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
    await radonViewsService.openRadonIDEPanel();
    await driver.sleep(5000);
    await elementHelperService.findAndClickElementByTag("startup-message");
    await appManipulationService.waitForAppToLoad();

    await vscodeHelperService.openCommandLineAndExecute("View: Split Editor");
    await vscodeHelperService.openFileInEditor(
      "/data/react-native-app/shared/automatedTests.tsx"
    );
    const editor = await new EditorView().openEditor("automatedTests.tsx", 1);
    const originalText = await editor.getText();
    try {
      await editor.moveCursor(1, 1);
      // await editor.typeText(`
      //   import notExisting from 'not-existing';
      //   notExisting();
      //   `);
      // await editor.save();
      exec(
        `echo "import notExisting from 'not-existing'; notExisting();" > ${process.cwd()}/data/react-native-app/shared/automatedTests.tsx`
      );
      exec(`watchman-diag`);
      await driver.sleep(10000);

      await driver.sleep(1000);
      await driver.switchTo().defaultContent();
      const bottomBar = await new BottomBarPanel().openOutputView();
      const text = await bottomBar.getText();
      console.log("build error saved to output.txt");
      await driver.sleep(1000);
      fs.writeFileSync("output.txt", text);
      await driver.sleep(1000);
      await radonViewsService.openRadonIDEPanel();
      await appManipulationService.waitForAppToLoad();
      await driver.wait(async () => {
        appWebsocket = get().appWebsocket;
        return appWebsocket != null;
      }, 5000);
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
      await driver
        .actions()
        .keyDown(Key.COMMAND)
        .sendKeys("s")
        .keyUp(Key.COMMAND)
        .perform();
    }
  });
});
