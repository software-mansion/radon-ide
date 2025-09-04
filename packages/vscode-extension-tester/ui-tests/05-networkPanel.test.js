import { By, WebView, BottomBarPanel, Key } from "vscode-extension-tester";
import { ElementHelperService } from "../utils/helpers.js";
import {
  findWebViewIFrame,
  RadonViewsService,
  ManagingDevicesService,
  AppManipulationService,
} from "./interactions.js";
import { get } from "./setupTest.js";

describe("Network panel tests", () => {
  let driver,
    view,
    appWebsocket,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService;

  before(async () => {
    ({ driver } = get());
    elementHelperService = new ElementHelperService(driver);
    radonViewsService = new RadonViewsService(driver);
    managingDevicesService = new ManagingDevicesService(driver);
    appManipulationService = new AppManipulationService(driver);

    await managingDevicesService.deleteAllDevices();
    await managingDevicesService.addNewDevice("newDevice");
    await elementHelperService.findAndClickElementByTag("modal-close-button");
    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async () => {
    await radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);

    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
    const networkSwitch = await elementHelperService.findAndWaitForElementByTag(
      "dev-tool-Network"
    );

    if ((await networkSwitch.getAttribute("data-state")) !== "checked") {
      await networkSwitch.click();
    } else {
      await elementHelperService.findAndClickElementByTag(
        "dev-tool-Network-open-button"
      );
    }

    view = new WebView();
    await view.switchBack();
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
    await radonViewsService.openRadonIDEPanel();
  });

  it("Should open the network panel", async () => {
    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
    await elementHelperService.findAndClickElementByTag(
      "dev-tool-Network-open-button"
    );
    await driver.sleep(1000);
    const networkIFrame = await findWebViewIFrame(
      driver,
      "Radon Network Inspector"
    );
  });

  it("Should show fetch in network panel", async () => {
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "fetch-request-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
    await elementHelperService.findAndClickElementByTag(
      "dev-tool-Network-open-button"
    );
    await driver.sleep(1000);
    const networkIFrame = await findWebViewIFrame(
      driver,
      "Radon Network Inspector"
    );
    driver.switchTo().frame(networkIFrame);

    await elementHelperService.findAndWaitForElementByTag(
      "network-panel-row-ditto"
    );
  });
});
