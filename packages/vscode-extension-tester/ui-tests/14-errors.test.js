import { assert } from "chai";
import { WebView, TextEditor, EditorView, Key } from "vscode-extension-tester";
import { get } from "./setupTest.js";
import initServices from "../services/index.js";

describe("14 - Error tests", () => {
  let driver,
    radonViewsService,
    appManipulationService,
    elementHelperService,
    managingDevicesService,
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

  beforeEach(async function () {
    await radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();
  });

  it("should show bundle error", async function () {
    await vscodeHelperService.openFileInEditor(
      "/data/react-native-app/shared/automatedTests.tsx"
    );
    const editor = new TextEditor();
    const originalText = await editor.getText();
    try {
      await editor.moveCursor(1, 1);
      await editor.typeText(`
        import NotExisting from 'not-existing';
        NotExisting;
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
    } finally {
      await vscodeHelperService.openFileInEditor(
        "/data/react-native-app/shared/automatedTests.tsx"
      );
      const textEditor = new TextEditor();
      await textEditor.setText(originalText);
      await textEditor.save();
    }
  });
});
