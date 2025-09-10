import {
  By,
  EditorView,
  WebView,
  BottomBarPanel,
} from "vscode-extension-tester";
import { assert } from "chai";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";
import * as fs from "fs";
import * as path from "path";

const cwd = process.cwd() + "/data";

describe("Radon tools tests", () => {
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
  });

  it("should save CPU profiling", async () => {
    const filePath = path.join(cwd, "cpuProfiling.cpuprofile");

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await radonViewsService.openRadonToolsMenu();
    await elementHelperService.findAndClickElementByTag(
      "tools-dropdown-menu-cpu-profiling-button"
    );
    await driver.sleep(4000);
    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-cpu-profiling-button"
    );

    await radonViewsService.findAndFillSaveFileForm("cpuProfiling");

    await driver.wait(
      async () => {
        return fs.existsSync(filePath);
      },
      10000,
      "Timed out waiting for CPU profiling to be saved"
    );

    driver.switchTo().defaultContent();

    const editorView = new EditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab.getTitle();
    const fileExtension = title.split(".").pop();

    assert.equal(fileExtension, "cpuprofile", "CPU profiling file not opened");
  });

  it("should save React profiling", async () => {
    await radonViewsService.openRadonToolsMenu();
    await elementHelperService.findAndClickElementByTag(
      "tools-dropdown-menu-react-profiling-button"
    );

    // Simulate user interactions in the app to generate profiling data
    await driver.sleep(2000);
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "toggle-element-button"
    );
    appManipulationService.clickInsidePhoneScreen(position);
    await driver.sleep(2000);

    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-react-profiling-button"
    );

    driver.switchTo().defaultContent();

    const editorView = new EditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab.getTitle();
    const fileExtension = title.split(".").pop();

    assert.equal(
      fileExtension,
      "reactprofile",
      "React profiling file not opened"
    );
  });
});
