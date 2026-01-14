import { readFileSync } from "fs";
import { join } from "path";
import { assert } from "chai";
import { WebView, BottomBarPanel } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { safeDescribe } from "../utils/helpers.js";
import getConfiguration from "../configuration.js";
import { TIMEOUTS } from "../utils/timeouts.js";
import { get } from "./setupTest.js";

const { IS_ANDROID } = getConfiguration();

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
    "files_for_tests/data_for_network_tests.json"
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
    const expectedRequestBody = data[endpoint].request.body || "";
    const expectedQuery = data[endpoint].request.query || "";
    const expectedStatus = data[endpoint].response?.status;
    const expectedResponseBody = data[endpoint].response?.body
      ? data[endpoint].response.body
      : "No response body";
    const expectedResponseHeaders = data[endpoint].response?.headers;
    const expectedDelayMs = data[endpoint].delay_ms;
    const url = IS_ANDROID
      ? data[endpoint].request.url.replace("localhost", "10.0.2.2")
      : data[endpoint].request.url;

    appWebsocket.send(
      JSON.stringify({
        message: "fetchData",
        url: url,
        method: data[endpoint].request.method,
        headers: data[endpoint].request.headers,
        body: data[endpoint].request.body,
        multipart: data[endpoint].request.multipart,
      })
    );

    await driver.sleep(TIMEOUTS.SHORT);

    // additional wait for delayed responses
    if (expectedDelayMs) await driver.sleep(expectedDelayMs);

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

    if (expectedStatus) {
      const status = await elementHelperService.findAndWaitForElementByTag(
        `network-panel-row-${name}-status`
      );
      assert.equal(await status.getText(), expectedStatus.toString());
    }

    if (expectedMethod) {
      const methodElement =
        await elementHelperService.findAndWaitForElementByTag(
          `network-panel-row-${name}-method`
        );
      assert.equal(await methodElement.getText(), expectedMethod);
    }

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

    if (expectedString !== "<image>") {
      assert.include(
        responseText.replace(/\s/g, ""),
        expectedString.replace(/\s/g, "")
      );
    } else {
      // check if response for image is not empty
      assert.notInclude(responseText, "No response body");
      assert.notEqual(responseText, "");

      await elementHelperService.findAndClickElementByTag(
        `network-panel-tab-header-preview`
      );
      await elementHelperService.findAndWaitForElementByTag(
        `network-panel-preview-image`
      );
    }

    if (expectedRequestBody || expectedQuery) {
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

      assert.include(
        payload.replace(/\s/g, ""),
        expectedRequestBodyString.replace(/\s/g, "")
      );

      const expectedRequestQueryString =
        typeof expectedQuery === "string"
          ? expectedQuery
          : JSON.stringify(expectedQuery);

      assert.include(
        payload.replace(/\s/g, ""),
        expectedRequestQueryString.replace(/\s/g, "")
      );
    }

    await elementHelperService.findAndClickElementByTag(
      `network-panel-tab-header-headers`
    );

    await elementHelperService.findAndWaitForElementByTag(
      `network-panel-tab-panel-headers`
    );

    for (const headerKey of Object.keys(expectedResponseHeaders || {})) {
      const headerElement =
        await elementHelperService.findAndWaitForElementByTag(
          `network-log-response-headers-${headerKey}-value`
        );
      let headerValue = await headerElement.getText();
      let expectedHeaderValue = expectedResponseHeaders[headerKey];
      if (expectedHeaderValue.toLowerCase() === "identity" && IS_ANDROID) {
        expectedHeaderValue = "chunked";
      }
      assert.equal(headerValue, expectedHeaderValue);
    }

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

    await driver.sleep(TIMEOUTS.SHORT);
    const networkIFrame = await radonViewsService.findWebViewIFrame(
      "Radon Network Inspector"
    );
    driver.switchTo().frame(networkIFrame);
  }

  it("Should open the network panel", async () => {
    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
    await elementHelperService.findAndClickElementByTag(
      "dev-tool-network-open-button"
    );
    await driver.sleep(TIMEOUTS.SHORT);

    await radonViewsService.findWebViewIFrame("Radon Network Inspector");
  });

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
      await elementHelperService.findAndWaitForElementByTag(
        `network-panel-tab-panel-${header}`
      );
    }
  });

  for (const endpoint of Object.keys(data)) {
    it(`should show correct details for request ${endpoint}`, async () => {
      await testDetails(endpoint);
    });
  }
});
