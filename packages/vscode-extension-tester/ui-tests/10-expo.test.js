import { WebView } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";

describe("App interaction tests", () => {
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

    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
      radonSettingsService,
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

  beforeEach(async () => {
    radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);

    await appManipulationService.hideExpoOverlay(appWebsocket);

    await radonViewsService.clearDebugConsole();
    await radonViewsService.openRadonIDEPanel();
  });

  it("show correct route for expo router", async () => {
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "expo-route-explore-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );
    const url = await urlInput.getAttribute("value");
    console.log("url", url);
  });
});
