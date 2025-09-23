import { WebView, Key } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { get } from "./setupTest.js";
import { assert } from "chai";
import * as fs from "fs";
import describeIf from "../utils/helpers.js";

const raw = fs.readFileSync("./data/react-native-app/package.json");
const data = JSON.parse(raw);
const IS_EXPO = data.name.includes("expo");

describeIf(IS_EXPO, "Expo router tests", () => {
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

  it("default route should be /", async () => {
    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );
    const url = await urlInput.getAttribute("value");
    assert.equal(url, "/");
  });

  it("should change url route when switching view", async () => {
    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "expo-route-explore-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );

    await driver.wait(async () => {
      const url = await urlInput.getAttribute("value");
      return url === "/explore";
    }, 5000);
  });

  it("should navigate to different view when url is changed", async () => {
    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );
    await urlInput.click();
    await urlInput.sendKeys("/explore", Key.ENTER);

    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "expo-second-view-button"
    );
    const message = await appManipulationService.clickInPhoneAndWaitForMessage(
      position
    );

    assert.equal(message.action, "expo-second-view-button");
  });

  it("should navigate to not found view when url is changed", async () => {
    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );
    await urlInput.click();
    await urlInput.sendKeys("/notExistingRoute", Key.ENTER);

    // this view changes
    await driver.sleep(1000);

    const position = await driver.wait(async () => {
      let position;
      try {
        position = await appManipulationService.getButtonCoordinates(
          appWebsocket,
          "not-found-view-button"
        );
      } catch {
        return false;
      }
      return position;
    }, 10000);

    const message = await appManipulationService.clickInPhoneAndWaitForMessage(
      position
    );

    assert.equal(message.action, "not-found-view-button");
  });

  it("should show not found in path", async () => {
    let position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "expo-route-explore-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "not-found-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );

    await driver.wait(async () => {
      const url = await urlInput.getAttribute("value");
      console.log(url);
      return url === "/notExisting?not-found=notExisting";
    }, 5000);
  });

  it("should show modal in path", async () => {
    let position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "expo-route-explore-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "show-modal-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );

    await driver.wait(async () => {
      const url = await urlInput.getAttribute("value");
      console.log(url);
      return url === "/modal";
    }, 5000);
  });

  it("should open modal using url bar", async () => {
    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );
    await urlInput.click();
    await urlInput.sendKeys("/modal", Key.ENTER);

    // modal has slide in animation
    await driver.sleep(1000);

    const position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "modal-button"
    );
    const message = await appManipulationService.clickInPhoneAndWaitForMessage(
      position
    );

    assert.equal(message.action, "modal-button");
  });

  it("should change url when modal is closed", async () => {
    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );
    await urlInput.click();
    await urlInput.sendKeys("/modal", Key.ENTER);

    await driver.sleep(1000);

    let position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "modal-return-to-home"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    await driver.wait(async () => {
      const url = await urlInput.getAttribute("value");
      return url === "/";
    }, 5000);
  });
});
