import * as fs from "fs";
import { assert } from "chai";
import { WebView, Key } from "vscode-extension-tester";
import initServices from "../services/index.js";
import { describeIf } from "../utils/helpers.js";
import { TIMEOUTS } from "../utils/timeouts.js";
import { get } from "./setupTest.js";

const raw = fs.readFileSync("./data/react-native-app/package.json");
const data = JSON.parse(raw);
const IS_EXPO = data.name.includes("expo");

describeIf(IS_EXPO, "10 - Expo router tests", () => {
  let driver,
    appWebsocket,
    view,
    elementHelperService,
    radonViewsService,
    managingDevicesService,
    appManipulationService,
    radonSettingsService;

  before(async () => {
    ({ driver, view } = get());

    ({
      elementHelperService,
      radonViewsService,
      managingDevicesService,
      appManipulationService,
      radonSettingsService,
    } = initServices(driver));

    await managingDevicesService.prepareDevices();

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
    }, TIMEOUTS.MEDIUM);

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
    }, TIMEOUTS.DEFAULT);
  });

  it("should navigate to different view when url is changed", async () => {
    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );
    await urlInput.click();
    await urlInput.sendKeys("/explore", Key.ENTER);

    await driver.sleep(TIMEOUTS.SHORT);

    const position = await driver.wait(async () => {
      try {
        const position = await appManipulationService.getButtonCoordinates(
          appWebsocket,
          "expo-second-view-button"
        );
        return position;
      } catch {
        return false;
      }
    }, TIMEOUTS.LONG);

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
    await driver.sleep(TIMEOUTS.SHORT);

    const position = await driver.wait(async () => {
      try {
        return await appManipulationService.getButtonCoordinates(
          appWebsocket,
          "not-found-view-button"
        );
      } catch {
        return false;
      }
    }, TIMEOUTS.LONG);

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

    position = await driver.wait(async () => {
      try {
        const position = await appManipulationService.getButtonCoordinates(
          appWebsocket,
          "not-found-button"
        );
        return position;
      } catch {
        return false;
      }
    }, TIMEOUTS.LONG);
    await appManipulationService.clickInsidePhoneScreen(position);

    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );

    await driver.wait(async () => {
      const url = await urlInput.getAttribute("value");
      return url === "/notExisting?not-found=notExisting";
    }, TIMEOUTS.DEFAULT);
  });

  it("should show modal in path", async () => {
    let position = await appManipulationService.getButtonCoordinates(
      appWebsocket,
      "expo-route-explore-button"
    );
    await appManipulationService.clickInsidePhoneScreen(position);

    position = await driver.wait(async () => {
      try {
        const position = await appManipulationService.getButtonCoordinates(
          appWebsocket,
          "show-modal-button"
        );
        return position;
      } catch {
        return false;
      }
    }, TIMEOUTS.LONG);

    await appManipulationService.clickInsidePhoneScreen(position);

    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );

    await driver.wait(async () => {
      const url = await urlInput.getAttribute("value");
      return url === "/modal";
    }, TIMEOUTS.DEFAULT);
  });

  it("should open modal using url bar", async () => {
    const urlInput = await elementHelperService.findAndWaitForElementByTag(
      "radon-top-bar-url-input"
    );
    await urlInput.click();
    await urlInput.sendKeys("/modal", Key.ENTER);

    // modal has slide in animation
    await driver.sleep(TIMEOUTS.SHORT);

    const position = await driver.wait(async () => {
      try {
        const position = await appManipulationService.getButtonCoordinates(
          appWebsocket,
          "modal-button"
        );
        return position;
      } catch {
        return false;
      }
    }, TIMEOUTS.LONG);

    const message = await appManipulationService.clickInPhoneAndWaitForMessage(
      position
    );

    assert.equal(message.action, "modal-button");
  });
});
