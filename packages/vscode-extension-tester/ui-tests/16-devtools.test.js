import * as fs from "fs";
import { assert } from "chai";
import { WebView, BottomBarPanel, Key, By } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { describeIf } from "../utils/helpers.js";
import { get } from "./setupTest.js";

const raw = fs.readFileSync("./data/react-native-app/package.json");
const data = JSON.parse(raw);
// the tests are designed to work on a specific app only
const IS_CORRECT_APP = data.name.includes("expo52PrebuildWithPlugins");

describeIf(IS_CORRECT_APP, "16 - devTools Tests", () => {
  let driver, view, appWebsocket;
  let {
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService,
  } = initServices(driver);

  before(async () => {
    ({ driver, view } = get());

    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
    } = initServices(driver));

    await managingDevicesService.deleteAllDevices();
    await managingDevicesService.addNewDevice("newDevice");
    try {
      await elementHelperService.findAndClickElementByTag(`modal-close-button`);
    } catch {}

    view = new WebView();
    await view.switchBack();
  });

  beforeEach(async function () {
    await driver.switchTo().defaultContent();
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(false);
    ({ driver } = get());
    await radonViewsService.openRadonIDEPanel();
    await appManipulationService.waitForAppToLoad();
    await driver.wait(async () => {
      appWebsocket = get().appWebsocket;
      return appWebsocket != null;
    }, 5000);
  });

  it("Should open Redux DevTools in bottom panel", async function () {
    await appManipulationService.hideExpoOverlay(appWebsocket);

    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
    const reduxSwitch = await elementHelperService.findAndWaitForElementByTag(
      "dev-tool-redux-devtools-devplugin"
    );

    if ((await reduxSwitch.getAttribute("data-state")) !== "checked") {
      await reduxSwitch.click();
    } else {
      await elementHelperService.findAndClickElementByTag(
        "dev-tool-redux-devtools-devplugin-open-button"
      );
    }
    await driver.sleep(1000);
    const reduxIFrame = await radonViewsService.findWebViewIFrame(
      "Radon Redux DevTools"
    );
    driver.switchTo().frame(reduxIFrame);
  });

  it("Should open React Query DevTools in bottom panel", async function () {
    await appManipulationService.hideExpoOverlay(appWebsocket);

    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );
    await urlInput.click();
    await urlInput.sendKeys("/plugins", Key.ENTER);

    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
    const reactQuerySwitch =
      await elementHelperService.findAndWaitForElementByTag(
        "dev-tool-react-query-devtools"
      );

    if ((await reactQuerySwitch.getAttribute("data-state")) !== "checked") {
      await reactQuerySwitch.click();
    } else {
      await elementHelperService.findAndClickElementByTag(
        "dev-tool-react-query-devtools-open-button"
      );
    }
    await driver.sleep(1000);
    const reactQueryIFrame = await radonViewsService.findWebViewIFrame(
      "Radon React Query DevTools"
    );
    driver.switchTo().frame(reactQueryIFrame);
  });

  it("should make changes in React Query DevTools", async function () {
    await appManipulationService.hideExpoOverlay(appWebsocket);

    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );
    await urlInput.click();
    await urlInput.sendKeys("/plugins", Key.ENTER);

    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
    const reactQuerySwitch =
      await elementHelperService.findAndWaitForElementByTag(
        "dev-tool-react-query-devtools"
      );

    if ((await reactQuerySwitch.getAttribute("data-state")) !== "checked") {
      await reactQuerySwitch.click();
    } else {
      await elementHelperService.findAndClickElementByTag(
        "dev-tool-react-query-devtools-open-button"
      );
    }
    await driver.sleep(1000);
    const reactQueryIFrame = await radonViewsService.findWebViewIFrame(
      "Radon React Query DevTools"
    );
    await driver.switchTo().frame(reactQueryIFrame);

    // I do not control this tool's UI, so I can't add proper test ids
    (
      await elementHelperService.findAndWaitForElement(
        By.xpath("//*[contains(text(), 'counter')]"),
        "Timed out waiting for React Query DevTools content"
      )
    ).click();

    const dataElement = await elementHelperService.findAndWaitForElement(
      By.xpath("//span[contains(text(), 'Data')]/following-sibling::input"),
      "Timed out waiting for input sibling"
    );

    const value = await dataElement.getAttribute("value");

    appWebsocket.send(
      JSON.stringify({
        message: "click:ReactQueryCounter",
      })
    );

    await driver.wait(async () => {
      const newValue = await dataElement.getAttribute("value");
      return newValue !== value;
    }, 5000);
  });

  it("should make changes in Redux DevTools", async function () {
    await appManipulationService.hideExpoOverlay(appWebsocket);

    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );
    await urlInput.click();
    await urlInput.sendKeys("/plugins", Key.ENTER);

    await elementHelperService.findAndClickElementByTag(
      "radon-top-bar-tools-dropdown-trigger"
    );
    await elementHelperService.findAndWaitForElementByTag(
      "radon-tools-dropdown-menu"
    );
    const reactQuerySwitch =
      await elementHelperService.findAndWaitForElementByTag(
        "dev-tool-redux-devtools-devplugin"
      );

    if ((await reactQuerySwitch.getAttribute("data-state")) !== "checked") {
      await reactQuerySwitch.click();
    } else {
      await elementHelperService.findAndClickElementByTag(
        "dev-tool-redux-devtools-devplugin-open-button"
      );
    }
    await driver.sleep(1000);

    const reduxIFrame = await radonViewsService.findWebViewIFrame(
      "Radon Redux DevTools"
    );
    await driver.switchTo().frame(reduxIFrame);

    let reduxIFrame2 = await elementHelperService.findAndWaitForElement(
      By.css("iframe"),
      "Timed out waiting for Redux DevTools iframe"
    );
    await driver.switchTo().frame(reduxIFrame2);

    let element = await elementHelperService.safeFind(
      By.xpath("//div[contains(text(), 'INCREMENT')]")
    );

    // before any action is made, we expect no INCREMENT action to be present
    assert.equal(element, null, "INCREMENT action found in Redux DevTools");

    appWebsocket.send(
      JSON.stringify({
        message: "click:ReduxCounter",
      })
    );

    await driver.sleep(5000);
    element = await elementHelperService.findAndWaitForElement(
      By.xpath("//div[contains(text(), 'INCREMENT')]"),
      "Timed out waiting for INCREMENT action to appear in Redux DevTools"
    );
  });
});
