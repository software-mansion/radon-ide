import {
  By,
  WebView,
  BottomBarPanel,
  TextEditor,
  EditorView,
} from "vscode-extension-tester";
import { assert } from "chai";
import initServices from "../services/index.js";
import { safeDescribe } from "../utils/helpers.js";
import { get } from "./setupTest.js";

safeDescribe("4 - App interaction tests", () => {
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

    await managingDevicesService.prepareDevices();

    await appManipulationService.waitForAppToLoad();
    await radonSettingsService.setShowTouches(true);

    await driver.switchTo().defaultContent();
    await new EditorView().closeAllEditors();
  });

  beforeEach(async function () {
    await radonViewsService.openRadonIDEPanel();

    await appManipulationService.waitForAppToLoad();
    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);

    await appManipulationService.hideExpoOverlay(appWebsocket);
    console.log("test");
    await radonViewsService.clearDebugConsole();
    await radonViewsService.switchToRadonIDEFrame();
  });

  afterEach(async function () {
    await driver.switchTo().defaultContent();
    await workbench.executeCommand("Remove All Breakpoints");
  });

  it("Should click in app", async () => {
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );
    console.log("test");

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
    console.log("test");

    await appManipulationService.clickInPhoneAndWaitForMessage(position);
    console.log("after click");

    const debugConsole =
      await radonViewsService.openAndGetDebugConsoleElement();

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

    const debuggerLineStop = await driver.wait(async () => {
      try {
        const debuggerLineStop =
          await vscodeHelperService.getDebuggerStopLineNumber();
        return debuggerLineStop;
      } catch {
        return false;
      }
    });

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
