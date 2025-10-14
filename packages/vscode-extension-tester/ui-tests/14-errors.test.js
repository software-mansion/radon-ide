import { assert } from "chai";
import { WebView, EditorView } from "vscode-extension-tester";
import { itIf } from "../utils/helpers.js";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";

const IS_GITHUB_ACTIONS = process.env.IS_GITHUB_ACTIONS === "true";

describe("14 - Error tests", () => {
  let driver;
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

    const view = new WebView();
    await view.switchBack();
  });

  // this test creates bundle error before building app
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
        10000,
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
      const originalText = await editor.getText();
      try {
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
        const dialogTitle =
          await elementHelperService.findAndWaitForElementByTag(
            "alert-dialog-title"
          );
        assert.equal(await dialogTitle.getText(), "Bundle error");
      } finally {
        await driver.switchTo().defaultContent();
        const editor = await new EditorView().openEditor(
          "automatedTests.tsx",
          1
        );
        await editor.setText(originalText);
        await editor.save();
      }
    }
  );
});
