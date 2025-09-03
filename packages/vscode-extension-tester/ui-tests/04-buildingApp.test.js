import {
  By,
  TextEditor,
  WebView,
  Key,
  BottomBarPanel,
} from "vscode-extension-tester";
import { assert } from "chai";
import {
  findAndClickElementByTag,
  findAndWaitForElement,
  getFileNameInEditor,
  getDebuggerStopLineNumber,
  getCursorLineInEditor,
} from "../utils/helpers.js";
import {
  addNewDevice,
  openRadonIDEPanel,
  clickInsidePhoneScreen,
  deleteAllDevices,
  getButtonCoordinates,
  openAndGetDebugConsoleElement,
  clickOnSourceInDebugConsole,
  waitForAppToLoad,
  toggleShowTouches,
} from "./interactions.js";
import { get, waitForMessage } from "./setupTest.js";

describe("App clicking", () => {
  let driver, appWebsocket, view, workbench;

  async function clickInPhoneAndWaitForMessage(position) {
    const messagePromise = waitForMessage();
    await clickInsidePhoneScreen(driver, position);
    return messagePromise;
  }

  before(async () => {
    ({ driver, view, workbench } = get());

    await deleteAllDevices(driver);
    await addNewDevice(driver, "newDevice");
    try {
      await findAndClickElementByTag(driver, `modal-close-button`);
    } catch {}

    await waitForAppToLoad(driver);
    await toggleShowTouches(driver);

    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async () => {
    await workbench.executeCommand("Remove All Breakpoints");
    openRadonIDEPanel(driver);
    await waitForAppToLoad(driver);

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);

    // Without using this delay, the application returns incorrect button coordinates.
    // So far, I haven't found a better way to check it (it might be related to SafeAreaView).
    await driver.sleep(1000);
  });

  it("Should click in app", async () => {
    const position = await getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    const message = await clickInPhoneAndWaitForMessage(position);

    assert.equal(message.action, "console-log-button");
  });

  it("should jump to the correct line in the editor", async () => {
    const position = await getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await clickInPhoneAndWaitForMessage(position);

    const debugConsole = await openAndGetDebugConsoleElement(driver);
    const { file, lineNumber } = await clickOnSourceInDebugConsole(
      debugConsole,
      "console.log"
    );

    const fileName = await getFileNameInEditor(driver);
    const cursorLineNumber = await getCursorLineInEditor(driver);

    assert.equal(fileName, await file);
    assert.equal(lineNumber, cursorLineNumber);
  });

  it("Should stop on breakpoint", async () => {
    const position = await getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await clickInPhoneAndWaitForMessage(position);

    const debugConsole = await openAndGetDebugConsoleElement(driver);
    const { lineNumber } = await clickOnSourceInDebugConsole(
      debugConsole,
      "console.log"
    );

    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);

    const editor = new TextEditor();
    await editor.toggleBreakpoint(lineNumber);

    await openRadonIDEPanel(driver);

    await clickInsidePhoneScreen(driver, position);

    const debuggerLineStop = await getDebuggerStopLineNumber(driver);

    assert.equal(lineNumber, debuggerLineStop);
  });

  it("Should show breakpoint stop view on phone screen", async () => {
    const position = await getButtonCoordinates(
      appWebsocket,
      "console-log-button"
    );

    await clickInPhoneAndWaitForMessage(position);

    const debugConsole = await openAndGetDebugConsoleElement(driver);
    const { lineNumber } = await clickOnSourceInDebugConsole(
      debugConsole,
      "console.log"
    );

    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);

    const editor = new TextEditor();
    await editor.toggleBreakpoint(lineNumber);

    await openRadonIDEPanel(driver);
    await clickInsidePhoneScreen(driver, position);

    view = new WebView();
    await view.switchBack();

    await openRadonIDEPanel(driver);

    await findAndWaitForElement(
      driver,
      By.css(`[data-test="app-debugger-container"]`),
      "Timed out waiting for debugger stop view in app"
    );
  });
});
