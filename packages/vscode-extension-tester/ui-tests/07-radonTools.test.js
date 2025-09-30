import {
  By,
  EditorView,
  WebView,
  BottomBarPanel,
  TextEditor,
} from "vscode-extension-tester";
import { assert } from "chai";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";
import * as fs from "fs";
import * as path from "path";
import config from "../configuration.js";
import { cropCanvas, compareImages } from "../utils/imageProcessing.js";
import { centerCoordinates } from "../utils/helpers.js";

const cwd = process.cwd() + "/data";

describe("7 - Radon tools tests", () => {
  let driver,
    appWebsocket,
    view,
    workbench,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService,
    radonSettingsService,
    vscodeHelperService;

  before(async () => {
    ({ driver, view, workbench } = get());

    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
      radonSettingsService,
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
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
    await workbench.executeCommand("Remove All Breakpoints");
    radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);

    // expo apps start with developer menu overlay opened
    await appManipulationService.hideExpoOverlay(appWebsocket);
  });

  // it("Should make element inspector active", async () => {
  //   const elementInspectorButton =
  //     await elementHelperService.findAndClickElementByTag(
  //       "radon-bottom-bar-element-inspector-button"
  //     );

  //   const isActive = await elementHelperService.hasClass(
  //     elementInspectorButton,
  //     "icon-button-selected"
  //   );

  //   assert.isTrue(isActive, "Element inspector button is not active");
  // });

  // it("Element Inspector: Should open component source file", async () => {
  //   const componentSourceFile = "TrackableButton.tsx";

  //   await elementHelperService.findAndClickElementByTag(
  //     "radon-bottom-bar-element-inspector-button"
  //   );

  //   const position = await appManipulationService.getButtonCoordinates(
  //     appWebsocket,
  //     "console-log-button"
  //   );

  //   await appManipulationService.clickInsidePhoneScreen(position);

  //   driver.switchTo().defaultContent();

  //   const editorView = new EditorView();
  //   const titles = await editorView.getOpenEditorTitles();

  //   assert.include(titles, componentSourceFile);
  // });

  // it("Right Click on App element: Should open component source file", async () => {
  //   const position = await appManipulationService.getButtonCoordinates(
  //     appWebsocket,
  //     "console-log-button"
  //   );

  //   await appManipulationService.clickInsidePhoneScreen(position, true);

  //   await elementHelperService.findAndWaitForElementByTag(
  //     "inspect-data-menu-content"
  //   );

  //   const menuItem = await elementHelperService.findAndWaitForElement(
  //     By.css(`[data-testid^="inspect-data-menu-item-"]`),
  //     "Timed out waiting for inspect data item name"
  //   );
  //   const attributeData = (await menuItem.getAttribute("data-testid")).split(
  //     "-"
  //   );
  //   const lineNumber = attributeData[attributeData.length - 1];
  //   const filename = attributeData[attributeData.length - 2];

  //   console.log({ lineNumber, filename });

  //   await menuItem.click();

  //   driver.switchTo().defaultContent();

  //   const editorView = new EditorView();
  //   await editorView.closeEditor("Radon IDE");

  //   assert.equal(
  //     await vscodeHelperService.getFileNameInEditor(),
  //     filename,
  //     "Opened file name is incorrect"
  //   );
  //   assert.equal(
  //     await vscodeHelperService.getCursorLineInEditor(),
  //     parseInt(lineNumber) + 1,
  //     "Cursor line number is incorrect"
  //   );
  // });

  // it("should save CPU profiling", async () => {
  //   const filePath = path.join(cwd, "cpuProfiling.cpuprofile");

  //   if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  //   await radonViewsService.openRadonToolsMenu();
  //   await elementHelperService.findAndClickElementByTag(
  //     "tools-dropdown-menu-cpu-profiling-button"
  //   );
  //   await driver.sleep(4000);
  //   await elementHelperService.findAndClickElementByTag(
  //     "radon-top-bar-cpu-profiling-button"
  //   );

  //   await radonViewsService.findAndFillSaveFileForm("cpuProfiling");

  //   await driver.wait(
  //     async () => {
  //       return fs.existsSync(filePath);
  //     },
  //     10000,
  //     "Timed out waiting for CPU profiling to be saved"
  //   );

  //   driver.wait(async () => {
  //     driver.switchTo().defaultContent();
  //     const editorView = new EditorView();
  //     const activeTab = await editorView.getActiveTab();
  //     const title = await activeTab?.getTitle();
  //     const fileExtension = title?.split(".").pop();
  //     return fileExtension === "cpuprofile";
  //   }, 5000);
  // });

  // it("should save React profiling", async () => {
  //   await radonViewsService.openRadonToolsMenu();
  //   await elementHelperService.findAndClickElementByTag(
  //     "tools-dropdown-menu-react-profiling-button"
  //   );

  //   // Simulate user interactions in the app to generate profiling data
  //   await driver.sleep(2000);
  //   const position = await appManipulationService.getButtonCoordinates(
  //     appWebsocket,
  //     "toggle-element-button"
  //   );
  //   appManipulationService.clickInsidePhoneScreen(position);
  //   await driver.sleep(2000);

  //   await elementHelperService.findAndClickElementByTag(
  //     "radon-top-bar-react-profiling-button"
  //   );

  //   driver.wait(async () => {
  //     driver.switchTo().defaultContent();
  //     const editorView = new EditorView();
  //     const activeTab = await editorView.getActiveTab();
  //     const title = await activeTab?.getTitle();
  //     const fileExtension = title?.split(".").pop();
  //     return fileExtension === "reactprofile";
  //   }, 5000);
  // });

  // it("should open preview", async () => {
  //   await driver.switchTo().defaultContent();
  //   await vscodeHelperService.openFileInEditor("MainScreen.tsx");
  //   const editor = new TextEditor();
  //   await driver.wait(
  //     async () => (await editor.getCodeLenses("Open preview")).length > 0,
  //     5000
  //   );
  //   const lenses = await editor.getCodeLenses("Open preview");

  //   await lenses[0].click();
  //   await radonViewsService.switchToRadonIDEFrame();
  //   const urlInput = await elementHelperService.findAndWaitForElementByTag(
  //     "radon-top-bar-url-input"
  //   );

  //   await driver.wait(async () => {
  //     const url = await urlInput.getAttribute("value");
  //     return url == "preview:TrackableButton";
  //   }, 5000);
  // });

  // it("should click button in preview", async () => {
  //   await driver.switchTo().defaultContent();
  //   await vscodeHelperService.openFileInEditor("automatedTests.tsx");
  //   const editor = new TextEditor();
  //   await driver.wait(
  //     async () => (await editor.getCodeLenses("Open preview")).length > 0,
  //     5000
  //   );
  //   const lenses = await editor.getCodeLenses("Open preview");

  //   await lenses[0].click();
  //   await radonViewsService.switchToRadonIDEFrame();
  //   const urlInput = await elementHelperService.findAndWaitForElementByTag(
  //     "radon-top-bar-url-input"
  //   );

  //   const position = await appManipulationService.getButtonCoordinates(
  //     appWebsocket,
  //     "preview-button"
  //   );

  //   const message = await appManipulationService.clickInPhoneAndWaitForMessage(
  //     position
  //   );
  //   assert.equal(message.action, "preview-button");
  // });

  // it("should test show touches", async () => {
  //   const position = await appManipulationService.getButtonCoordinates(
  //     appWebsocket,
  //     "console-log-button"
  //   );

  //   let canvas = await radonViewsService.getPhoneScreenSnapshot();
  //   let button = cropCanvas(canvas, position);

  //   await radonSettingsService.setShowTouches(true);

  //   await appManipulationService.clickInsidePhoneScreen(position);

  //   canvas = await radonViewsService.getPhoneScreenSnapshot();
  //   let buttonAfterClick = cropCanvas(canvas, position);

  //   assert.isFalse(compareImages(button, buttonAfterClick));
  // });

  it("should test show touches", async () => {
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-element-inspector-button"
    );

    let originalPosition = { x: 0.1, y: 0.1, width: 0.1, height: 0.1 };

    const phoneScreen = await elementHelperService.findAndWaitForElement(
      By.css(`[data-testid="phone-screen"]`),
      "Timed out waiting for phone-screen"
    );

    const position = centerCoordinates(originalPosition);

    const rect = await phoneScreen.getRect();
    const phoneWidth = rect.width;
    const phoneHeight = rect.height;

    const actions = driver.actions({ bridge: true });

    await actions
      .move({
        origin: phoneScreen,
        x: Math.floor((position.x + position.width / 2) * phoneWidth),
        y: Math.floor((position.y + (position.height * 3) / 4) * phoneHeight),
      })
      .perform();

    const inspectArea = await elementHelperService.findAndWaitForElementByTag(
      "phone-inspect-area"
    );

    const image = await phoneScreen.takeScreenshot();

    const filePath = path.join("screenshot.png");

    fs.writeFileSync(filePath, image, "base64");
  });
});
