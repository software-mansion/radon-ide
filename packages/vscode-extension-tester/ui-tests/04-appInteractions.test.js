import { By, WebView, TextEditor, EditorView } from "vscode-extension-tester";
import { assert } from "chai";
import initServices from "../services/index.js";
import { safeDescribe } from "../utils/helpers.js";
import { TIMEOUTS } from "../utils/timeouts.js";
import { get } from "./setupTest.js";

safeDescribe("4 - App interaction tests", () => {
  let driver, appWebsocket, view;
  let {
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService,
    radonSettingsService,
    vscodeHelperService,
  } = initServices(driver);

  before(async () => {
    ({ driver, view } = get());
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
    await radonViewsService.clearDebugConsole();
    await radonViewsService.switchToRadonIDEFrame();
  });

  afterEach(async function () {
    await driver.switchTo().defaultContent();
    await new EditorView().closeAllEditors();
    await driver.sleep(TIMEOUTS.SHORT);
    await vscodeHelperService.openCommandLineAndExecute(
      "Remove All Breakpoints"
    );
  });

  async function prepareBreakpoints(breakpoints = [1, 2, 3]) {
    let editor = await vscodeHelperService.openFileInEditor(
      "/data/react-native-app/shared/automatedTests.tsx"
    );

    // Reopen the file in case first attempt didn't work
    if (!editor) {
      editor = await vscodeHelperService.openFileInEditor(
        "/data/react-native-app/shared/automatedTests.tsx"
      );
    }

    const breakpointLines = [];
    for (const breakpoint of breakpoints) {
      breakpointLines.push(
        await editor.getLineOfText(`// BREAKPOINT ${breakpoint}`)
      );
    }
    const stepIntoLine = await editor.getLineOfText("// STEP INTO LINE");
    const stepOutLine = await editor.getLineOfText("// STEP OUT LINE");
    const lineAfterFunction = await editor.getLineOfText(
      "// LINE AFTER FUNCTION"
    );

    for (const line of breakpointLines) {
      await editor.toggleBreakpoint(line);
    }

    await radonViewsService.openRadonIDEPanel();

    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "breakpoints-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    await driver.sleep(TIMEOUTS.DEFAULT);

    await driver.switchTo().defaultContent();
    await radonViewsService.openRadonIDEPanel();

    await driver.sleep(TIMEOUTS.SHORT);

    return {
      breakpointLines,
      stepIntoLine,
      stepOutLine,
      lineAfterFunction,
    };
  }

  async function getDebuggerStopLineNumber() {
    return await driver.wait(async () => {
      try {
        const debuggerLineStop =
          await vscodeHelperService.getDebuggerStopLineNumber();
        return debuggerLineStop;
      } catch {
        return false;
      }
    });
  }

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

    await vscodeHelperService.closeBottomBarPanel();

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

    await vscodeHelperService.closeBottomBarPanel();

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

  it("Should go to next breakpoint on resume", async () => {
    const { breakpointLines } = await prepareBreakpoints();

    await elementHelperService.findAndClickElementByTag("debug-resume");

    const debuggerLineStop = await driver.wait(async () => {
      try {
        const debuggerLineStop =
          await vscodeHelperService.getDebuggerStopLineNumber();
        return debuggerLineStop;
      } catch {
        return false;
      }
    });

    assert.equal(debuggerLineStop, breakpointLines[1]);
  });

  it("Should step over", async () => {
    const { breakpointLines } = await prepareBreakpoints();

    await elementHelperService.findAndClickElementByTag("debug-step-over");

    const debuggerLineStop = await driver.wait(async () => {
      try {
        const debuggerLineStop =
          await vscodeHelperService.getDebuggerStopLineNumber();
        return debuggerLineStop;
      } catch {
        return false;
      }
    });

    assert.equal(debuggerLineStop, breakpointLines[0] + 1);
  });

  it("Should step into", async () => {
    const { stepIntoLine } = await prepareBreakpoints();

    await elementHelperService.findAndClickElementByTag("debug-step-over");

    await driver.switchTo().defaultContent();
    await radonViewsService.openRadonIDEPanel();
    await elementHelperService.findAndClickElementByTag("debug-step-into");

    const debuggerLineStop = await getDebuggerStopLineNumber();

    assert.equal(debuggerLineStop, stepIntoLine);
  });

  it("Should step out", async () => {
    const { stepOutLine } = await prepareBreakpoints();

    await elementHelperService.findAndClickElementByTag("debug-step-over");

    await driver.switchTo().defaultContent();
    await radonViewsService.openRadonIDEPanel();
    await elementHelperService.findAndClickElementByTag("debug-step-into");

    await driver.switchTo().defaultContent();
    await radonViewsService.openRadonIDEPanel();
    await elementHelperService.findAndClickElementByTag("debug-step-out");

    const debuggerLineStop = await getDebuggerStopLineNumber();

    assert.equal(debuggerLineStop, stepOutLine);
  });

  it("Should step out if breakpoint is at the end of a function", async () => {
    const { lineAfterFunction } = await prepareBreakpoints([4]);

    await elementHelperService.findAndClickElementByTag("debug-step-over");

    const debuggerLineStop = await getDebuggerStopLineNumber();

    assert.equal(debuggerLineStop, lineAfterFunction - 1);
  });

  it("Should step over if trying to step into external function", async () => {
    const { breakpointLines } = await prepareBreakpoints([2]);

    await elementHelperService.findAndClickElementByTag("debug-step-into");

    const debuggerLineStop = await getDebuggerStopLineNumber();

    assert.equal(debuggerLineStop, breakpointLines[0]);
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
