import {
  By,
  TextEditor,
  WebView,
  Key,
  BottomBarPanel,
} from "vscode-extension-tester";
import { assert } from "chai";
import {
  ElementHelperService,
  getFileNameInEditor,
  getDebuggerStopLineNumber,
  getCursorLineInEditor,
} from "../utils/helpers.js";
import {
  RadonSettingsService,
  RadonViewsService,
  ManagingDevicesService,
  AppManipulationService,
} from "./interactions.js";
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
    radonSettingsService;

  before(async () => {
    ({ driver, view, workbench } = get());

    elementHelperService = new ElementHelperService(driver);
    radonViewsService = new RadonViewsService(driver);
    managingDevicesService = new ManagingDevicesService(driver);
    appManipulationService = new AppManipulationService(driver);
    radonSettingsService = new RadonSettingsService(driver);

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
    const { file, lineNumber } =
      await radonViewsService.clickOnSourceInDebugConsole(
        debugConsole,
        "console.log"
      );

    const fileName = await getFileNameInEditor();
    const cursorLineNumber = await getCursorLineInEditor();

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

    const debuggerLineStop = await getDebuggerStopLineNumber();

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
});
