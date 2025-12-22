import { readFileSync } from "fs";
import { join } from "path";
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

  const filePath = join(
    process.cwd(),
    "files_for_tests/network_tests_expected_values.json"
  );
  const fileContent = readFileSync(filePath, "utf-8");
  const data = JSON.parse(fileContent);

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

  async function testDetails(endpoint) {
    const expectedMethod = data[endpoint].request.method;
    const expectedRequestBody = data[endpoint].request.body;
    const expectedStatus = data[endpoint].response?.status;
    const expectedResponseBody = data[endpoint].response?.body
      ? data[endpoint].response.body
      : "No response body";

    appWebsocket.send(
      JSON.stringify({
        message: "fetchData",
        url: data[endpoint].request.url,
        method: data[endpoint].request.method,
        headers: data[endpoint].request.headers,
        body: data[endpoint].request.body,
        multipart: data[endpoint].request.multipart,
      })
    );

    await openNetworkPanel();

    const name = endpoint.split("/").pop().split("?")[0];
    console.log("Testing details for:", name);

    const row = await elementHelperService.findAndWaitForElementByTag(
      `network-panel-row-${name}`
    );

    await driver.executeScript("arguments[0].click();", row);

    await elementHelperService.findAndWaitForElementByTag(
      "network-panel-log-details-tabs"
    );

    const status = await elementHelperService.findAndWaitForElementByTag(
      `network-panel-row-${name}-status`
    );

    if (expectedStatus)
      assert.equal(await status.getText(), expectedStatus.toString());

    const methodElement = await elementHelperService.findAndWaitForElementByTag(
      `network-panel-row-${name}-method`
    );

    if (expectedMethod)
      assert.equal(await methodElement.getText(), expectedMethod);

    await elementHelperService.findAndClickElementByTag(
      `network-panel-tab-header-response`
    );

    const tab = await elementHelperService.findAndWaitForElementByTag(
      `network-panel-tab-panel-response`
    );

    const responseText = await tab.getText();

    const expectedString =
      typeof expectedResponseBody === "string"
        ? expectedResponseBody
        : JSON.stringify(expectedResponseBody);

    if (endpoint !== "api/image") {
      console.log(expectedString.replace(/\s/g, ""));
      console.log(responseText.replace(/\s/g, ""));
    }

    assert.include(
      responseText.replace(/\s/g, ""),
      expectedString.replace(/\s/g, "")
    );

    if (expectedRequestBody) {
      await elementHelperService.findAndClickElementByTag(
        `network-panel-tab-header-payload`
      );

      const payloadTab = await elementHelperService.findAndWaitForElementByTag(
        `network-panel-tab-panel-payload`
      );

      const payload = await payloadTab.getAttribute("textContent");
      const expectedRequestBodyString =
        typeof expectedRequestBody === "string"
          ? expectedRequestBody
          : JSON.stringify(expectedRequestBody);

      console.log(payload);

      console.log(payload.replace(/\s/g, ""));
      console.log(expectedRequestBodyString.replace(/\s/g, ""));

      try {
        assert.include(
          payload.replace(/\s/g, ""),
          expectedRequestBodyString.replace(/\s/g, "")
        );
      } catch (e) {
        console.error(e);
        await driver.sleep(1000000);
      }
    }

    await elementHelperService.findAndClickElementByTag(
      `network-panel-tab-header-headers`
    );

    await elementHelperService.findAndWaitForElementByTag(
      `network-panel-tab-panel-headers`
    );

    // const contentType = await elementHelperService.findAndClickElementByTag(
    //   "network-log-response-headers-Content-Type-value"
    // );

    // console.log("Content-Type:", await contentType.getText());

    await driver.switchTo().defaultContent();
    await radonViewsService.openRadonIDEPanel();
  }

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

  // it("should change tabs in network panel details", async () => {
  // appWebsocket.send(
  //   JSON.stringify({
  //     message: "fetchData",
  //     url: "http://localhost:8080/api/post",
  //     method: "POST",
  //     body: {
  //       name: "Test User",
  //       email: "test@example.com",
  //       password: "secret123",
  //     },
  //   })
  // );
  // await openNetworkPanel();
  // const row = await elementHelperService.findAndWaitForElementByTag(
  //   "network-panel-row-post"
  // );
  // await driver.executeScript("arguments[0].click();", row);
  // await elementHelperService.findAndWaitForElementByTag(
  //   "network-panel-log-details-tabs"
  // );
  // const headers = ["payload", "response", "timing", "headers"];
  // for (const header of headers) {
  //   await elementHelperService.findAndClickElementByTag(
  //     `network-panel-tab-header-${header}`
  //   );
  //   const tab = await elementHelperService.findAndWaitForElementByTag(
  //     `network-panel-tab-panel-${header}`
  //   );
  //   console.log(await tab.getText());
  // }
  // });

  for (const endpoint of Object.keys(data)) {
    it(`should show correct details for request ${endpoint}`, async () => {
      await testDetails(endpoint);
    });
  }

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
