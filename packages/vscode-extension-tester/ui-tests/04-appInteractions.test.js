import {
  By,
  EditorView,
  WebView,
  BottomBarPanel,
  TextEditor,
  VSBrowser,
} from "vscode-extension-tester";
import { assert } from "chai";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";
import { exec } from "child_process";

describe("4 - App interaction tests", () => {
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
    await radonSettingsService.setShowTouches(true);

    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async function () {
    await workbench.executeCommand("Remove All Breakpoints");
    try {
      await radonViewsService.switchToRadonIDEFrame();
    } catch {
      radonViewsService.openRadonIDEPanel();
    }

    await appManipulationService.waitForAppToLoad();

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);

    // Without using this delay, the application returns incorrect button coordinates.
    // So far, I haven't found a better way to check it (it might be related to SafeAreaView).
    await driver.sleep(1000);

    await appManipulationService.hideExpoOverlay(appWebsocket);

    await radonViewsService.clearDebugConsole();
    await radonViewsService.switchToRadonIDEFrame();

    // ensure app is fully loaded
    await appManipulationService.waitForAppToLoad();

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);
  });

  function execAsync(command) {
    return new Promise((resolve, reject) => {
      exec(command, (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve(stdout);
      });
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

  it("should change apps", async () => {
    await execAsync(
      "./scripts/downloadRepo.sh react-native-74 react-native-app2"
    );
    const browser = VSBrowser.instance;
    browser.openResources(`./data`);
    await driver.switchTo().defaultContent();
    await driver.wait(async () => {
      try {
        await radonViewsService.openRadonIDEPanel();
      } catch {
        return false;
      }
      return true;
    });
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-approot-select-dropdown-trigger"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "approot-select-dropdown-content"
    );
    const project1 = await elementHelperService.findAndWaitForElementByTag(
      "approot-select-item-reactNative74"
    );
    const project2 = await elementHelperService.findAndWaitForElementByTag(
      "approot-select-item-reactNative81"
    );

    console.log(await project1.getText());
    console.log(await project2.getText());

    await driver.sleep(10000);
  });
});
