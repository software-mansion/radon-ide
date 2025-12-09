import { assert } from "chai";
import { WebView, BottomBarPanel } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { safeDescribe } from "../utils/helpers.js";
import { get } from "./setupTest.js";

safeDescribe("5 - Network panel tests", () => {
  let driver,
    view,
    appWebsocket,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService;

  before(async () => {
    ({ driver } = get());
    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
    } = initServices(driver));

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

    await appManipulationService.hideExpoOverlay(appWebsocket);

    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
    const networkSwitch = await elementHelperService.findAndWaitForElementByTag(
      "dev-tool-network"
    );

    if ((await networkSwitch.getAttribute("data-state")) !== "checked") {
      await networkSwitch.click();
    } else {
      await elementHelperService.findAndClickElementByTag(
        "dev-tool-network-open-button"
      );
    }

    view = new WebView();
    await view.switchBack();
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
    await radonViewsService.openRadonIDEPanel();

    // ensure app is loaded
    await appManipulationService.waitForAppToLoad();
    await driver.wait(() => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);
  });

  // async function testDetails(endpoint, body ) {
  //   const base = "http://localhost:8080/";
  //   appWebsocket.send(
  //     JSON.stringify({
  //       message: "fetchData",
  //       url: `${base}${endpoint}`,
  //       body: body
  //     })
  //   );

  //   await openNetworkPanel();

  //   const row = await elementHelperService.findAndWaitForElementByTag(
  //     "network-panel-row-get"
  //   );

  //   await driver.executeScript("arguments[0].click();", row);

  //   await elementHelperService.findAndWaitForElementByTag(
  //     "network-panel-log-details-tabs"
  //   );

  //   const headers = ["payload", "response", "timing", "headers"];

  //   for (const header of headers) {
  //     await elementHelperService.findAndClickElementByTag(
  //       `network-panel-tab-header-${header}`
  //     );

  //     const tab = await elementHelperService.findAndWaitForElementByTag(
  //       `network-panel-tab-panel-${header}`
  //     );
  //     console.log(await tab.getText());
  //   }
  // });

  async function openNetworkPanel() {
    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
    await elementHelperService.findAndClickElementByTag(
      "dev-tool-network-open-button"
    );
    await driver.sleep(1000);
    const networkIFrame = await radonViewsService.findWebViewIFrame(
      "Radon Network Inspector"
    );
    driver.switchTo().frame(networkIFrame);
  }

  // it("Should open the network panel", async () => {
  //   await elementHelperService.findAndClickElementByTag(
  //     "radon-top-bar-tools-dropdown-trigger"
  //   );
  //   await elementHelperService.findAndWaitForElementByTag(
  //     "radon-tools-dropdown-menu"
  //   );
  //   await elementHelperService.findAndClickElementByTag(
  //     "dev-tool-network-open-button"
  //   );
  //   await driver.sleep(1000);

  //   await radonViewsService.findWebViewIFrame("Radon Network Inspector");
  // });

  // it("Should show fetch in network panel", async () => {
  //   appWebsocket.send(
  //     JSON.stringify({
  //       message: "fetchData",
  //       url: "http://localhost:8080/api/get",
  //     })
  //   );

  //   await openNetworkPanel();

  //   await elementHelperService.findAndWaitForElementByTag(
  //     "network-panel-row-get"
  //   );

  //   const data = await elementHelperService.findAndWaitForElementByTag(
  //     "network-panel-row-get-status"
  //   );

  //   assert.equal(await data.getText(), "200");
  // });

  // it("should open network panel details for fetch", async () => {
  //   appWebsocket.send(
  //     JSON.stringify({
  //       message: "fetchData",
  //       url: "http://localhost:8080/api/get",
  //     })
  //   );

  //   await openNetworkPanel();

  //   const row = await elementHelperService.findAndWaitForElementByTag(
  //     "network-panel-row-get"
  //   );

  //   await driver.executeScript("arguments[0].click();", row);

  //   await elementHelperService.findAndWaitForElementByTag(
  //     "network-panel-log-details-tabs"
  //   );
  // });

  it("should change tabs in network panel details", async () => {
    appWebsocket.send(
      JSON.stringify({
        message: "fetchData",
        url: "http://localhost:8080/api/post",
        method: "POST",
        body: {
          name: "Test User",
          email: "test@example.com",
          password: "secret123",
        },
      })
    );

    await openNetworkPanel();

    const row = await elementHelperService.findAndWaitForElementByTag(
      "network-panel-row-post"
    );

    await driver.executeScript("arguments[0].click();", row);

    await elementHelperService.findAndWaitForElementByTag(
      "network-panel-log-details-tabs"
    );

    const headers = ["payload", "response", "timing", "headers"];

    for (const header of headers) {
      await elementHelperService.findAndClickElementByTag(
        `network-panel-tab-header-${header}`
      );

      const tab = await elementHelperService.findAndWaitForElementByTag(
        `network-panel-tab-panel-${header}`
      );

      console.log(await tab.getText());
    }
  });

  it("should show status 404", async () => {
    appWebsocket.send(
      JSON.stringify({
        message: "fetchData",
        url: "http://localhost:8080/api/notExisting",
      })
    );

    await openNetworkPanel();

    const data = await elementHelperService.findAndWaitForElementByTag(
      "network-panel-row-notExisting-status"
    );

    assert.equal(await data.getText(), "404");
  });
});
