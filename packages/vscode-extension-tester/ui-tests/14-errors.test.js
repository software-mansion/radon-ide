import * as fs from "fs";
import { assert } from "chai";
import { WebView, EditorView } from "vscode-extension-tester";
import { itIf } from "../utils/helpers.js";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";

const IS_GITHUB_ACTIONS = process.env.IS_GITHUB_ACTIONS === "true";

describe("14 - Error tests", () => {
  let driver, originalText;
  let {
    radonViewsService,
    appManipulationService,
    elementHelperService,
    managingDevicesService,
    vscodeHelperService,
  } = initServices(driver);

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

    originalText = fs.readFileSync(
      "./data/react-native-app/shared/automatedTests.tsx",
      "utf-8"
    );

    const view = new WebView();
    await view.switchBack();
  });

  afterEach(async () => {
    fs.writeFileSync(
      "./data/react-native-app/shared/automatedTests.tsx",
      originalText,
      "utf-8"
    );
  });

  // this test creates bundle error before building app
  it("should show bundle error", async function () {
    await vscodeHelperService.openCommandLineAndExecute("View: Split Editor");
    await vscodeHelperService.openFileInEditor(
      "/data/react-native-app/shared/automatedTests.tsx"
    );

    const editor = await new EditorView().openEditor("automatedTests.tsx", 1);
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
      10000,
      "Error dialog did not show up"
    );

    const dialogTitle = await elementHelperService.findAndWaitForElementByTag(
      "alert-dialog-title"
    );
    assert.equal(await dialogTitle.getText(), "Bundle error");
  });

  // TODO: Re-enable this test on GitHub Actions.
  // The test is currently skipped because Fast Refresh does not trigger on file changes in the CI environment.
  // This is likely caused by an issue with the file watching mechanism (Watchman) on the macOS runners,
  // where the initial file crawl seems to succeed but subsequent modifications are not detected.
  itIf(
    !IS_GITHUB_ACTIONS,
    "should show bundle error dynamically",
    async function () {
      await radonViewsService.openRadonIDEPanel();
      await appManipulationService.waitForAppToLoad();
      await vscodeHelperService.openCommandLineAndExecute("View: Split Editor");
      await vscodeHelperService.openFileInEditor(
        "/data/react-native-app/shared/automatedTests.tsx"
      );

      const editor = await new EditorView().openEditor("automatedTests.tsx", 1);
      await editor.moveCursor(1, 1);
      await editor.typeText(`
        import notExisting from 'not-existing';
        notExisting();
        `);
      await editor.save();

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
        10000,
        "Error dialog did not show up"
      );

      const dialogTitle = await elementHelperService.findAndWaitForElementByTag(
        "alert-dialog-title"
      );
      assert.equal(await dialogTitle.getText(), "Bundle error");
    }
  );

  // test scenario:
  // - creates two devices
  // - cause a bundle error
  // - fix bundle error
  // - after switching to another device bundle error should not appear
  itIf(
    !IS_GITHUB_ACTIONS,
    "should not show bundle error after fixing it and switching device",
    async function () {
      await radonViewsService.openRadonIDEPanel();
      await appManipulationService.waitForAppToLoad();

      const deviceName1 = "newDevice";
      const deviceName2 = "newDevice2";

      await managingDevicesService.addNewDevice(deviceName2);
      await elementHelperService.findAndClickElementByTag(`modal-close-button`);
      await managingDevicesService.switchToDevice(deviceName2);
      await appManipulationService.waitForAppToLoad();

      fs.writeFileSync(
        "./data/react-native-app/shared/automatedTests.tsx",
        originalText + "import notExisting from 'not-existing'; notExisting();",
        "utf-8"
      );

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
        10000,
        "Error dialog did not show up"
      );

      const dialogTitle = await elementHelperService.findAndWaitForElementByTag(
        "alert-dialog-title"
      );
      assert.equal(await dialogTitle.getText(), "Bundle error");

      fs.writeFileSync(
        "./data/react-native-app/shared/automatedTests.tsx",
        originalText,
        "utf-8"
      );
      await managingDevicesService.switchToDevice(deviceName1);
      await appManipulationService.waitForAppToLoad();

      const start = Date.now();
      while (Date.now() - start < 2000) {
        try {
          await elementHelperService.findAndWaitForElementByTag(
            "alert-dialog-content"
          );
        } catch {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        throw new Error(`error dialog appeared`);
      }
    }
  );

  // test scenario:
  // - creates two devices
  // - cause a bundle error
  // - fix bundle error
  // - do js reload
  // - after switching to another device bundle error should not appear
  itIf(
    !IS_GITHUB_ACTIONS,
    "should not show bundle error after fixing it, reloading js and switching device",
    async function () {
      await radonViewsService.openRadonIDEPanel();
      await appManipulationService.waitForAppToLoad();

      const deviceName1 = "newDevice";
      const deviceName2 = "newDevice2";

      await managingDevicesService.addNewDevice(deviceName2);
      await elementHelperService.findAndClickElementByTag(`modal-close-button`);

      await managingDevicesService.switchToDevice(deviceName2);

      await appManipulationService.waitForAppToLoad();

      fs.writeFileSync(
        "./data/react-native-app/shared/automatedTests.tsx",
        originalText + "import notExisting from 'not-existing'; notExisting();",
        "utf-8"
      );

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
        10000,
        "Error dialog did not show up"
      );

      const dialogTitle = await elementHelperService.findAndWaitForElementByTag(
        "alert-dialog-title"
      );
      assert.equal(await dialogTitle.getText(), "Bundle error");

      fs.writeFileSync(
        "./data/react-native-app/shared/automatedTests.tsx",
        originalText,
        "utf-8"
      );

      await elementHelperService.findAndClickElementByTag(
        "top-bar-reload-button-options-button"
      );
      await elementHelperService.findAndClickElementByTag(
        "top-bar-reload-button-option-reload-js"
      );

      await appManipulationService.waitForAppToLoad();
      await managingDevicesService.switchToDevice(deviceName1);

      const start = Date.now();
      while (Date.now() - start < 2000) {
        try {
          await elementHelperService.findAndWaitForElementByTag(
            "alert-dialog-content"
          );
        } catch {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        throw new Error(`error dialog appeared`);
      }
    }
  );
});
