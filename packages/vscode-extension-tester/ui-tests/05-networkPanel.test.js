import { By, WebView, BottomBarPanel, Key } from "vscode-extension-tester";
import {
  findAndClickElementByTag,
  findAndWaitForElementByTag,
  findAndWaitForElement,
} from "../utils/helpers.js";
import {
  openRadonIDEPanel,
  findWebViewIFrame,
  waitForAppToLoad,
  addNewDevice,
  deleteAllDevices,
  getButtonCoordinates,
  clickInsidePhoneScreen,
} from "./interactions.js";
import { get } from "./setupTest.js";

describe("Network panel tests", () => {
  let driver, view, appWebsocket;

  before(async () => {
    ({ driver } = get());
    await deleteAllDevices(driver);
    await addNewDevice(driver, "newDevice");
    await findAndClickElementByTag(driver, "modal-close-button");
    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async () => {
    openRadonIDEPanel(driver);
    await waitForAppToLoad(driver);

    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);

    await findAndClickElementByTag(
      driver,
      "radon-top-bar-tools-dropdown-trigger"
    );
    await findAndWaitForElementByTag(driver, "radon-tools-dropdown-menu");
    const networkSwitch = await findAndWaitForElementByTag(
      driver,
      "dev-tool-Network"
    );

    if ((await networkSwitch.getAttribute("data-state")) !== "checked") {
      await networkSwitch.click();
    } else {
      await findAndClickElementByTag(driver, "dev-tool-Network-open-button");
    }

    view = new WebView();
    await view.switchBack();
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
    openRadonIDEPanel(driver);
  });

  it("Should open the network panel", async () => {
    await findAndClickElementByTag(
      driver,
      "radon-top-bar-tools-dropdown-trigger"
    );
    await findAndWaitForElementByTag(driver, "radon-tools-dropdown-menu");
    await findAndClickElementByTag(driver, "dev-tool-Network-open-button");
    await driver.sleep(1000);
    const networkIFrame = await findWebViewIFrame(
      driver,
      "Radon Network Inspector"
    );
  });

  it("Should show fetch in network panel", async () => {
    const position = await getButtonCoordinates(
      appWebsocket,
      "fetch-request-button"
    );
    await clickInsidePhoneScreen(driver, position);

    await findAndClickElementByTag(
      driver,
      "radon-top-bar-tools-dropdown-trigger"
    );
    await findAndWaitForElementByTag(driver, "radon-tools-dropdown-menu");
    await findAndClickElementByTag(driver, "dev-tool-Network-open-button");
    await driver.sleep(1000);
    const networkIFrame = await findWebViewIFrame(
      driver,
      "Radon Network Inspector"
    );
    driver.switchTo().frame(networkIFrame);

    await findAndWaitForElement(
      driver,
      By.css('[data-test="network-panel-row-ditto"]')
    );
  });
});
