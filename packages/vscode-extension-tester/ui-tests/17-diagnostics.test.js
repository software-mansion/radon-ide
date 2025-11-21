import { WebView, EditorView } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { safeDescribe } from "../utils/helpers.js";
import { get } from "./setupTest.js";

safeDescribe("17 - Diagnostics tests", () => {
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
    await radonViewsService.openRadonSettingsMenu();
    await elementHelperService.findAndClickElementByTag(
      "settings-dropdown-run-diagnostics-button"
    );

    await elementHelperService.findAndWaitForElementByTag("diagnostics-view");
  });

  it("Should open diagnostics window", async function () {});
});
