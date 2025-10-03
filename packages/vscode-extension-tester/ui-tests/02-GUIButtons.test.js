import initServices from "../services/index.js";
import { WebView, EditorView } from "vscode-extension-tester";
import { execSync } from "child_process";

import { get } from "./setupTest.js";

describe("2 - Main interface buttons tests", () => {
  let driver, elementHelperService, radonViewsService, managingDevicesService;

  before(async () => {
    driver = get().driver;

    ({ elementHelperService, radonViewsService, managingDevicesService } =
      initServices(driver));

    await managingDevicesService.deleteAllDevices();
    const view = new WebView();
    await view.switchBack();
    await new EditorView().closeAllEditors();
  });

  beforeEach(async function () {
    ({ driver } = get());
    await radonViewsService.openRadonIDEPanel();
    await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-settings-dropdown-trigger"
    );
  });

  // it("Should open device settings window", async function () {
  //   await elementHelperService.findAndClickElementByTag(
  //     "radon-bottom-bar-device-settings-dropdown-trigger"
  //   );

  //   await elementHelperService.findAndWaitForElementByTag(
  //     "device-settings-dropdown-menu"
  //   );
  // });

  // it("Should open radon settings window", async function () {
  //   await radonViewsService.openRadonSettingsMenu();

  //   await elementHelperService.findAndWaitForElementByTag(
  //     "radon-settings-dropdown-menu"
  //   );
  // });

  // it("Should open diagnostics window", async function () {
  //   await radonViewsService.openRadonSettingsMenu();
  //   await elementHelperService.findAndClickElementByTag(
  //     "settings-dropdown-run-diagnostics-button"
  //   );

  //   await elementHelperService.findAndWaitForElementByTag("diagnostics-view");
  // });

  // it("Should open manage devices window", async function () {
  //   await radonViewsService.openRadonSettingsMenu();
  //   await elementHelperService.findAndClickElementByTag(
  //     "settings-dropdown-manage-devices-button"
  //   );
  //   await elementHelperService.findAndWaitForElementByTag(
  //     "manage-devices-view"
  //   );
  // });

  // it("Should open send feedback window", async function () {
  //   await radonViewsService.openRadonSettingsMenu();
  //   await elementHelperService.findAndClickElementByTag(
  //     "radon-bottom-bar-send-feedback-button"
  //   );
  //   await elementHelperService.findAndWaitForElementByTag("feedback-view");
  // });

  it("Should open diagnostics window", async function () {
    await radonViewsService.openRadonSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "settings-report-issue"
    );

    function getFrontSafariUrl() {
      const script = `
        tell application "Safari"
            set frontWin to front window
            set theURL to URL of current tab of frontWin
        end tell
        return theURL
    `;
      return execSync(`osascript -e '${script}'`).toString().trim();
    }

    await new Promise((r) => setTimeout(r, 1000));

    const url = getFrontSafariUrl();

    console.log(url);
    execSync(`osascript -e 'tell application "Safari"
                              close every window
                            end tell'`);
  });

  it("Should open radon tools window", async function () {
    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
  });

  it("Should open radon select device menu", async function () {
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-device-select-dropdown-trigger"
    );

    await elementHelperService.findAndWaitForElementByTag("device-select-menu");
  });

  it("Should open radon select approot menu", async function () {
    await elementHelperService.findAndClickElementByTag(
      "radon-bottom-bar-approot-select-dropdown-trigger"
    );

    await elementHelperService.findAndWaitForElementByTag(
      "approot-select-dropdown-content"
    );
  });
});
