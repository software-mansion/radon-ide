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

describe("App clicking", () => {
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
    await radonSettingsService.toggleShowTouches();

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

    await appManipulationService.hideExpoOverlay(appWebsocket);

    // Without using this delay, the application returns incorrect button coordinates.
    // So far, I haven't found a better way to check it (it might be related to SafeAreaView).
    await driver.sleep(1000);
  });

  it("Should click in app", async () => {
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    const message = await appManipulationService.clickInPhoneAndWaitForMessage(
      position
    );

    assert.equal(message.action, "console-log-button");
  });

  it("should jump to the correct line in the editor", async () => {
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await appManipulationService.clickInPhoneAndWaitForMessage(position);

    const debugConsole =
      await radonViewsService.openAndGetDebugConsoleElement();
    const bottomBar = await new BottomBarPanel().openDebugConsoleView();
    await driver.sleep(1000);
    console.log(await bottomBar.getText());
    const { file, lineNumber } =
      await radonViewsService.clickOnSourceInDebugConsole(
        debugConsole,
        "console.log"
      );

    const fileName = await vscodeHelperService.getFileNameInEditor();
    const cursorLineNumber = await vscodeHelperService.getCursorLineInEditor();

    assert.equal(fileName, await file);
    assert.equal(lineNumber, cursorLineNumber);
  });

  it("Should stop on breakpoint", async () => {
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await appManipulationService.clickInPhoneAndWaitForMessage(position);

    const debugConsole =
      await radonViewsService.openAndGetDebugConsoleElement();
    const { lineNumber } = await radonViewsService.clickOnSourceInDebugConsole(
      debugConsole,
      "console.log"
    );

    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);

    const editor = new TextEditor();
    await editor.toggleBreakpoint(lineNumber);

    await radonViewsService.openRadonIDEPanel();

    await appManipulationService.clickInsidePhoneScreen(position);

    const debuggerLineStop =
      await vscodeHelperService.getDebuggerStopLineNumber();

    assert.equal(lineNumber, debuggerLineStop);
  });

  it("Should show breakpoint stop view on phone screen", async () => {
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await appManipulationService.clickInPhoneAndWaitForMessage(position);

    const debugConsole =
      await radonViewsService.openAndGetDebugConsoleElement();
    const { lineNumber } = await radonViewsService.clickOnSourceInDebugConsole(
      debugConsole,
      "console.log"
    );

    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);

    const editor = new TextEditor();
    await editor.toggleBreakpoint(lineNumber);

    await radonViewsService.openRadonIDEPanel();
    await appManipulationService.clickInsidePhoneScreen(position);

    view = new WebView();
    await view.switchBack();

    await radonViewsService.openRadonIDEPanel();

    await elementHelperService.findAndWaitForElement(
      By.css(`[data-testid="app-debugger-container"]`),
      "Timed out waiting for debugger stop view in app"
    );
  });

  it("Should make element inspector active", async () => {
    const elementInspectorButton =
      await elementHelperService.findAndClickElementByTag(
        "radon-bottom-bar-element-inspector-button"
      );

    const isActive = await elementHelperService.hasClass(
      elementInspectorButton,
      "icon-button-selected"
    );

    assert.isTrue(isActive, "Element inspector button is not active");
  });

  it("Should open component source file", async () => {
    const componentSourceFile = "TrackableButton.tsx";

    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-element-inspector-button"
    );

    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await appManipulationService.clickInsidePhoneScreen(position);

    driver.switchTo().defaultContent();

    const editorView = new EditorView();
    const titles = await editorView.getOpenEditorTitles();

    assert.include(titles, componentSourceFile);
  });

  it("Should open component source file", async () => {
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await appManipulationService.clickInsidePhoneScreen(position, true);

    await elementHelperService.findAndWaitForElementByTag(
      "inspect-data-menu-content"
    );

    const menuItem = await elementHelperService.findAndWaitForElement(
      By.css(`[data-testid^="inspect-data-menu-item-"]`),
      "Timed out waiting for inspect data item name"
    );
    const attributeData = (await menuItem.getAttribute("data-testid")).split(
      "-"
    );
    const lineNumber = attributeData[attributeData.length - 1];
    const filename = attributeData[attributeData.length - 2];

    console.log({ lineNumber, filename });

    await menuItem.click();

    driver.switchTo().defaultContent();

    const editorView = new EditorView();
    await editorView.closeEditor("Radon IDE");

    assert.equal(
      await vscodeHelperService.getFileNameInEditor(),
      filename,
      "Opened file name is incorrect"
    );
    assert.equal(
      await vscodeHelperService.getCursorLineInEditor(),
      parseInt(lineNumber) + 1,
      "Cursor line number is incorrect"
    );
  });

  it("should throw error in debug console", async () => {
    const errorMessage = "expected error";

    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "uncaught-exception-button"
    );

    const message = await appManipulationService.clickInPhoneAndWaitForMessage(
      position
    );

    assert.equal(message.action, "uncaught-exception-button");

    const debugConsole =
      await radonViewsService.openAndGetDebugConsoleElement();

    const outputLine = await debugConsole.findElement(
      By.xpath(`//span[contains(text(), '${errorMessage}')]/ancestor::div[1]`)
    );

    console.log(await outputLine.getText());
  });
});
